"""模型供应商管理接口测试。

重点覆盖两类风险：明文密钥外泄（响应与落盘文件都不能有），
以及自定义 Base URL 被用于访问内网（SSRF）。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.schemas.provider import ProviderCreate
from app.security.crypto import SecretBox, derive_fernet_key
from app.services.provider_service import (
    BUILTIN_PROVIDER_ID,
    ProviderService,
)
from app.services.provider_store import ProviderStore
from tests.conftest import (
    BUILTIN_TEST_KEY,
    PRIVATE_BASE_URL,
    PUBLIC_BASE_URL,
    build_provider_service,
    build_settings,
)

PROVIDERS_PATH = "/api/v1/providers"
MODELS_PATH = "/api/v1/models"
# 明文密钥在响应与文件中都不允许出现，用例用可识别的取值方便断言
SECRET_VALUE = "provider-secret-abcdefghijklmnop"
ROTATED_VALUE = "rotated-secret-zyxwvutsrqponmlk"


def create_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "我的中转站",
        "base_url": PUBLIC_BASE_URL,
        "api_key": SECRET_VALUE,
        "models": [{"model": "gpt-4o-mini", "name": "GPT-4o mini"}],
    }
    payload.update(overrides)
    return payload


def create_provider(client: TestClient, **overrides: Any) -> dict[str, Any]:
    response = client.post(PROVIDERS_PATH, json=create_payload(**overrides))
    assert response.status_code == 201, response.text
    return response.json()


# ---------- 列表与内置供应商 ----------


def test_lists_builtin_provider_first_without_exposing_key(client: TestClient) -> None:
    response = client.get(PROVIDERS_PATH)

    assert response.status_code == 200
    providers = response.json()["providers"]
    assert [item["id"] for item in providers] == [BUILTIN_PROVIDER_ID]

    builtin = providers[0]
    assert builtin["is_builtin"] is True
    assert builtin["api_key_configured"] is True
    assert builtin["models"][0]["model"] == "deepseek-chat"
    assert BUILTIN_TEST_KEY not in response.text
    assert "api_key" not in builtin


def test_builtin_provider_reports_missing_key(
    client: TestClient, provider_service: ProviderService
) -> None:
    """未配置 DEEPSEEK_API_KEY 时内置项仍可见，但标记未配置。"""
    unconfigured = build_provider_service(
        provider_service.store_path.parent, deepseek_api_key=""
    )

    builtin = unconfigured.list_providers()[0]
    assert builtin.api_key_configured is False
    assert builtin.api_key_masked is None


# ---------- 新增 ----------


def test_create_provider_returns_masked_view(client: TestClient) -> None:
    created = create_provider(client)

    assert created["name"] == "我的中转站"
    assert created["base_url"] == PUBLIC_BASE_URL
    assert created["is_builtin"] is False
    assert created["api_key_configured"] is True
    assert created["api_key_masked"] == f"{SECRET_VALUE[:3]}…{SECRET_VALUE[-4:]}"
    assert SECRET_VALUE not in created["api_key_masked"]
    assert created["models"][0]["model"] == "gpt-4o-mini"
    assert created["models"][0]["name"] == "GPT-4o mini"
    assert created["models"][0]["id"]


def test_create_never_returns_plaintext_key(client: TestClient) -> None:
    response = client.post(PROVIDERS_PATH, json=create_payload())

    assert response.status_code == 201
    assert SECRET_VALUE not in response.text


def test_created_provider_is_persisted_encrypted(client: TestClient, tmp_path: Path) -> None:
    create_provider(client)

    store_file = tmp_path / "model_providers.json"
    raw = store_file.read_text(encoding="utf-8")
    stored = json.loads(raw)["providers"][0]

    assert SECRET_VALUE not in raw
    assert stored["encrypted_api_key"].startswith("v1:")
    assert stored["models"][0]["model"] == "gpt-4o-mini"


def test_create_defaults_display_name_to_model_id(client: TestClient) -> None:
    created = create_provider(client, models=[{"model": "qwen-plus"}])

    assert created["models"][0]["name"] == "qwen-plus"


def test_create_rejects_private_base_url(client: TestClient, tmp_path: Path) -> None:
    response = client.post(PROVIDERS_PATH, json=create_payload(base_url=PRIVATE_BASE_URL))

    assert response.status_code == 400
    assert "内网或保留地址" in response.json()["detail"]
    assert not (tmp_path / "model_providers.json").exists()


def test_create_rejects_duplicate_name(client: TestClient) -> None:
    create_provider(client)

    response = client.post(PROVIDERS_PATH, json=create_payload(name="我的中转站"))

    assert response.status_code == 400
    assert "同名供应商" in response.json()["detail"]


def test_create_rejects_duplicate_model(client: TestClient) -> None:
    response = client.post(
        PROVIDERS_PATH,
        json=create_payload(models=[{"model": "gpt-4o-mini"}, {"model": "GPT-4O-MINI"}]),
    )

    assert response.status_code == 400
    assert "重复" in response.json()["detail"]


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param(create_payload(models=[]), id="模型为空"),
        pytest.param(create_payload(api_key=""), id="密钥为空"),
        pytest.param(create_payload(name="  "), id="名称为空白"),
        pytest.param(create_payload(protocol="anthropic"), id="不支持的协议"),
        pytest.param({**create_payload(), "extra": 1}, id="多余字段"),
    ],
)
def test_create_rejects_invalid_payload(client: TestClient, payload: dict[str, Any]) -> None:
    assert client.post(PROVIDERS_PATH, json=payload).status_code == 422


def test_create_enforces_provider_limit(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("app.services.provider_service.MAX_PROVIDERS", 1)
    create_provider(client)

    response = client.post(PROVIDERS_PATH, json=create_payload(name="第二个"))

    assert response.status_code == 400
    assert "上限" in response.json()["detail"]


# ---------- 编辑 ----------


def test_update_without_api_key_keeps_existing_key(client: TestClient) -> None:
    created = create_provider(client)

    response = client.put(f"{PROVIDERS_PATH}/{created['id']}", json={"name": "改名后"})

    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "改名后"
    assert updated["api_key_configured"] is True
    assert updated["api_key_masked"] == created["api_key_masked"]
    assert updated["models"] == created["models"]


def test_update_can_rotate_api_key(client: TestClient) -> None:
    created = create_provider(client)

    response = client.put(
        f"{PROVIDERS_PATH}/{created['id']}", json={"api_key": ROTATED_VALUE}
    )

    updated = response.json()
    assert updated["api_key_masked"] == f"{ROTATED_VALUE[:3]}…{ROTATED_VALUE[-4:]}"
    assert ROTATED_VALUE not in response.text


def test_update_replaces_models_wholesale(client: TestClient) -> None:
    created = create_provider(client)

    response = client.put(
        f"{PROVIDERS_PATH}/{created['id']}",
        json={"models": [{"model": "gpt-4o"}, {"model": "gpt-4o-mini", "name": "小模型"}]},
    )

    models = response.json()["models"]
    assert [item["model"] for item in models] == ["gpt-4o", "gpt-4o-mini"]
    assert models[1]["name"] == "小模型"


def test_update_rejects_private_base_url(client: TestClient) -> None:
    created = create_provider(client)

    response = client.put(
        f"{PROVIDERS_PATH}/{created['id']}", json={"base_url": PRIVATE_BASE_URL}
    )

    assert response.status_code == 400


def test_update_builtin_provider_is_rejected(client: TestClient) -> None:
    response = client.put(f"{PROVIDERS_PATH}/{BUILTIN_PROVIDER_ID}", json={"name": "改名"})

    assert response.status_code == 400
    assert "内置供应商" in response.json()["detail"]


def test_update_unknown_provider_returns_404(client: TestClient) -> None:
    assert client.put(f"{PROVIDERS_PATH}/not-exist", json={"name": "x"}).status_code == 404


# ---------- 删除 ----------


def test_delete_removes_provider(client: TestClient) -> None:
    created = create_provider(client)

    assert client.delete(f"{PROVIDERS_PATH}/{created['id']}").status_code == 204
    providers = client.get(PROVIDERS_PATH).json()["providers"]
    assert [item["id"] for item in providers] == [BUILTIN_PROVIDER_ID]
    assert client.delete(f"{PROVIDERS_PATH}/{created['id']}").status_code == 404


def test_delete_builtin_provider_is_rejected(client: TestClient) -> None:
    response = client.delete(f"{PROVIDERS_PATH}/{BUILTIN_PROVIDER_ID}")

    assert response.status_code == 400
    assert "内置供应商" in response.json()["detail"]


# ---------- 可用模型列表 ----------


def test_models_endpoint_exposes_builtin_as_default(client: TestClient) -> None:
    body = client.get(MODELS_PATH).json()

    assert body["default_provider_id"] == BUILTIN_PROVIDER_ID
    assert body["default_model_id"] == "deepseek-chat"
    assert body["models"][0]["is_default"] is True
    assert sum(1 for item in body["models"] if item["is_default"]) == 1


def test_models_endpoint_includes_custom_provider(client: TestClient) -> None:
    created = create_provider(client, models=[{"model": "qwen-plus", "name": "通义千问"}])

    body = client.get(MODELS_PATH).json()
    custom = [item for item in body["models"] if item["provider_id"] == created["id"]]

    assert len(custom) == 1
    assert custom[0]["model"] == "qwen-plus"
    assert custom[0]["name"] == "通义千问"
    assert custom[0]["model_id"] == created["models"][0]["id"]
    assert custom[0]["is_default"] is False


def test_provider_with_unreadable_key_is_not_selectable(tmp_path: Path) -> None:
    """主口令变更后旧密文解不开，该供应商不进入选择器且标记未配置。"""
    settings = build_settings(tmp_path, deepseek_api_key="")
    service = build_provider_service(tmp_path, deepseek_api_key="")
    created = service.create_provider(
        ProviderCreate(
            name="中转站",
            base_url=PUBLIC_BASE_URL,
            api_key=SECRET_VALUE,
            models=[{"model": "gpt-4o-mini"}],
        )
    )

    rotated = ProviderService(
        store=ProviderStore(settings.provider_store_path),
        secret_box=SecretBox(derive_fernet_key("rotated-master-key")),
        settings=settings,
    )

    assert rotated.list_model_options().models == []
    assert rotated.list_providers()[1].api_key_configured is False


def test_models_endpoint_returns_empty_when_nothing_configured(
    provider_service: ProviderService,
) -> None:
    """内置与自定义都没配好时返回空列表，前端据此提示去设置页配置。"""
    unconfigured = build_provider_service(
        provider_service.store_path.parent, deepseek_api_key=""
    )

    body = unconfigured.list_model_options()

    assert body.models == []
    assert body.default_provider_id is None
    assert body.default_model_id is None


# ---------- 文档与配置损坏 ----------


def test_provider_routes_are_documented(client: TestClient) -> None:
    paths = client.get("/openapi.json").json()["paths"]

    assert set(paths[PROVIDERS_PATH]) == {"get", "post"}
    assert set(paths[f"{PROVIDERS_PATH}/{{provider_id}}"]) == {"put", "delete"}
    assert "get" in paths[MODELS_PATH]


def test_provider_routes_are_post_only_for_collection(client: TestClient) -> None:
    assert client.delete(PROVIDERS_PATH).status_code == 405


def test_broken_store_file_returns_500(client: TestClient, tmp_path: Path) -> None:
    (tmp_path / "model_providers.json").write_text("{ not json", encoding="utf-8")

    response = client.get(PROVIDERS_PATH)

    assert response.status_code == 500
    assert "读取供应商配置失败" in response.json()["detail"]
