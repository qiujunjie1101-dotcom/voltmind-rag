"""保留标题层级和围栏代码原貌的 Markdown 解析器。"""

from __future__ import annotations

import re

from app.parsing.parser import ParseBudget, ParsingLimits, decode_utf8, require_text
from app.parsing.schemas import ParsedBlock, ParsedDocument

_ATX_HEADING = re.compile(r"^[ ]{0,3}(#{1,6})[ \t]+(.+)$")
_SETEXT_HEADING = re.compile(r"^[ ]{0,3}(=+|-+)[ \t]*$")
_FENCE_OPEN = re.compile(r"^[ ]{0,3}(`{3,}|~{3,})(.*)$")


class MarkdownParser:
    """逐行识别结构；不渲染 HTML，也不访问图片或链接。"""

    file_type = "MARKDOWN"

    def __init__(self, limits: ParsingLimits) -> None:
        self._limits = limits

    def parse(self, document_id: int, content: bytes) -> ParsedDocument:
        text = decode_utf8(content)
        lines = text.splitlines(keepends=True)
        blocks: list[ParsedBlock] = []
        headings: list[tuple[int, str]] = []
        paragraph: list[str] = []
        budget = ParseBudget(self._limits)
        index = 0

        def section() -> str | None:
            path = " > ".join(title for _, title in headings)
            return path[:512] or None

        def append(raw: str) -> None:
            value = raw.strip("\r\n")
            if not value.strip():
                return
            budget.consume(value)
            blocks.append(ParsedBlock(text=value, page_number=None, section=section()))

        def flush_paragraph() -> None:
            if paragraph:
                append("".join(paragraph))
                paragraph.clear()

        while index < len(lines):
            line = lines[index]
            plain = line.rstrip("\r\n")
            fence = _FENCE_OPEN.match(plain)
            if fence:
                flush_paragraph()
                marker = fence.group(1)
                code_lines = [line]
                index += 1
                closing = re.compile(
                    rf"^[ ]{{0,3}}{re.escape(marker[0])}{{{len(marker)},}}[ \t]*$"
                )
                while index < len(lines):
                    code_line = lines[index]
                    code_lines.append(code_line)
                    index += 1
                    if closing.match(code_line.rstrip("\r\n")):
                        break
                append("".join(code_lines))
                continue

            atx = _ATX_HEADING.match(plain)
            if atx:
                flush_paragraph()
                title = re.sub(r"[ \t]+#+[ \t]*$", "", atx.group(2)).strip()
                if title:
                    self._set_heading(headings, len(atx.group(1)), title)
                    append(title)
                index += 1
                continue

            if index + 1 < len(lines) and plain.strip():
                underline = _SETEXT_HEADING.match(lines[index + 1].rstrip("\r\n"))
                if underline:
                    flush_paragraph()
                    level = 1 if underline.group(1).startswith("=") else 2
                    title = plain.strip()
                    self._set_heading(headings, level, title)
                    append(title)
                    index += 2
                    continue

            if not plain.strip():
                flush_paragraph()
            else:
                paragraph.append(line)
            index += 1

        flush_paragraph()
        require_text(len(blocks))
        return ParsedDocument(document_id=document_id, file_type=self.file_type, blocks=blocks)

    def _set_heading(
        self,
        headings: list[tuple[int, str]],
        level: int,
        title: str,
    ) -> None:
        # 只保留层级更高的真实父标题，不为跳级标题伪造中间层
        while headings and headings[-1][0] >= level:
            headings.pop()
        headings.append((level, title))
