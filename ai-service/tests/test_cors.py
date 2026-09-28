"""CORS 配置测试。

前端 voltmind-web 通过 Axios 直连本服务，浏览器会先发预检请求，
因此需要确认：放行来源收到正确的 CORS 头，未放行来源拿不到。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.config import DEFAULT_CORS_ALLOW_ORIGINS
from app.exceptions import ChatTimeoutError
from tests.fakes import StubChatService

CHAT_PATH = "/api/v1/chat"
ALLOWED_ORIGIN = DEFAULT_CORS_ALLOW_ORIGINS[0]
DISALLOWED_ORIGIN = "https://evil.example.com"


def test_default_origins_cover_local_frontend_ports() -> None:
    """默认放行 voltmind-web 的 dev 与 preview 端口。"""
    assert "http://127.0.0.1:5174" in DEFAULT_CORS_ALLOW_ORIGINS
    assert "http://127.0.0.1:4173" in DEFAULT_CORS_ALLOW_ORIGINS


def test_preflight_allows_local_frontend_origin(client: TestClient) -> None:
    response = client.options(
        CHAT_PATH,
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert "POST" in response.headers["access-control-allow-methods"]
    assert "content-type" in response.headers["access-control-allow-headers"].lower()


def test_preflight_allows_provider_management_methods(client: TestClient) -> None:
    """供应商管理用 PUT/DELETE，预检不放行的话浏览器连请求都发不出去。"""
    methods = set()
    for method in ("PUT", "DELETE"):
        response = client.options(
            "/api/v1/providers/abc",
            headers={
                "Origin": ALLOWED_ORIGIN,
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "Content-Type",
            },
        )
        assert response.status_code == 200
        allowed = response.headers["access-control-allow-methods"]
        assert method in allowed
        methods.add(method)

    assert methods == {"PUT", "DELETE"}


def test_cors_header_is_never_wildcard(client: TestClient) -> None:
    """不使用通配符，避免任意站点读取响应。"""
    response = client.options(
        CHAT_PATH,
        headers={
            "Origin": ALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.headers.get("access-control-allow-origin") != "*"


def test_success_response_carries_cors_header(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    response = client.post(
        CHAT_PATH,
        json={"question": "你好"},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_error_response_also_carries_cors_header(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    """业务异常走统一处理器返回，跨域头不能丢，否则浏览器读不到状态码。"""
    stub_chat_service.error = ChatTimeoutError("模型服务响应超时，请稍后重试")

    response = client.post(
        CHAT_PATH,
        json={"question": "你好"},
        headers={"Origin": ALLOWED_ORIGIN},
    )

    assert response.status_code == 504
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert response.json()["detail"]


def test_disallowed_origin_gets_no_cors_header(
    client: TestClient, stub_chat_service: StubChatService
) -> None:
    response = client.post(
        CHAT_PATH,
        json={"question": "你好"},
        headers={"Origin": DISALLOWED_ORIGIN},
    )

    assert "access-control-allow-origin" not in response.headers


def test_disallowed_origin_preflight_is_rejected(client: TestClient) -> None:
    response = client.options(
        CHAT_PATH,
        headers={
            "Origin": DISALLOWED_ORIGIN,
            "Access-Control-Request-Method": "POST",
        },
    )

    assert "access-control-allow-origin" not in response.headers
