"""模型供应商业务服务。

职责边界：

- 供应商配置的增删改查，含名称唯一、模型去重、数量上限等业务规则；
- API Key 的加密落库与脱敏输出：本模块之外（接口层、前端、日志）都拿不到明文；
- 把「供应商 + 模型」解析成一次模型调用所需的 ``ChatConfig``，
  保证调用只能使用已保存的配置，请求方无法自带地址或密钥。

内置供应商（``builtin-deepseek``）由环境变量提供，只读、不可删改，
用于兼容既有 ``DEEPSEEK_*`` 配置：不传模型参数时仍按环境变量调用。
"""

from __future__ import annotations

import logging
import secrets
from pathlib import Path

from app.config import Settings, settings
from app.exceptions import (
    ChatConfigurationError,
    ChatModelError,
    ProviderNotFoundError,
    ProviderValidationError,
)
from app.schemas.provider import (
    ProviderCreate,
    ProviderModelInput,
    ProviderModelView,
    ProviderUpdate,
    ProviderView,
    ModelOptionListResponse,
    ModelOptionView,
)
from app.security.crypto import SecretBox, mask_secret
from app.security.url_guard import BaseUrlError, normalize_base_url
from app.services.chat_service import ChatConfig
from app.services.provider_store import (
    ProviderModelRecord,
    ProviderRecord,
    ProviderStore,
    utc_now,
)

logger = logging.getLogger(__name__)

BUILTIN_PROVIDER_ID = "builtin-deepseek"
BUILTIN_PROVIDER_NAME = "DeepSeek（内置）"
MAX_PROVIDERS = 20
_MISSING_SELECTION_HINT = (
    "未配置可用的模型服务：请在「设置 → 模型服务」新增供应商，"
    "或在 ai-service/.env 中配置 DEEPSEEK_API_KEY"
)


