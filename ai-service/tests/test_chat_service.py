"""ChatService 测试。

用假的 OpenAI 客户端替代真实请求，覆盖请求参数构造、回答提取、
缺失密钥与各类上游异常到业务异常的映射。不访问 DeepSeek。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import openai
import pytest

from app.exceptions import (
    ChatConfigurationError,
    ChatRateLimitError,
    ChatTimeoutError,
    ChatUpstreamError,
)
from app.services.chat_service import SYSTEM_PROMPT, ChatConfig, ChatService
from tests.fakes import (
    FakeAsyncOpenAI,
    completion,
    connection_error,
    empty_completion,
    status_error,
    timeout_error,
)

pytestmark = pytest.mark.anyio


def build_config(**overrides: Any) -> ChatConfig:
    """构造测试用配置，避免依赖本机 .env。"""
    values: dict[str, Any] = {
        "api_key": "test-key",
        "base_url": "https://api.deepseek.com",
        "model": "deepseek-chat",
        "timeout_seconds": 30.0,
        "max_tokens": 1024,
        "temperature": 0.7,
    }
    values.update(overrides)
    return ChatConfig(**values)


async def test_ask_returns_stripped_answer() -> None:
    service = ChatService(build_config(), client=FakeAsyncOpenAI(result=completion("  这是回答  ")))

    assert await service.ask("问题") == "这是回答"


async def test_ask_sends_expected_parameters() -> None:
    client = FakeAsyncOpenAI(result=completion("ok"))
    service = ChatService(
        build_config(model="deepseek-reasoner", max_tokens=256, temperature=0.2),
        client=client,
    )

    await service.ask("什么是 RAG？")

    call = client.calls[0]
    assert call["model"] == "deepseek-reasoner"
    assert call["max_tokens"] == 256
    assert call["temperature"] == 0.2
    assert call["stream"] is False
    assert call["messages"] == [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": "什么是 RAG？"},
    ]


async def test_missing_api_key_raises_configuration_error() -> None:
    client = FakeAsyncOpenAI(result=completion("不应被调用"))
    service = ChatService(build_config(api_key=""), client=client)

    with pytest.raises(ChatConfigurationError):
        await service.ask("问题")

    assert client.calls == []


async def test_client_is_built_from_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """确认真的用 OpenAI SDK 按配置构造客户端，而不是别的方式。"""
    captured: dict[str, Any] = {}

    class RecordingAsyncOpenAI:
        def __init__(self, **kwargs: Any) -> None:
            captured.update(kwargs)
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

        async def _create(self, **_: Any) -> Any:
            return completion("ok")

    monkeypatch.setattr("app.services.chat_service.AsyncOpenAI", RecordingAsyncOpenAI)

    service = ChatService(
        build_config(
            api_key="sk-test",
            base_url="https://api.deepseek.com/v1",
            timeout_seconds=12.5,
        )
    )

    assert await service.ask("你好") == "ok"
    assert captured == {
        "api_key": "sk-test",
        "base_url": "https://api.deepseek.com/v1",
        "timeout": 12.5,
    }


async def test_empty_answer_raises_upstream_error() -> None:
    service = ChatService(build_config(), client=FakeAsyncOpenAI(result=completion("   ")))

    with pytest.raises(ChatUpstreamError):
        await service.ask("问题")


async def test_missing_choices_raises_upstream_error() -> None:
    service = ChatService(build_config(), client=FakeAsyncOpenAI(result=empty_completion()))

    with pytest.raises(ChatUpstreamError):
        await service.ask("问题")


@pytest.mark.parametrize(
    ("error", "expected"),
    [
        pytest.param(timeout_error(), ChatTimeoutError, id="超时"),
        pytest.param(connection_error(), ChatUpstreamError, id="连接失败"),
        pytest.param(
            status_error(openai.AuthenticationError, 401), ChatUpstreamError, id="认证失败"
        ),
        pytest.param(status_error(openai.RateLimitError, 429), ChatRateLimitError, id="限流"),
        pytest.param(status_error(openai.APIStatusError, 500), ChatUpstreamError, id="上游 500"),
        pytest.param(openai.OpenAIError("未知错误"), ChatUpstreamError, id="其他 SDK 错误"),
    ],
)
async def test_upstream_errors_are_translated(
    error: Exception, expected: type[Exception]
) -> None:
    service = ChatService(build_config(), client=FakeAsyncOpenAI(error=error))

    with pytest.raises(expected):
        await service.ask("问题")


async def test_aclose_releases_client() -> None:
    client = FakeAsyncOpenAI(result=completion("ok"))
    service = ChatService(build_config(), client=client)

    await service.aclose()

    assert client.closed is True


async def test_ask_can_use_config_passed_per_call() -> None:
    """多供应商场景：模型与地址来自调用方解析出的配置。"""
    client = FakeAsyncOpenAI(result=completion("ok"))
    service = ChatService(build_config(model="deepseek-chat"), client=client)

    await service.ask(
        "你好",
        config=build_config(model="qwen-plus", base_url="https://8.8.8.8/v1"),
    )

    assert client.calls[0]["model"] == "qwen-plus"


async def test_call_config_without_key_is_rejected_immediately() -> None:
    client = FakeAsyncOpenAI(result=completion("不应被调用"))
    service = ChatService(build_config(), client=client)

    with pytest.raises(ChatConfigurationError):
        await service.ask("你好", config=build_config(api_key=""))

    assert client.calls == []


async def test_clients_are_cached_per_config(monkeypatch: pytest.MonkeyPatch) -> None:
    """同一份配置复用同一个客户端，不同配置各建一个，且不把明文密钥留在键里。"""
    created: list[dict[str, Any]] = []

    class RecordingAsyncOpenAI:
        def __init__(self, **kwargs: Any) -> None:
            created.append(kwargs)
            self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

        async def _create(self, **_: Any) -> Any:
            return completion("ok")

        async def close(self) -> None:
            return None

    monkeypatch.setattr("app.services.chat_service.AsyncOpenAI", RecordingAsyncOpenAI)

    service = ChatService(build_config())
    await service.ask("一")
    # 只有模型名不同：同一个端点与密钥，复用同一客户端
    await service.ask("二", config=build_config(model="deepseek-reasoner"))
    # 换了密钥：另建一个客户端
    await service.ask("三", config=build_config(api_key="sk-another"))

    assert len(created) == 2
    assert "sk-test" not in "".join(service._clients)  # noqa: SLF001 - 断言缓存键为摘要

    await service.aclose()
    assert service._clients == {}  # noqa: SLF001
