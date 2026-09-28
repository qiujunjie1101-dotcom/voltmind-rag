"""AI 服务入口。

启动方式：
    uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api import docs, health
from app.api.v1 import api_router
from app.config import settings
from app.exceptions import ServiceError
from app.services.chat_service import close_chat_service

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    """应用启动与关闭时的资源管理。"""
    logger.info(
        "AI 服务启动：%s v%s（env=%s）", settings.app_name, __version__, settings.environment
    )
    logger.info("CORS 允许来源：%s", "，".join(settings.cors_allow_origins))
    yield
    await close_chat_service()
    logger.info("AI 服务已停止")


def _configure_cors(application: FastAPI) -> None:
    """允许本地前端开发地址跨域访问。

    只放行配置中列出的来源，不使用通配符：接口不带 Cookie 与鉴权，
    但通配来源会让任意站点都能读取响应，没有放行的必要。
    allow_credentials 保持 False，与显式来源列表配合，避免来源与凭证同时宽松。

    方法需要覆盖供应商管理的全部动词：浏览器对 PUT/DELETE 会先发预检，
    预检不通过时请求根本不会发出，界面上的编辑与删除会静默失败。
    """
    application.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_allow_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Accept"],
        max_age=600,
    )


def _register_exception_handlers(application: FastAPI) -> None:
    """把业务异常统一转成 JSON 错误响应，避免内部细节与堆栈外泄。"""

    @application.exception_handler(ServiceError)
    async def handle_service_error(_: Request, exc: ServiceError) -> JSONResponse:
        logger.warning("业务异常 %s：%s", type(exc).__name__, exc.message)
        return JSONResponse(status_code=exc.http_status, content={"detail": exc.message})


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用。"""
    application = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="VoltMind RAG AI 服务，负责检索增强生成相关能力。",
        lifespan=lifespan,
    )
    # CORS 中间件要在路由之前装配，浏览器预检请求由它直接响应
    _configure_cors(application)
    application.include_router(health.router)
    application.include_router(api_router)
    application.include_router(docs.router)
    _register_exception_handlers(application)
    return application


app = create_app()
