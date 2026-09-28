"""健康检查接口测试：校验状态码、响应契约与时间语义。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

HEALTH_PATH = "/health"
EXPECTED_FIELDS = {
    "status",
    "service",
    "version",
    "environment",
    "uptime_seconds",
    "timestamp",
}


def test_health_returns_json_ok(client: TestClient) -> None:
    response = client.get(HEALTH_PATH)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")


def test_health_response_contract(client: TestClient) -> None:
    payload = client.get(HEALTH_PATH).json()

    assert set(payload) == EXPECTED_FIELDS
    assert payload["status"] == "ok"
    assert payload["service"]
    assert payload["version"]
    assert payload["environment"]
    assert isinstance(payload["uptime_seconds"], (int, float))
    assert payload["uptime_seconds"] >= 0


def test_health_timestamp_is_recent_utc(client: TestClient) -> None:
    payload = client.get(HEALTH_PATH).json()
    timestamp = datetime.fromisoformat(payload["timestamp"])

    assert timestamp.tzinfo is not None
    assert abs(datetime.now(timezone.utc) - timestamp) < timedelta(seconds=30)


def test_health_is_documented_in_openapi(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    assert HEALTH_PATH in schema["paths"]
    assert "get" in schema["paths"][HEALTH_PATH]


def test_health_rejects_unsupported_method(client: TestClient) -> None:
    assert client.post(HEALTH_PATH).status_code == 405
