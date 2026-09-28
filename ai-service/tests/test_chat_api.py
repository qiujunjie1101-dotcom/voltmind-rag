"""POST /api/v1/chat 接口测试。

依赖被替换为 StubChatService，只验证接口契约、模型选择解析与异常到状态码的映射，
不会产生真实模型调用。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.exceptions import (
    ChatConfigurationError,
    ChatRateLimitError,
    ChatTimeoutError,
    ChatUpstreamError,
)
from app.main import app
from app.schemas.chat import QUESTION_MAX_LENGTH
from app.services.provider_service import (
    BUILTIN_PROVIDER_ID,
    ProviderService,
    get_provider_service,
)
from tests.conftest import PUBLIC_BASE_URL, build_provider_service
from tests.fakes import StubChatService

CHAT_PATH = "/api/v1/chat"
PROVIDERS_PATH = "/api/v1/providers"


def create_provider(client: TestClient, **overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "中转站",
        "base_url": PUBLIC_BASE_URL,
        "api_key": "custom-provider-key",
        "models": [{"model": "qwen-plus", "name": "通义千问"}],
    }
    payload.update(overrides)
    response = client.post(PROVIDERS_PATH, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_chat_returns_answer(client: TestClient, stub_chat_service: StubChatService) -> None:
    stub_chat_service.answer = "检索增强生成是先检索资料再生成回答。"

    response = client.post(CHAT_PATH, json={"question": "什么是 RAG？"})

    assert response.status_code == 200
    assert response.json() == {"answer": "检索增强生成是先检索资料再生成回答。"}
    assert stub_chat_service.questions == ["什么是 RAG？"]


def test_chat_trims_question(client: TestClient, stub_chat_service: StubChatService) -> None:
    client.post(CHAT_PATH, json={"question": "  你好  "})

    assert stub_chat_service.questions == ["你好"]


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({}, id="缺少 question"),
        pytest.param({"question": ""}, id="空字符串"),
        pytest.param({"question": "   "}, id="纯空白"),
        pytest.param({"question": "x" * (QUESTION_MAX_LENGTH + 1)}, id="超长"),
        pytest.param({"question": 123}, id="类型错误"),
        pytest.param({"question": "hi", "extra": 1}, id="多余字段"),
    ],
)
def test_chat_rejects_invalid_payload(
    client: TestClient, stub_chat_service: StubChatService, payload: dict[str, object]
) -> None:
    response = client.post(CHAT_PATH, json=payload)

    assert response.status_code == 422
    assert stub_chat_service.questions == []


@pytest.mark.parametrize(
    ("error", "expected_status"),
    [
        pytest.param(ChatConfigurationError("未配置 DEEPSEEK_API_KEY"), 503, id="缺少配置"),
        pytest.param(ChatTimeoutError("模型服务响应超时，请稍后重试"), 504, id="上游超时"),
        pytest.param(ChatRateLimitError("模型服务当前限流，请稍后重试"), 429, id="上游限流"),
        pytest.param(ChatUpstreamError("模型服务返回异常状态 500"), 502, id="上游异常"),
    ],
)
def test_chat_maps_business_errors_to_status(
    client: TestClient,
    stub_chat_service: StubChatService,
    error: Exception,
    expected_status: int,
) -> None:
    stub_chat_service.error = error

    response = client.post(CHAT_PATH, json={"question": "你好"})

    assert response.status_code == expected_status
    assert response.json() == {"detail": str(error)}


def test_chat_is_documented_in_openapi(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    operation = schema["paths"][CHAT_PATH]["post"]
    assert operation["requestBody"]
    assert set(operation["responses"]) >= {"200", "422", "429", "502", "503", "504"}


def test_chat_route_uses_post_only(client: TestClient) -> None:
    assert client.get(CHAT_PATH).status_code == 405


def test_chat_falls_back_to_env_default_model(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    """不传模型参数时沿用 .env 的默认配置，保证既有调用方兼容。"""
    response = client.post(CHAT_PATH, json={"question": "你好"})

    assert response.status_code == 200
    config = stub_chat_service.configs[0]
    assert config.model == "deepseek-chat"
    assert config.base_url == "https://api.deepseek.com"


def test_chat_uses_selected_custom_provider(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    provider = create_provider(client)
    model = provider["models"][0]  # type: ignore[index]

    response = client.post(
        CHAT_PATH,
        json={
            "question": "你好",
            "provider_id": provider["id"],
            "model_id": model["id"],  # type: ignore[index]
        },
    )

    assert response.status_code == 200
    config = stub_chat_service.configs[0]
    assert config.model == "qwen-plus"
    assert config.base_url == PUBLIC_BASE_URL
    assert config.api_key == "custom-provider-key"


def test_chat_uses_selected_builtin_provider(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    response = client.post(
        CHAT_PATH,
        json={
            "question": "你好",
            "provider_id": BUILTIN_PROVIDER_ID,
            "model_id": "deepseek-chat",
        },
    )

    assert response.status_code == 200
    assert stub_chat_service.configs[0].model == "deepseek-chat"


@pytest.mark.parametrize(
    ("payload", "detail_hint"),
    [
        pytest.param(
            {"provider_id": "not-exist", "model_id": "x"},
            "供应商不存在",
            id="供应商不存在",
        ),
    ],
)
def test_chat_rejects_unknown_provider(
    client: TestClient,
    stub_chat_service: StubChatService,
    payload: dict[str, str],
    detail_hint: str,
) -> None:
    """请求只能引用已保存的配置，引用不到就报 400，不会去调用模型。"""
    response = client.post(CHAT_PATH, json={"question": "你好", **payload})

    assert response.status_code == 400
    assert detail_hint in response.json()["detail"]
    assert stub_chat_service.questions == []


def test_chat_rejects_unknown_model_of_existing_provider(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    provider = create_provider(client)

    response = client.post(
        CHAT_PATH,
        json={"question": "你好", "provider_id": provider["id"], "model_id": "not-a-model"},
    )

    assert response.status_code == 400
    assert "模型已不存在" in response.json()["detail"]
    assert stub_chat_service.questions == []


def test_chat_rejects_builtin_model_outside_env(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    response = client.post(
        CHAT_PATH,
        json={
            "question": "你好",
            "provider_id": BUILTIN_PROVIDER_ID,
            "model_id": "deepseek-reasoner",
        },
    )

    assert response.status_code == 400
    assert stub_chat_service.questions == []


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"provider_id": "builtin-deepseek"}, id="只给供应商"),
        pytest.param({"model_id": "deepseek-chat"}, id="只给模型"),
    ],
)
def test_chat_rejects_incomplete_model_selection(
    client: TestClient, stub_chat_service: StubChatService, payload: dict[str, str]
) -> None:
    response = client.post(CHAT_PATH, json={"question": "你好", **payload})

    assert response.status_code == 422


def test_chat_returns_503_when_no_model_is_configured(
    client: TestClient,
    stub_chat_service: StubChatService,
    provider_service: ProviderService,
) -> None:
    """没有内置密钥也没有自定义供应商时给出可执行的提示。"""
    app.dependency_overrides[get_provider_service] = lambda: build_provider_service(
        provider_service.store_path.parent, deepseek_api_key=""
    )

    response = client.post(CHAT_PATH, json={"question": "你好"})

    assert response.status_code == 503
    assert "设置 → 模型服务" in response.json()["detail"]
    assert stub_chat_service.questions == []

