"""健康检查响应模型，同时作为与 Java 业务服务之间的接口契约。"""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    """服务健康状态。"""

    status: Literal["ok", "degraded", "down"] = Field(description="服务整体状态")
    service: str = Field(description="服务名")
    version: str = Field(description="服务版本")
    environment: str = Field(description="运行环境标识")
    uptime_seconds: float = Field(description="进程已运行秒数")
    timestamp: datetime = Field(description="服务端当前时间（UTC）")
