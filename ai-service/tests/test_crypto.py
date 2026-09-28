"""密钥加解密与脱敏测试。"""

from __future__ import annotations

from pathlib import Path

from app.security.crypto import (
    CIPHERTEXT_PREFIX,
    SecretBox,
    derive_fernet_key,
    mask_secret,
    resolve_master_passphrase,
)
from tests.conftest import TEST_MASTER_KEY, build_settings

PLAINTEXT = "provider-secret-value-1234567890"


def _box(passphrase: str = TEST_MASTER_KEY) -> SecretBox:
    return SecretBox(derive_fernet_key(passphrase))


def test_roundtrip_returns_original_plaintext() -> None:
    ciphertext = _box().encrypt(PLAINTEXT)

    assert _box().decrypt(ciphertext) == PLAINTEXT


def test_ciphertext_does_not_leak_plaintext() -> None:
    ciphertext = _box().encrypt(PLAINTEXT)

    assert PLAINTEXT not in ciphertext
    assert ciphertext.startswith(CIPHERTEXT_PREFIX)


def test_ciphertext_is_randomized() -> None:
    """同一明文两次加密结果不同，避免暴露「两个供应商用了同一密钥」。"""
    box = _box()

    assert box.encrypt(PLAINTEXT) != box.encrypt(PLAINTEXT)


def test_decrypt_with_other_passphrase_returns_none() -> None:
    ciphertext = _box("another-passphrase").encrypt(PLAINTEXT)

    assert _box().decrypt(ciphertext) is None


def test_decrypt_with_garbage_returns_none() -> None:
    assert _box().decrypt("v1:not-a-token") is None
    assert _box().decrypt("") is None


def test_mask_keeps_only_recognizable_edges() -> None:
    masked = mask_secret(PLAINTEXT)

    assert masked == f"{PLAINTEXT[:3]}…{PLAINTEXT[-4:]}"
    assert PLAINTEXT[10:20] not in masked


def test_mask_hides_short_secrets_entirely() -> None:
    assert mask_secret("short-key") == "••••••••"
    assert mask_secret("") == ""


def test_master_passphrase_prefers_env(tmp_path: Path) -> None:
    settings = build_settings(tmp_path, secret_key="from-environment")

    assert resolve_master_passphrase(settings) == "from-environment"
    # 环境变量已提供口令时不应落任何文件
    assert not settings.secret_key_path.exists()


def test_master_passphrase_file_is_generated_once(tmp_path: Path) -> None:
    settings = build_settings(tmp_path, secret_key="")

    first = resolve_master_passphrase(settings)
    second = resolve_master_passphrase(settings)

    assert first == second
    assert settings.secret_key_path.exists()
    assert settings.secret_key_path.read_text(encoding="utf-8").strip() == first


def test_generated_passphrase_encrypts_across_restarts(tmp_path: Path) -> None:
    """重启后仍能解开旧密文，取决于密钥文件被复用。"""
    settings = build_settings(tmp_path, secret_key="")
    ciphertext = SecretBox.from_settings(settings).encrypt(PLAINTEXT)

    assert SecretBox.from_settings(build_settings(tmp_path, secret_key="")).decrypt(ciphertext) == (
        PLAINTEXT
    )
