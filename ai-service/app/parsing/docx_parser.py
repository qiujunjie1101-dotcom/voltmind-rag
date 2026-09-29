"""DOCX 段落、标题和表格解析器。"""

from __future__ import annotations

import re
from io import BytesIO
from zipfile import BadZipFile, ZipFile

from docx import Document as open_docx
from docx.oxml.table import CT_Tbl
from docx.oxml.text.paragraph import CT_P
from docx.table import Table
from docx.text.paragraph import Paragraph

from app.exceptions import CorruptDocumentError, DocumentParsingError, ParsingResourceLimitError
from app.parsing.parser import ParseBudget, ParsingLimits, require_text
from app.parsing.schemas import ParsedBlock, ParsedDocument

_HEADING_STYLE = re.compile(r"^Heading ([1-9])$")
_REQUIRED_PARTS = {"[Content_Types].xml", "word/document.xml"}


class DocxParser:
    """按 document.xml 中段落和表格的实际先后顺序提取文本。"""

    file_type = "DOCX"

    def __init__(self, limits: ParsingLimits) -> None:
        self._limits = limits

    def parse(self, document_id: int, content: bytes) -> ParsedDocument:
        self._validate_archive(content)
        try:
            document = open_docx(BytesIO(content))
            blocks: list[ParsedBlock] = []
            headings: list[tuple[int, str]] = []
            budget = ParseBudget(self._limits)

            for element in document.element.body.iterchildren():
                if isinstance(element, CT_P):
                    paragraph = Paragraph(element, document)
                    text = paragraph.text.strip()
                    if not text:
                        continue
                    level = self._heading_level(paragraph)
                    if level is not None:
                        while headings and headings[-1][0] >= level:
                            headings.pop()
                        headings.append((level, text))
                    self._append(blocks, budget, text, self._section(headings))
                elif isinstance(element, CT_Tbl):
                    table_text = self._table_text(Table(element, document))
                    if table_text:
                        self._append(blocks, budget, table_text, self._section(headings))

            require_text(len(blocks))
            return ParsedDocument(document_id=document_id, file_type=self.file_type, blocks=blocks)
        except DocumentParsingError:
            raise
        except Exception:
            # python-docx/lxml 的具体异常和 ZIP 内部名称都不暴露给调用方
            raise CorruptDocumentError() from None

    def _validate_archive(self, content: bytes) -> None:
        try:
            with ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                if len(entries) > self._limits.max_docx_entries:
                    raise ParsingResourceLimitError()
                if sum(entry.file_size for entry in entries) > self._limits.max_docx_uncompressed_bytes:
                    raise ParsingResourceLimitError()
                if not _REQUIRED_PARTS.issubset(archive.namelist()):
                    raise CorruptDocumentError()
        except DocumentParsingError:
            raise
        except (BadZipFile, OSError, ValueError):
            raise CorruptDocumentError() from None

    def _heading_level(self, paragraph: Paragraph) -> int | None:
        style_name = paragraph.style.name if paragraph.style is not None else ""
        match = _HEADING_STYLE.fullmatch(style_name)
        return int(match.group(1)) if match else None

    def _table_text(self, table: Table) -> str:
        rows: list[str] = []
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells]
            if any(cells):
                rows.append(" | ".join(cells))
        return "\n".join(rows)

    def _append(
        self,
        blocks: list[ParsedBlock],
        budget: ParseBudget,
        text: str,
        section: str | None,
    ) -> None:
        budget.consume(text)
        blocks.append(ParsedBlock(text=text, page_number=None, section=section))

    def _section(self, headings: list[tuple[int, str]]) -> str | None:
        path = " > ".join(title for _, title in headings)
        return path[:512] or None
