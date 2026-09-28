"""服务配置。

读取顺序：进程环境变量 > ai-service/.env 文件 > 代码内默认值。
密钥只放在 .env（不入库），代码中不出现任何硬编码的 Key。
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

SERVICE_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = SERVICE_ROOT / ".env"

DEFAULT_APP_NAME = "voltmind-ai-service"
DEFAULT_ENVIRONMENT = "local"
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com"
DEFAULT_DEEPSEEK_MODEL = "deepseek-chat"
DEFAULT_LLM_TIMEOUT_SECONDS = 30.0
DEFAULT_LLM_MAX_TOKENS = 1024
DEFAULT_LLM_TEMPERATURE = 0.7

# 自定义模型供应商：配置与密钥都落在 data/ 目录，该目录不入库。
DEFAULT_DATA_DIR = SERVICE_ROOT / "data"
DEFAULT_PROVIDER_STORE_NAME = "model_providers.json"
DEFAULT_SECRET_KEY_NAME = ".secret_key"
# 默认拒绝指向内网的自定义 Base URL（防 SSRF）；本机自建推理服务需显式放开。
DEFAULT_ALLOW_PRIVATE_BASE_URLS = False

# 本地前端开发来源：voltmind-web 的 dev / preview 端口，以及 ai-workspace 的 dev 端口。
# 只列本地回环地址，生产环境必须通过 CORS_ALLOW_ORIGINS 显式指定。
DEFAULT_CORS_ALLOW_ORIGINS: tuple[str, ...] = (
    "http://127.0.0.1:5174",
    "http://localhost:5174",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
    "http://localhost:5173",
)


def load_env_file() -> bool:
    """加载 .env。已存在的进程环境变量优先，不会被文件覆盖。"""
    return load_dotenv(ENV_FILE, override=False)


def _env_str(name: str, default: str) -> str:
    value = os.getenv(name)
    return value if value and value.strip() else default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return int(raw)
    except ValueError:
        raise ValueError(f"环境变量 {name} 需要是整数，当前值为 {raw!r}") from None


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    try:
        return float(raw)
    except ValueError:
        raise ValueError(f"环境变量 {name} 需要是数字，当前值为 {raw!r}") from None


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    normalized = raw.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"环境变量 {name} 需要是布尔值（true/false），当前值为 {raw!r}")


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    return Path(raw.strip()) if raw and raw.strip() else default


def _env_list(name: str, default: tuple[str, ...]) -> tuple[str, ...]:
    """解析逗号分隔的列表，忽略空白项并去掉重复。"""
    raw = os.getenv(name)
    if raw is None or not raw.strip():
        return default
    items = [item.strip() for item in raw.split(",") if item.strip()]
    if not items:
        return default
    # 去重但保留书写顺序
    return tuple(dict.fromkeys(items))


@dataclass(frozen=True)
class Settings:
    """服务运行参数。"""

    app_name: str = DEFAULT_APP_NAME
    environment: str = DEFAULT_ENVIRONMENT
    host: str = DEFAULT_HOST
    port: int = DEFAULT_PORT
    # repr=False 避免密钥随日志或异常信息被打印出来
    deepseek_api_key: str = field(default="", repr=False)
    deepseek_base_url: str = DEFAULT_DEEPSEEK_BASE_URL
    deepseek_model: str = DEFAULT_DEEPSEEK_MODEL
    llm_timeout_seconds: float = DEFAULT_LLM_TIMEOUT_SECONDS
    llm_max_tokens: int = DEFAULT_LLM_MAX_TOKENS
    llm_temperature: float = DEFAULT_LLM_TEMPERATURE
    cors_allow_origins: tuple[str, ...] = DEFAULT_CORS_ALLOW_ORIGINS
    # 加密自定义供应商密钥的主口令，只从环境读取，不进 repr
    secret_key: str = field(default="", repr=False)
    data_dir: Path = DEFAULT_DATA_DIR
    provider_store_path: Path = DEFAULT_DATA_DIR / DEFAULT_PROVIDER_STORE_NAME
    secret_key_path: Path = DEFAULT_DATA_DIR / DEFAULT_SECRET_KEY_NAME
    allow_private_base_urls: bool = DEFAULT_ALLOW_PRIVATE_BASE_URLS

    @classmethod
    def from_env(cls) -> "Settings":
        load_env_file()
        data_dir = _env_path("DATA_DIR", DEFAULT_DATA_DIR)
        return cls(
            app_name=_env_str("APP_NAME", DEFAULT_APP_NAME),
            environment=_env_str("APP_ENV", DEFAULT_ENVIRONMENT),
            host=_env_str("HOST", DEFAULT_HOST),
            port=_env_int("PORT", DEFAULT_PORT),
            deepseek_api_key=_env_str("DEEPSEEK_API_KEY", ""),
            deepseek_base_url=_env_str("DEEPSEEK_BASE_URL", DEFAULT_DEEPSEEK_BASE_URL),
            deepseek_model=_env_str("DEEPSEEK_MODEL", DEFAULT_DEEPSEEK_MODEL),
            llm_timeout_seconds=_env_float("LLM_TIMEOUT_SECONDS", DEFAULT_LLM_TIMEOUT_SECONDS),
            llm_max_tokens=_env_int("LLM_MAX_TOKENS", DEFAULT_LLM_MAX_TOKENS),
            llm_temperature=_env_float("LLM_TEMPERATURE", DEFAULT_LLM_TEMPERATURE),
            cors_allow_origins=_env_list("CORS_ALLOW_ORIGINS", DEFAULT_CORS_ALLOW_ORIGINS),
            secret_key=_env_str("VOLTMIND_SECRET_KEY", ""),
            data_dir=data_dir,
            provider_store_path=_env_path(
                "PROVIDER_STORE_PATH", data_dir / DEFAULT_PROVIDER_STORE_NAME
            ),
            secret_key_path=_env_path("SECRET_KEY_PATH", data_dir / DEFAULT_SECRET_KEY_NAME),
            allow_private_base_urls=_env_bool(
                "ALLOW_PRIVATE_BASE_URLS", DEFAULT_ALLOW_PRIVATE_BASE_URLS
            ),
        )


settings = Settings.from_env()
