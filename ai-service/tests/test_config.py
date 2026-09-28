"""配置测试：确认密钥来自环境，且没有硬编码。"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.config import (
    DEFAULT_CORS_ALLOW_ORIGINS,
    DEFAULT_DEEPSEEK_BASE_URL,
    DEFAULT_DEEPSEEK_MODEL,
    SERVICE_ROOT,
    Settings,
)

SECRET_PATTERN = re.compile(r"sk-[A-Za-z0-9_-]{16,}")
CONFIG_KEYS = (
    "DEEPSEEK_API_KEY",
    "DEEPSEEK_BASE_URL",
    "DEEPSEEK_MODEL",
    "LLM_TIMEOUT_SECONDS",
    "LLM_MAX_TOKENS",
    "LLM_TEMPERATURE",
    "CORS_ALLOW_ORIGINS",
    "VOLTMIND_SECRET_KEY",
    "DATA_DIR",
    "PROVIDER_STORE_PATH",
    "SECRET_KEY_PATH",
    "ALLOW_PRIVATE_BASE_URLS",
)


@pytest.fixture()
def isolated_env(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """隔离本机环境变量与 .env 文件，保证默认值断言稳定。"""
    for name in CONFIG_KEYS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setattr("app.config.ENV_FILE", tmp_path / "absent.env")


def test_defaults_when_nothing_configured(isolated_env: None) -> None:
    resolved = Settings.from_env()

    assert resolved.deepseek_api_key == ""
    assert resolved.deepseek_base_url == DEFAULT_DEEPSEEK_BASE_URL
    assert resolved.deepseek_model == DEFAULT_DEEPSEEK_MODEL
    assert resolved.cors_allow_origins == DEFAULT_CORS_ALLOW_ORIGINS


def test_llm_settings_read_from_env(monkeypatch: pytest.MonkeyPatch, isolated_env: None) -> None:
    monkeypatch.setenv("DEEPSEEK_API_KEY", "sk-from-env")
    monkeypatch.setenv("DEEPSEEK_MODEL", "deepseek-reasoner")
    monkeypatch.setenv("LLM_MAX_TOKENS", "256")
    monkeypatch.setenv("LLM_TEMPERATURE", "0.2")
    monkeypatch.setenv("LLM_TIMEOUT_SECONDS", "12.5")

    resolved = Settings.from_env()

    assert resolved.deepseek_api_key == "sk-from-env"
    assert resolved.deepseek_model == "deepseek-reasoner"
    assert resolved.llm_max_tokens == 256
    assert resolved.llm_temperature == 0.2
    assert resolved.llm_timeout_seconds == 12.5


def test_invalid_number_raises_clear_error(
    monkeypatch: pytest.MonkeyPatch, isolated_env: None
) -> None:
    monkeypatch.setenv("LLM_MAX_TOKENS", "abc")

    with pytest.raises(ValueError, match="LLM_MAX_TOKENS"):
        Settings.from_env()


def test_cors_origins_read_from_env(monkeypatch: pytest.MonkeyPatch, isolated_env: None) -> None:
    monkeypatch.setenv(
        "CORS_ALLOW_ORIGINS",
        " http://a.test , http://b.test ,http://a.test, ",
    )

    resolved = Settings.from_env()

    # 去空白、去重、保留书写顺序
    assert resolved.cors_allow_origins == ("http://a.test", "http://b.test")


def test_cors_origins_ignore_blank_value(
    monkeypatch: pytest.MonkeyPatch, isolated_env: None
) -> None:
    monkeypatch.setenv("CORS_ALLOW_ORIGINS", "   ")

    assert Settings.from_env().cors_allow_origins == DEFAULT_CORS_ALLOW_ORIGINS


def test_api_key_is_hidden_from_repr(isolated_env: None) -> None:
    """密钥不应随 repr 进入日志。"""
    resolved = Settings(deepseek_api_key="sk-must-not-be-printed")

    assert "sk-must-not-be-printed" not in repr(resolved)


def test_provider_defaults_when_nothing_configured(isolated_env: None) -> None:
    resolved = Settings.from_env()

    assert resolved.secret_key == ""
    assert resolved.provider_store_path == resolved.data_dir / "model_providers.json"
    assert resolved.secret_key_path == resolved.data_dir / ".secret_key"
    # 默认拒绝内网 Base URL，避免开箱即用的 SSRF 风险
    assert resolved.allow_private_base_urls is False


def test_provider_settings_read_from_env(
    monkeypatch: pytest.MonkeyPatch, isolated_env: None, tmp_path: Path
) -> None:
    monkeypatch.setenv("VOLTMIND_SECRET_KEY", "env-master-key")
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    monkeypatch.setenv("ALLOW_PRIVATE_BASE_URLS", "true")

    resolved = Settings.from_env()

    assert resolved.secret_key == "env-master-key"
    assert resolved.data_dir == tmp_path
    assert resolved.provider_store_path == tmp_path / "model_providers.json"
    assert resolved.allow_private_base_urls is True


def test_provider_store_path_can_be_placed_elsewhere(
    monkeypatch: pytest.MonkeyPatch, isolated_env: None, tmp_path: Path
) -> None:
    monkeypatch.setenv("DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("PROVIDER_STORE_PATH", str(tmp_path / "custom" / "store.json"))

    resolved = Settings.from_env()

    assert resolved.provider_store_path == tmp_path / "custom" / "store.json"


def test_invalid_boolean_raises_clear_error(
    monkeypatch: pytest.MonkeyPatch, isolated_env: None
) -> None:
    monkeypatch.setenv("ALLOW_PRIVATE_BASE_URLS", "maybe")

    with pytest.raises(ValueError, match="ALLOW_PRIVATE_BASE_URLS"):
        Settings.from_env()


def test_secret_key_is_hidden_from_repr(isolated_env: None) -> None:
    """主口令同样不应随 repr 进入日志。"""
    resolved = Settings(secret_key="master-key-must-not-be-printed")

    assert "master-key-must-not-be-printed" not in repr(resolved)


def test_no_hardcoded_api_key_in_source() -> None:
    """守住“禁止硬编码”：源码里不允许出现密钥字面量。"""
    offenders = sorted(
        path.name
        for path in (SERVICE_ROOT / "app").rglob("*.py")
        if SECRET_PATTERN.search(path.read_text(encoding="utf-8"))
    )

    assert offenders == []
