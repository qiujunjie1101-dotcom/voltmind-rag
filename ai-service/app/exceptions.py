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


class DocumentParsingError(ServiceError):
    """不可信文档无法转换为统一文本结构。"""

    code = "DOCUMENT_PARSE_FAILED"
    http_status = 422


class EmptyDocumentError(DocumentParsingError):
    """上传文件没有任何字节。"""

    code = "EMPTY_FILE"
    http_status = 400

    def __init__(self) -> None:
        super().__init__("Document file must not be empty")


class DocumentTooLargeError(DocumentParsingError):
    """文件超过解析器允许的字节上限。"""

    code = "FILE_TOO_LARGE"
    http_status = 413

    def __init__(self) -> None:
        super().__init__("Document exceeds the configured size limit")


class UnsupportedDocumentTypeError(DocumentParsingError):
    """文件扩展名不在解析白名单中。"""

    code = "UNSUPPORTED_FILE_TYPE"
    http_status = 415

    def __init__(self) -> None:
        super().__init__("Only PDF, DOCX, Markdown and TXT files are supported")


class CorruptDocumentError(DocumentParsingError):
    """文件格式损坏或内容与声明格式不一致。"""

    def __init__(self) -> None:
        super().__init__("Document cannot be parsed")


class EncryptedPdfError(DocumentParsingError):
    """第一版不接受需要密码的 PDF。"""

    code = "PDF_ENCRYPTED"

    def __init__(self) -> None:
        super().__init__("Encrypted PDF files are not supported")


class NoTextContentError(DocumentParsingError):
    """文件可读取，但没有可用于后续切片的有效文本。"""

    code = "EMPTY_DOCUMENT_CONTENT"

    def __init__(self) -> None:
        super().__init__("Document content is empty")


class TextDecodingError(DocumentParsingError):
    """文本文件不是合法 UTF-8，禁止用替换字符静默吞错。"""

    code = "TEXT_DECODING_FAILED"

    def __init__(self) -> None:
        super().__init__("Text document is not valid UTF-8")


class ParsingResourceLimitError(DocumentParsingError):
    """文件虽然未超过上传大小，但展开或解析结果超过资源预算。"""

    code = "DOCUMENT_RESOURCE_LIMIT_EXCEEDED"

    def __init__(self) -> None:
        super().__init__("Document exceeds parsing resource limits")
