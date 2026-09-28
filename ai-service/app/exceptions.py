"""业务异常与 HTTP 状态码映射。

服务层只抛出这里的异常，接口层与异常处理器据此返回状态码，
使上层不依赖 openai 的具体异常类型。
"""

from __future__ import annotations


class ServiceError(Exception):
    """业务异常基类，http_status 决定接口返回的状态码。"""

    http_status: int = 500

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ChatError(ServiceError):
    """聊天能力异常基类。"""


class ChatConfigurationError(ChatError):
    """服务端缺少必要配置，属于部署问题，不是调用方的错。"""

    http_status = 503


class ChatTimeoutError(ChatError):
    """上游模型服务响应超时。"""

    http_status = 504


class ChatRateLimitError(ChatError):
    """上游模型服务触发限流。"""

    http_status = 429


class ChatUpstreamError(ChatError):
    """上游模型服务不可用、认证失败或返回异常结果。"""

    http_status = 502


class ChatModelError(ChatError):
    """请求指定的供应商或模型不可用，属于调用方需要修正的选择。"""

    http_status = 400


class ProviderError(ServiceError):
    """模型供应商管理异常基类。"""


class ProviderValidationError(ProviderError):
    """供应商配置非法或不允许修改（含内置供应商）。"""

    http_status = 400


class ProviderNotFoundError(ProviderError):
    """供应商不存在。"""

    http_status = 404


class ProviderStoreError(ProviderError):
    """配置文件损坏或读写失败，属于服务端问题。"""

    http_status = 500
