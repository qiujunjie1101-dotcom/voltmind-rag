"""文档解析阶段的统一数据结构，不等同于最终检索 Chunk。"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

DocumentFileType = Literal["PDF", "DOCX", "MARKDOWN", "TXT"]


class ParsedBlock(BaseModel):
    """按原文结构提取的一段文本。

    ParsedBlock 保留解析器能可靠识别的页面和章节边界；它没有 chunk_index，
    也不承诺长度，后续 Chunking 必须以 ParsedDocument 为输入另行处理。
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    text: str = Field(description="有效文本，保留正文内部换行与代码缩进")
    page_number: int | None = Field(default=None, ge=1, description="可靠页码，从 1 开始")
    section: str | None = Field(default=None, max_length=512, description="章节路径")

    @field_validator("text")
    @classmethod
    def _reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("text 不能为空白字符")
        return value

    @field_validator("section")
    @classmethod
    def _normalize_section(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ParsedDocument(BaseModel):
    """单份原始文件的有序解析结果。"""

    model_config = ConfigDict(extra="forbid", frozen=True)

    document_id: int = Field(gt=0, description="Java 文档 ID")
    file_type: DocumentFileType
    blocks: list[ParsedBlock] = Field(min_length=1, description="按原文顺序排列的解析块")
