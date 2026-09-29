"""文档解析测试样本生成器，全部在内存中构造。"""

from __future__ import annotations

from collections.abc import Callable
from io import BytesIO

from docx import Document as create_docx
from docx.document import Document as DocxDocument
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject


def pdf_bytes(*page_texts: str | None) -> bytes:
    """生成使用 PDF 内置 Helvetica 字体的文本页；None 表示空白页。"""
    writer = PdfWriter()
    font = DictionaryObject(
        {
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        }
    )
    font_reference = writer._add_object(font)  # noqa: SLF001 - 测试样本需要底层 PDF 对象

    for text in page_texts:
        page = writer.add_blank_page(width=612, height=792)
        page[NameObject("/Resources")] = DictionaryObject(
            {
                NameObject("/Font"): DictionaryObject(
                    {NameObject("/F1"): font_reference}
                )
            }
        )
        if text is None:
            continue
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        stream = DecodedStreamObject()
        stream.set_data(f"BT /F1 12 Tf 72 720 Td ({escaped}) Tj ET".encode("ascii"))
        page[NameObject("/Contents")] = writer._add_object(  # noqa: SLF001
            stream
        )

    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def encrypted_pdf_bytes() -> bytes:
    """生成需要密码的 PDF，解析器应在读取文本前拒绝。"""
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.encrypt("test-password")
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def docx_bytes(build: Callable[[DocxDocument], None]) -> bytes:
    """按回调构造 DOCX 并返回 OOXML 字节。"""
    document = create_docx()
    build(document)
    output = BytesIO()
    document.save(output)
    return output.getvalue()
