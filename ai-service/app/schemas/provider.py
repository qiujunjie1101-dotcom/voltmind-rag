"""模型供应商管理的请求与响应契约。

安全约定：任何响应都不包含明文 API Key，只回「是否已配置」与脱敏串。
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

PROVIDER_NAME_MAX_LENGTH = 40
BASE_URL_MAX_LENGTH = 300
API_KEY_MAX_LENGTH = 400
MODEL_ID_MAX_LENGTH = 120
MODEL_NAME_MAX_LENGTH = 60
MAX_MODELS_PER_PROVIDER = 50

Protocol = Literal["openai"]


class ProviderModelInput(BaseModel):
    """提交一个模型：model 是上游模型 ID，name 省略时用模型 ID 兜底。"""

    model_config = ConfigDict(extra="forbid")

    model: str = Field(min_length=1, max_length=MODEL_ID_MAX_LENGTH, description="上游模型 ID")
    name: str | None = Field(default=None, max_length=MODEL_NAME_MAX_LENGTH)

    @field_validator("model", "name")
    @classmethod
    def _strip_and_reject_control(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if any(ord(char) < 32 for char in stripped):
            raise ValueError("不能包含控制字符")
        return stripped


class ProviderCreate(BaseModel):
    """新增供应商。api_key 必填，避免建出无法使用的空配置。"""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=PROVIDER_NAME_MAX_LENGTH)
    base_url: str = Field(min_length=1, max_length=BASE_URL_MAX_LENGTH)
    api_key: str = Field(min_length=1, max_length=API_KEY_MAX_LENGTH)
    protocol: Protocol = "openai"
    models: list[ProviderModelInput] = Field(min_length=1, max_length=MAX_MODELS_PER_PROVIDER)

    @field_validator("name", "base_url", "api_key")
    @classmethod
    def _strip(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("不能为空白字符")
        return stripped


class ProviderUpdate(BaseModel):
    """编辑供应商。字段为 None 表示不修改，models 为整体替换。"""

    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, max_length=PROVIDER_NAME_MAX_LENGTH)
    base_url: str | None = Field(default=None, max_length=BASE_URL_MAX_LENGTH)
    api_key: str | None = Field(default=None, max_length=API_KEY_MAX_LENGTH)
    models: list[ProviderModelInput] | None = Field(
        default=None, min_length=1, max_length=MAX_MODELS_PER_PROVIDER
    )

    @field_validator("name", "base_url", "api_key")
    @classmethod
    def _strip(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("不能为空白字符")
        return stripped


class ProviderModelView(BaseModel):
    """返回给前端的模型条目。"""

    id: str = Field(description="模型条目 ID，请求对话时回传")
    model: str = Field(description="上游模型 ID")
    name: str = Field(description="展示名称")


class ProviderView(BaseModel):
    """供应商详情。不含明文密钥，只给配置状态与脱敏串。"""

    id: str
    name: str
    base_url: str
    protocol: str
    api_key_configured: bool = Field(description="服务端是否已保存可用密钥")
    api_key_masked: str | None = Field(default=None, description="脱敏后的密钥预览")
    models: list[ProviderModelView]
    created_at: str
    updated_at: str
    is_builtin: bool = Field(description="内置供应商由环境变量提供，不可编辑或删除")


class ProviderListResponse(BaseModel):
    """供应商列表。内置供应商始终排在首位。"""

    providers: list[ProviderView]


class ModelOptionView(BaseModel):
    """对话页模型选择器的一个选项。"""

    provider_id: str
    provider_name: str
    model_id: str = Field(description="模型条目 ID")
    model: str = Field(description="上游模型 ID")
    name: str = Field(description="展示名称")
    is_default: bool = Field(description="未指定模型时的默认选择")


class ModelOptionListResponse(BaseModel):
    """可用模型列表，只包含服务端确实能调用的模型。"""

    models: list[ModelOptionView]
    default_provider_id: str | None = Field(default=None, description="默认模型所属供应商")
    default_model_id: str | None = Field(default=None, description="默认模型的条目 ID")
