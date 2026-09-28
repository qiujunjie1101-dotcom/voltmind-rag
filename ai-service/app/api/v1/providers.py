"""模型供应商管理接口。

安全约定（与《AI 服务接口契约》一致）：

- 响应里永远没有明文 API Key，只有 `api_key_configured` 与脱敏串；
- Base URL 在保存时校验，拒绝指向内网或保留地址（防 SSRF）；
- 内置供应商由环境变量提供，编辑与删除会被拒绝。

处理器写成同步函数：校验含 DNS 解析、存储是文件读写，交给 FastAPI 的线程池
执行，避免阻塞事件循环。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status

from app.schemas.error import ErrorResponse
from app.schemas.provider import (
    ProviderCreate,
    ProviderListResponse,
    ProviderUpdate,
    ProviderView,
)
from app.services.provider_service import ProviderService, get_provider_service

router = APIRouter(prefix="/providers", tags=["providers"])

_WRITE_ERROR_RESPONSES: dict[int | str, dict[str, object]] = {
    status.HTTP_400_BAD_REQUEST: {
        "model": ErrorResponse,
        "description": "配置不合法（名称重复、模型重复、Base URL 指向内网、修改内置供应商等）",
    },
    status.HTTP_404_NOT_FOUND: {
        "model": ErrorResponse,
        "description": "供应商不存在",
    },
}


@router.get(
    "",
    response_model=ProviderListResponse,
    summary="供应商列表",
    description="返回内置供应商与全部自定义供应商，按内置优先排序。",
)
def list_providers(
    service: ProviderService = Depends(get_provider_service),
) -> ProviderListResponse:
    """列出全部供应商，密钥只以脱敏状态出现。"""
    return ProviderListResponse(providers=service.list_providers())


@router.post(
    "",
    response_model=ProviderView,
    status_code=status.HTTP_201_CREATED,
    summary="新增供应商",
    description="创建一个 OpenAI 兼容供应商，api_key 加密后落盘，只返回脱敏状态。",
    responses=_WRITE_ERROR_RESPONSES,
)
def create_provider(
    payload: ProviderCreate,
    service: ProviderService = Depends(get_provider_service),
) -> ProviderView:
    return service.create_provider(payload)


@router.put(
    "/{provider_id}",
    response_model=ProviderView,
    summary="编辑供应商",
    description="未提交的字段保持原值；api_key 省略或为 null 时沿用已保存的密钥。",
    responses=_WRITE_ERROR_RESPONSES,
)
def update_provider(
    provider_id: str,
    payload: ProviderUpdate,
    service: ProviderService = Depends(get_provider_service),
) -> ProviderView:
    return service.update_provider(provider_id, payload)


@router.delete(
    "/{provider_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除供应商",
    description="删除供应商及其模型配置，内置供应商不可删除。",
    responses=_WRITE_ERROR_RESPONSES,
)
def delete_provider(
    provider_id: str,
    service: ProviderService = Depends(get_provider_service),
) -> Response:
    service.delete_provider(provider_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
