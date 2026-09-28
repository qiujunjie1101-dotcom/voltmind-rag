"""统一错误响应契约。"""

from __future__ import annotations

from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """与 FastAPI 默认错误结构保持一致，便于调用方统一处理。"""

    detail: str = Field(description="错误说明")
