"""测试夹具。

默认把聊天服务替换为替身，并把供应商配置指向临时目录，
任何用例都不会真实调用模型，也不会读写 ai-service/data/ 下的真实配置。
"""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import app
from app.security.crypto import SecretBox, derive_fernet_key
from app.services.chat_service import get_chat_service
from app.services.provider_service import ProviderService, get_provider_service
from app.services.provider_store import ProviderStore
from tests.fakes import StubChatService

TEST_MASTER_KEY = "unit-test-master-key"
BUILTIN_TEST_KEY = "builtin-test-key"
# 用 IP 字面量避免用例依赖 DNS：8.8.8.8 是公网地址，127.0.0.1 是内网地址
PUBLIC_BASE_URL = "https://8.8.8.8/v1"
PRIVATE_BASE_URL = "http://127.0.0.1:11434/v1"

# 口令派生较慢，模块级派生一次给全部用例复用
_TEST_FERNET_KEY = derive_fernet_key(TEST_MASTER_KEY)


def build_settings(tmp_path: Path, **overrides: object) -> Settings:
    """构造隔离的配置：存储与密钥文件都落在 tmp_path。"""
    values: dict[str, object] = {
        "deepseek_api_key": BUILTIN_TEST_KEY,
        "deepseek_model": "deepseek-chat",
        "data_dir": tmp_path,
        "provider_store_path": tmp_path / "model_providers.json",
        "secret_key_path": tmp_path / ".secret_key",
        "secret_key": TEST_MASTER_KEY,
        "allow_private_base_urls": False,
    }
    values.update(overrides)
    return Settings(**values)  # type: ignore[arg-type]


def build_provider_service(tmp_path: Path, **overrides: object) -> ProviderService:
    """构造指向临时目录的供应商服务。"""
    resolved = build_settings(tmp_path, **overrides)
    return ProviderService(
        store=ProviderStore(resolved.provider_store_path),
        secret_box=SecretBox(_TEST_FERNET_KEY),
        settings=resolved,
    )


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    """进程内测试客户端，无需启动真实服务端口。"""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def stub_chat_service() -> StubChatService:
    """把模型调用替换为替身，并安装到依赖注入。"""
    stub = StubChatService()
    app.dependency_overrides[get_chat_service] = lambda: stub
    return stub


@pytest.fixture(autouse=True)
def provider_service(tmp_path: Path) -> ProviderService:
    """默认安装临时的供应商服务，用例不触碰真实配置文件。"""
    service = build_provider_service(tmp_path)
    app.dependency_overrides[get_provider_service] = lambda: service
    return service


@pytest.fixture(autouse=True)
def _clear_dependency_overrides() -> Iterator[None]:
    """保证依赖覆盖不会跨用例泄漏。"""
    yield
    app.dependency_overrides.clear()
