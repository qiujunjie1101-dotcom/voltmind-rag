"""测试替身。

模型调用只在这里被替换：接口层用 StubChatService，服务层用 FakeAsyncOpenAI。
测试不访问 DeepSeek，也不消耗 API 额度。
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import httpx2  # openai 3.x 的底层 HTTP 库，用于构造真实形状的上游异常
import openai

DEEPSEEK_CHAT_URL = "https://api.deepseek.com/chat/completions"


class StubChatService:
    """ChatService 替身，记录收到的问题与解析出的调用配置。"""

    def __init__(self, answer: str = "模拟回答", error: Exception | None = None) -> None:
        self.answer = answer
        self.error = error
        self.questions: list[str] = []
        self.configs: list[Any] = []

    async def ask(self, question: str, config: Any = None) -> str:
        self.questions.append(question)
        self.configs.append(config)
        if self.error is not None:
            raise self.error
        return self.answer


class FakeAsyncOpenAI:
    """AsyncOpenAI 替身，记录调用参数并返回预设结果或抛出预设异常。"""

    def __init__(self, result: Any = None, error: Exception | None = None) -> None:
        self.result = result
        self.error = error
        self.calls: list[dict[str, Any]] = []
        self.closed = False
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.result

    async def close(self) -> None:
        self.closed = True


def completion(content: str | None) -> SimpleNamespace:
    """构造形状与 ChatCompletion 一致的返回对象。"""
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def empty_completion() -> SimpleNamespace:
    """没有任何候选的返回对象。"""
    return SimpleNamespace(choices=[])


def http_request() -> httpx2.Request:
    return httpx2.Request("POST", DEEPSEEK_CHAT_URL)


def status_error(
    error_type: type[openai.APIStatusError], status_code: int
) -> openai.APIStatusError:
    """构造带真实 HTTP 响应的上游状态异常。"""
    return error_type(
        "upstream error",
        response=httpx2.Response(status_code, request=http_request()),
        body=None,
    )


def timeout_error() -> openai.APITimeoutError:
    return openai.APITimeoutError(http_request())


def connection_error() -> openai.APIConnectionError:
    return openai.APIConnectionError(request=http_request())