class ProviderService:
    """供应商配置的读写与模型解析。"""

    def __init__(
        self,
        store: ProviderStore,
        secret_box: SecretBox,
        settings: Settings,
        *,
        allow_private_base_urls: bool | None = None,
    ) -> None:
        self._store = store
        self._secret_box = secret_box
        self._settings = settings
        # 允许单独覆盖，便于测试构造非法地址场景
        self._allow_private = (
            settings.allow_private_base_urls
            if allow_private_base_urls is None
            else allow_private_base_urls
        )

    @property
    def store_path(self) -> Path:
        """配置文件位置，便于运维与测试确认落盘位置。"""
        return self._store.path

    # ---------- 读 ----------

    def list_providers(self) -> list[ProviderView]:
        """内置供应商排首位，其后是用户自定义供应商。"""
        views = [self._builtin_view()]
        views.extend(self._to_view(record) for record in self._store.list())
        return views

    def list_model_options(self) -> ModelOptionListResponse:
        """可用于对话的模型：内置需环境变量有 Key，自定义需密钥可解密。"""
        options: list[ModelOptionView] = []
        if self._settings.deepseek_api_key.strip():
            options.extend(
                ModelOptionView(
                    provider_id=BUILTIN_PROVIDER_ID,
                    provider_name=BUILTIN_PROVIDER_NAME,
                    model_id=model.id,
                    model=model.model,
                    name=model.name,
                    is_default=False,
                )
                for model in self._builtin_models()
            )

        for record in self._store.list():
            if not self._read_api_key(record):
                # 密钥缺失或解密失败时不进入选择器，避免用户选中后必然失败
                continue
            options.extend(
                ModelOptionView(
                    provider_id=record.id,
                    provider_name=record.name,
                    model_id=model.id,
                    model=model.model,
                    name=model.name,
                    is_default=False,
                )
                for model in record.models
            )

        if not options:
            return ModelOptionListResponse(models=[], default_provider_id=None, default_model_id=None)

        default = options[0].model_copy(update={"is_default": True})
        options[0] = default
        return ModelOptionListResponse(
            models=options,
            default_provider_id=default.provider_id,
            default_model_id=default.model_id,
        )

    # ---------- 写 ----------

    def create_provider(self, payload: ProviderCreate) -> ProviderView:
        records = self._store.list()
        if len(records) >= MAX_PROVIDERS:
            raise ProviderValidationError(f"供应商数量已达到上限 {MAX_PROVIDERS} 个")
        self._ensure_name_available(records, payload.name)
        record = ProviderRecord(
            id=secrets.token_hex(8),
            name=payload.name,
            base_url=self._validated_base_url(payload.base_url),
            protocol=payload.protocol,
            encrypted_api_key=self._secret_box.encrypt(payload.api_key),
            models=self._build_models(payload.models),
            created_at=utc_now(),
            updated_at=utc_now(),
        )
        return self._to_view(self._store.add(record))

    def update_provider(self, provider_id: str, payload: ProviderUpdate) -> ProviderView:
        """未提交的字段保持原值；api_key 为 None 表示沿用已保存的密钥。"""
        self._reject_builtin(provider_id)
        record = self._store.find(provider_id)
        if record is None:
            raise ProviderNotFoundError("供应商不存在或已被删除")

        if payload.name is not None:
            self._ensure_name_available(self._store.list(), payload.name, exclude_id=provider_id)

        updated = ProviderRecord(
            id=record.id,
            name=payload.name if payload.name is not None else record.name,
            base_url=(
                self._validated_base_url(payload.base_url)
                if payload.base_url is not None
                else record.base_url
            ),
            protocol=record.protocol,
            encrypted_api_key=(
                self._secret_box.encrypt(payload.api_key)
                if payload.api_key is not None
                else record.encrypted_api_key
            ),
            models=(
                self._build_models(payload.models)
                if payload.models is not None
                else record.models
            ),
            created_at=record.created_at,
            updated_at=utc_now(),
        )
        return self._to_view(self._store.replace(updated))

    def delete_provider(self, provider_id: str) -> None:
        self._reject_builtin(provider_id)
        if not self._store.remove(provider_id):
            raise ProviderNotFoundError("供应商不存在或已被删除")

    # ---------- 供对话使用 ----------

    def resolve_chat_config(self, provider_id: str | None, model_id: str | None) -> ChatConfig:
        """把请求里的模型选择解析成调用配置。

        只认已保存的配置：供应商、模型条目、地址与密钥全部来自服务端存储，
        请求方提供的字符串仅用于「查找」，不能直接变成调用参数。
        """
        if provider_id is None and model_id is None:
            return self._builtin_config(self._settings.deepseek_model)

        if provider_id == BUILTIN_PROVIDER_ID:
            builtin_model = self._settings.deepseek_model
            if model_id not in (None, builtin_model):
                raise ChatModelError("内置供应商只提供环境变量配置的模型，请重新选择")
            return self._builtin_config(builtin_model)

        if not provider_id or not model_id:
            raise ChatModelError("provider_id 与 model_id 需要同时提供")

        record = self._store.find(provider_id)
        if record is None:
            raise ChatModelError("选择的供应商不存在或已被删除，请重新选择模型")
        entry = next((item for item in record.models if item.id == model_id), None)
        if entry is None:
            raise ChatModelError("选择的模型已不存在，请重新选择模型")

        api_key = self._read_api_key(record)
        if not api_key:
            raise ChatConfigurationError(
                f"供应商「{record.name}」的 API Key 不可用，请在设置中重新填写"
            )

        try:
            base_url = normalize_base_url(record.base_url, allow_private=self._allow_private)
        except BaseUrlError as error:
            raise ChatConfigurationError(f"供应商「{record.name}」的 Base URL 不可用：{error}") from error

        return ChatConfig(
            api_key=api_key,
            base_url=base_url,
            model=entry.model,
            timeout_seconds=self._settings.llm_timeout_seconds,
            max_tokens=self._settings.llm_max_tokens,
            temperature=self._settings.llm_temperature,
        )

    # ---------- 内部 ----------

    def _builtin_config(self, model: str) -> ChatConfig:
        api_key = self._settings.deepseek_api_key.strip()
        if not api_key:
            raise ChatConfigurationError(_MISSING_SELECTION_HINT)
        return ChatConfig(
            api_key=api_key,
            base_url=self._settings.deepseek_base_url,
            model=model,
            timeout_seconds=self._settings.llm_timeout_seconds,
            max_tokens=self._settings.llm_max_tokens,
            temperature=self._settings.llm_temperature,
        )

    def _builtin_models(self) -> list[ProviderModelView]:
        """内置模型的展示名就是模型 ID。

        来源信息由供应商名（``DeepSeek（内置）``）与分组表达，
        不必再拼进模型名里，否则界面上会出现「模型名 · 来源」的冗余展示。
        """
        model = self._settings.deepseek_model
        return [ProviderModelView(id=model, model=model, name=model)]

    def _builtin_view(self) -> ProviderView:
        api_key = self._settings.deepseek_api_key
        configured = bool(api_key.strip())
        return ProviderView(
            id=BUILTIN_PROVIDER_ID,
            name=BUILTIN_PROVIDER_NAME,
            base_url=self._settings.deepseek_base_url,
            protocol="openai",
            api_key_configured=configured,
            api_key_masked=mask_secret(api_key) if configured else None,
            models=self._builtin_models(),
            created_at="",
            updated_at="",
            is_builtin=True,
        )

    def _to_view(self, record: ProviderRecord) -> ProviderView:
        api_key = self._read_api_key(record)
        return ProviderView(
            id=record.id,
            name=record.name,
            base_url=record.base_url,
            protocol=record.protocol,
            api_key_configured=bool(api_key),
            api_key_masked=mask_secret(api_key) if api_key else None,
            models=[
                ProviderModelView(id=item.id, model=item.model, name=item.name)
                for item in record.models
            ],
            created_at=record.created_at,
            updated_at=record.updated_at,
            is_builtin=False,
        )

    def _read_api_key(self, record: ProviderRecord) -> str:
        return (self._secret_box.decrypt(record.encrypted_api_key) or "").strip()

    def _validated_base_url(self, base_url: str) -> str:
        try:
            return normalize_base_url(base_url, allow_private=self._allow_private)
        except BaseUrlError as error:
            raise ProviderValidationError(str(error)) from error

    def _build_models(self, items: list[ProviderModelInput]) -> list[ProviderModelRecord]:
        records: list[ProviderModelRecord] = []
        seen: set[str] = set()
        for item in items:
            key = item.model.lower()
            if key in seen:
                raise ProviderValidationError(f"模型 ID「{item.model}」重复，请只保留一条")
            seen.add(key)
            records.append(
                ProviderModelRecord(
                    id=secrets.token_hex(8),
                    model=item.model,
                    name=(item.name or item.model).strip() or item.model,
                )
            )
        return records

    def _ensure_name_available(
        self, records: list[ProviderRecord], name: str, exclude_id: str | None = None
    ) -> None:
        lowered = name.lower()
        for record in records:
            if record.id == exclude_id:
                continue
            if record.name.lower() == lowered:
                raise ProviderValidationError(f"已存在同名供应商「{name}」，请换一个名称")

    def _reject_builtin(self, provider_id: str) -> None:
        if provider_id == BUILTIN_PROVIDER_ID:
            raise ProviderValidationError(
                "内置供应商由环境变量提供，不支持编辑或删除；如需调整请修改 ai-service/.env"
            )


_provider_service: ProviderService | None = None


def get_provider_service() -> ProviderService:
    """FastAPI 依赖：进程内复用同一实例，测试可整体覆盖。"""
    global _provider_service
    if _provider_service is None:
        _provider_service = ProviderService(
            store=ProviderStore(settings.provider_store_path),
            secret_box=SecretBox.from_settings(settings),
            settings=settings,
        )
    return _provider_service
