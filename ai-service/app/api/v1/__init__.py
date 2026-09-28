"""v1 版本接口聚合。"""
from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import chat, models, providers

API_V1_PREFIX = "/api/v1"

api_router = APIRouter(prefix=API_V1_PREFIX)
api_router.include_router(chat.router)
api_router.include_router(providers.router)
api_router.include_router(models.router)

__all__ = ["API_V1_PREFIX", "api_router"]
