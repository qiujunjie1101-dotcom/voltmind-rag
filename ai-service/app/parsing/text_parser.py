"""严格 UTF-8 纯文本解析器。"""

from __future__ import annotations

from app.parsing.parser import ParseBudget, ParsingLimits, decode_utf8, require_text
from app.parsing.schemas import ParsedBlock, ParsedDocument


class TextParser:
    """一份 TXT 对应一个结构块，保留内部换行与缩进。"""

    file_type = "TXT"

    def __init__(self, limits: ParsingLimits) -> None:
        self._limits = limits

    def parse(self, document_id: int, content: bytes) -> ParsedDocument:
        text = decode_utf8(content).strip("\r\n")
        blocks: list[ParsedBlock] = []
        if text.strip():
            budget = ParseBudget(self._limits)
            budget.consume(text)
            blocks.append(ParsedBlock(text=text, page_number=None, section=None))
        require_text(len(blocks))
        return ParsedDocument(document_id=document_id, file_type=self.file_type, blocks=blocks)
