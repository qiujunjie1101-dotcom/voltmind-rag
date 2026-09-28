"""接口调试页面测试：校验页面可访问、脚本引用正确且不污染接口契约。"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.api.docs import SCALAR_CDN_URL
from app.config import settings

SCALAR_PATH = "/scalar"


def test_scalar_page_is_html(client: TestClient) -> None:
    response = client.get(SCALAR_PATH)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/html")


def test_scalar_page_points_to_live_openapi(client: TestClient) -> None:
    html = client.get(SCALAR_PATH).text

    assert 'data-url="/openapi.json"' in html
    assert SCALAR_CDN_URL in html
    assert settings.app_name in html


def test_openapi_json_is_served(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    assert schema["info"]["title"] == settings.app_name
    assert "/openapi.json" not in schema["paths"]


def test_scalar_page_is_not_part_of_api_contract(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()

    assert SCALAR_PATH not in schema["paths"]
