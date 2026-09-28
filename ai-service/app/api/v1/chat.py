"""聊天接口。"""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from fastapi.concurrency import run_in_threadpool

from app.schemas.chat import ChatRequest, ChatResponse
from app.schemas.error import ErrorResponse
from app.services.chat_service import ChatService, get_chat_service
from app.services.provider_service import ProviderService, get_provider_service

router = APIRouter(prefix="/chat", tags=["chat"])

_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status.HTTP_400_BAD_REQUEST: {
        "model": ErrorResponse,
        "description": "指定的供应商或模型不存在，需要重新选择",
    },
    status.HTTP_429_TOO_MANY_REQUESTS: {
        "model": ErrorResponse,
        "description": "上游模型服务限流",
    },
    status.HTTP_502_BAD_GATEWAY: {
        "model": ErrorResponse,
        "description": "上游模型服务不可用、认证失败或返回异常结果",
    },
    status.HTTP_503_SERVICE_UNAVAILABLE: {
        "model": ErrorResponse,
        "description": "服务端缺少可用的模型配置（未选模型且未配置 DEEPSEEK_API_KEY 等）",
    },
    status.HTTP_504_GATEWAY_TIMEOUT: {
        "model": ErrorResponse,
        "description": "上游模型服务响应超时",
    },
}


@router.post(
    "",
    response_model=ChatResponse,
    summary="单轮问答",
    description=(
        "接收 question，按 provider_id + model_id 使用已保存的供应商配置调用模型；"
        "两个模型参数都不传时使用环境变量里的默认模型。"
    ),
    responses=_ERROR_RESPONSES,
)
async def chat(
    payload: ChatRequest,
    service: ChatService = Depends(get_chat_service),
    providers: ProviderService = Depends(get_provider_service),
) -> ChatResponse:
    """把用户问题交给模型，返回模型回答。

    模型配置只从服务端存储解析，请求内容无法指定任意地址或密钥；
    解析含域名校验，放进线程池执行以免阻塞事件循环。
    上游失败时由统一的异常处理器转换为对应状态码，本函数不做状态码判断。
    """
    config = await run_in_threadpool(
        providers.resolve_chat_config, payload.provider_id, payload.model_id
    )
    answer = await service.ask(payload.question, config=config)
    return ChatResponse(answer=answer)
