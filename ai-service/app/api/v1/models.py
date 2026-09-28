"""可用模型列表接口。

对话页的模型选择器用它取数据。只返回服务端确实能调用的模型：
内置模型要求环境变量里配了 Key，自定义模型要求密钥可解密。
"""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app.schemas.provider import ModelOptionListResponse
from app.services.provider_service import ProviderService, get_provider_service

router = APIRouter(prefix="/models", tags=["models"])


@router.get(
    "",
    response_model=ModelOptionListResponse,
    summary="可用模型列表",
    description="返回可用于对话的模型选项与默认选择，供前端模型选择器使用。",
)
def list_models(
    service: ProviderService = Depends(get_provider_service),
) -> ModelOptionListResponse:
    return service.list_model_options()
