"""自定义供应商 API Key 的服务端加解密。

明文 Key 只存在于内存与发往上游的请求头里，落盘一律为 Fernet 密文：

- 主口令优先取环境变量 ``VOLTMIND_SECRET_KEY``（部署推荐，任意长度字符串）；
- 未设置时首次运行自动生成随机口令并写入 ``data/.secret_key``（权限 0600），
  本地开发开箱可用，生产环境必须改为环境变量注入。

主口令本身不落库、不进日志，``SecretBox`` 的 repr 也不包含它。
"""

from __future__ import annotations

import base64
import hashlib
import logging
import os
import secrets
import threading
from pathlib import Path

from cryptography.fernet import Fernet, InvalidToken

from app.config import Settings

logger = logging.getLogger(__name__)

MASTER_KEY_ENV = "VOLTMIND_SECRET_KEY"
CIPHERTEXT_PREFIX = "v1:"
# 固定盐：本场景是单机单口令派生，不涉及多用户口令库，固定盐不会带来彩虹表风险
_KDF_SALT = b"voltmind-ai-service/provider-secrets/v1"
_KDF_ITERATIONS = 200_000
# 脱敏时保留的可辨识首尾长度，短密钥一律整体遮蔽
_MASK_HEAD = 3
_MASK_TAIL = 4
_MASK_MIN_LENGTH = 12
_FULL_MASK = "••••••••"

_key_lock = threading.Lock()


def derive_fernet_key(passphrase: str) -> bytes:
    """把任意长度口令派生为 Fernet 需要的 32 字节 urlsafe base64 密钥。"""
    digest = hashlib.pbkdf2_hmac(
        "sha256", passphrase.encode("utf-8"), _KDF_SALT, _KDF_ITERATIONS, dklen=32
    )
    return base64.urlsafe_b64encode(digest)


def mask_secret(secret: str) -> str:
    """生成可展示的脱敏串，只保留足以辨认是哪个 Key 的首尾字符。"""
    value = (secret or "").strip()
    if not value:
        return ""
    if len(value) < _MASK_MIN_LENGTH:
        return _FULL_MASK
    return f"{value[:_MASK_HEAD]}…{value[-_MASK_TAIL:]}"


def resolve_master_passphrase(settings: Settings) -> str:
    """取主口令：环境变量优先，否则读取或生成密钥文件。"""
    configured = settings.secret_key.strip()
    if configured:
        return configured

    path = Path(settings.secret_key_path)
    with _key_lock:
        if path.exists():
            stored = path.read_text(encoding="utf-8").strip()
            if stored:
                return stored
        generated = secrets.token_urlsafe(48)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(generated, encoding="utf-8")
        _restrict_permissions(path)
        logger.info(
            "未设置 %s，已生成本地密钥文件 %s；部署环境请改用环境变量注入。",
            MASTER_KEY_ENV,
            path,
        )
        return generated


def _restrict_permissions(path: Path) -> None:
    """尽力收紧密钥文件权限，Windows 上 chmod 语义有限，失败不影响启动。"""
    try:
        os.chmod(path, 0o600)
    except OSError:  # pragma: no cover - 平台差异，不影响功能
        logger.warning("无法收紧 %s 的文件权限，请手工确认访问范围", path)


class SecretBox:
    """对称加解密封装。密钥不明文暴露，只提供密文的生成与还原。"""

    def __init__(self, key: bytes) -> None:
        self._fernet = Fernet(key)

    @classmethod
    def from_settings(cls, settings: Settings) -> "SecretBox":
        return cls(derive_fernet_key(resolve_master_passphrase(settings)))

    def encrypt(self, plaintext: str) -> str:
        token = self._fernet.encrypt(plaintext.encode("utf-8")).decode("ascii")
        return f"{CIPHERTEXT_PREFIX}{token}"

    def decrypt(self, ciphertext: str) -> str | None:
        """解密失败返回 None，由调用方按“密钥不可用”处理，不中断整个服务。"""
        if not ciphertext:
            return None
        token = ciphertext.removeprefix(CIPHERTEXT_PREFIX)
        try:
            return self._fernet.decrypt(token.encode("ascii")).decode("utf-8")
        except (InvalidToken, ValueError, UnicodeDecodeError):
            logger.warning("供应商密钥解密失败，可能是主口令已变更，需要重新填写 API Key")
            return None
