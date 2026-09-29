"""统一解析器接口、格式选择和资源限制。"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from app.exceptions import (
    DocumentTooLargeError,
    EmptyDocumentError,
    NoTextContentError,
    ParsingResourceLimitError,
    TextDecodingError,
    UnsupportedDocumentTypeError,
)
from app.parsing.schemas import DocumentFileType, ParsedDocument

MEBIBYTE = 1024 * 1024


@dataclass(frozen=True, slots=True)
class ParsingLimits:
    """单次同步解析的资源预算，可在测试或后续配置层覆盖。"""

    max_file_size_bytes: int = 20 * MEBIBYTE
    max_pdf_pages: int = 2_000
    max_docx_entries: int = 10_000
    max_docx_uncompressed_bytes: int = 100 * MEBIBYTE
    max_blocks: int = 100_000
    max_extracted_characters: int = 20_000_000


class FileParser(Protocol):
    """单一格式解析器需要实现的最小接口。"""

    file_type: DocumentFileType

    def parse(self, document_id: int, content: bytes) -> ParsedDocument:
        """把文件字节转换为按原文排序的 ParsedDocument。"""


class DocumentParser:
    """按安全文件扩展名选择解析器，并执行通用输入限制。"""

    _EXTENSION_TYPES: dict[str, DocumentFileType] = {
        ".pdf": "PDF",
        ".docx": "DOCX",
        ".md": "MARKDOWN",
        ".markdown": "MARKDOWN",
        ".txt": "TXT",
    }

    def __init__(
        self,
        limits: ParsingLimits | None = None,
        parsers: dict[DocumentFileType, FileParser] | None = None,
    ) -> None:
        self.limits = limits or ParsingLimits()
        if parsers is None:
            from app.parsing.docx_parser import DocxParser
            from app.parsing.markdown_parser import MarkdownParser
            from app.parsing.pdf_parser import PdfParser
            from app.parsing.text_parser import TextParser

            parsers = {
                "PDF": PdfParser(self.limits),
                "DOCX": DocxParser(self.limits),
                "MARKDOWN": MarkdownParser(self.limits),
                "TXT": TextParser(self.limits),
            }
        self._parsers = parsers

    def parse(self, document_id: int, file_name: str, content: bytes) -> ParsedDocument:
        """校验输入并委派给对应格式解析器。"""
        if document_id <= 0:
            raise ValueError("document_id must be positive")
        if not isinstance(content, bytes):
            raise TypeError("content must be bytes")
        if not content:
            raise EmptyDocumentError()
        if len(content) > self.limits.max_file_size_bytes:
            raise DocumentTooLargeError()
        file_type = self._resolve_file_type(file_name)
        return self._parsers[file_type].parse(document_id, content)

    def _resolve_file_type(self, file_name: str) -> DocumentFileType:
        normalized = file_name.strip()
        if (
            not normalized
            or "/" in normalized
            or "\\" in normalized
            or "\0" in normalized
            or ".." in normalized
        ):
            raise UnsupportedDocumentTypeError()
        dot = normalized.rfind(".")
        extension = normalized[dot:].lower() if dot >= 0 else ""
        try:
            return self._EXTENSION_TYPES[extension]
        except KeyError:
            raise UnsupportedDocumentTypeError() from None


def decode_utf8(content: bytes) -> str:
    """严格解码 UTF-8，并自动移除 UTF-8 BOM。"""
    try:
        return content.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise TextDecodingError() from None


class ParseBudget:
    """边解析边累计块数与字符数，尽早终止异常展开。"""

    def __init__(self, limits: ParsingLimits) -> None:
        self._limits = limits
        self._blocks = 0
        self._characters = 0

    def consume(self, text: str) -> None:
        self._blocks += 1
        self._characters += len(text)
        if (
            self._blocks > self._limits.max_blocks
            or self._characters > self._limits.max_extracted_characters
        ):
            raise ParsingResourceLimitError()


def require_text(block_count: int) -> None:
    """所有格式共享的无有效文本判定。"""
    if block_count == 0:
        raise NoTextContentError()
