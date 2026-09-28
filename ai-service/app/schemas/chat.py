"""聊天接口的请求与响应契约。"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

QUESTION_MAX_LENGTH = 2000
ID_MAX_LENGTH = 64


class ChatRequest(BaseModel):
    """单轮问答请求。

    provider_id 与 model_id 是「设置 → 模型服务」中已保存条目的标识，
    只用于服务端查找配置；两者都不传时沿用环境变量里的默认模型。
    """

    # 拒绝未声明的字段，避免调用方拼错参数却以为生效
    model_config = ConfigDict(extra="forbid")

    question: str = Field(
        min_length=1,
        max_length=QUESTION_MAX_LENGTH,
        description="用户问题",
        examples=["什么是检索增强生成（RAG）？"],
    )
    provider_id: str | None = Field(
        default=None,
        max_length=ID_MAX_LENGTH,
        description="模型供应商 ID，需与 model_id 同时提供",
    )
    model_id: str | None = Field(
        default=None,
        max_length=ID_MAX_LENGTH,
        description="模型条目 ID，需与 provider_id 同时提供",
    )

    @field_validator("question")
    @classmethod
    def _reject_blank(cls, value: str) -> str:
        """去掉首尾空白，并拒绝纯空白输入。"""
        stripped = value.strip()
        if not stripped:
            raise ValueError("question 不能为空白字符")
        return stripped

    @field_validator("provider_id", "model_id")
    @classmethod
    def _normalize_optional_id(cls, value: str | None) -> str | None:
        """空字符串按未提供处理，避免前端把空值当作有效选择。"""
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            return None
        if any(ord(char) < 32 for char in stripped):
            raise ValueError("不能包含控制字符")
        return stripped

    @model_validator(mode="after")
    def _check_model_pair(self) -> "ChatRequest":
        if (self.provider_id is None) != (self.model_id is None):
            raise ValueError("provider_id 与 model_id 需要同时提供")
        return self


class ChatResponse(BaseModel):
    """单轮问答响应。"""

    answer: str = Field(description="模型回答")
