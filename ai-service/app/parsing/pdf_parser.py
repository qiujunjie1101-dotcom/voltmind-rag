"""文本型 PDF 解析器；第一版不执行 OCR。"""

from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader
from app.exceptions import (
    CorruptDocumentError,
    DocumentParsingError,
    EncryptedPdfError,
    ParsingResourceLimitError,
)
from app.parsing.parser import ParseBudget, ParsingLimits, require_text
from app.parsing.schemas import ParsedBlock, ParsedDocument


class PdfParser:
    """按真实页面顺序提取文本，每页最多生成一个 ParsedBlock。"""

    file_type = "PDF"

    def __init__(self, limits: ParsingLimits) -> None:
        self._limits = limits

    def parse(self, document_id: int, content: bytes) -> ParsedDocument:
        if b"%PDF-" not in content[:1024]:
            raise CorruptDocumentError()
        try:
            reader = PdfReader(BytesIO(content), strict=False)
            if reader.is_encrypted:
                raise EncryptedPdfError()
            if len(reader.pages) > self._limits.max_pdf_pages:
                raise ParsingResourceLimitError()

            blocks: list[ParsedBlock] = []
            budget = ParseBudget(self._limits)
            for page_number, page in enumerate(reader.pages, start=1):
                extracted = page.extract_text() or ""
                text = extracted.strip()
                if not text:
                    continue
                budget.consume(text)
                blocks.append(ParsedBlock(text=text, page_number=page_number, section=None))
            require_text(len(blocks))
            return ParsedDocument(document_id=document_id, file_type=self.file_type, blocks=blocks)
        except DocumentParsingError:
            raise
        except Exception:
            # pypdf 可能因损坏的对象、流或交叉引用抛出不同底层异常，统一隐藏细节
            raise CorruptDocumentError() from None
