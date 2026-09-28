"""健康检查接口。

供 Java 业务服务探活与部署冒烟使用，只反映进程自身状态，
不承担业务逻辑；后续接入 Milvus、MySQL 等依赖时，再单独增加就绪检查。
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from app import __version__
from app.config import settings
from app.schemas.health import HealthResponse

# 服务启动时刻，用于计算 uptime
_STARTED_AT = datetime.now(timezone.utc)

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="服务健康检查")
async def health() -> HealthResponse:
    """返回服务存活状态与基础运行信息。"""
    now = datetime.now(timezone.utc)
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=__version__,
        environment=settings.environment,
        uptime_seconds=round((now - _STARTED_AT).total_seconds(), 3),
        timestamp=now,
    )
