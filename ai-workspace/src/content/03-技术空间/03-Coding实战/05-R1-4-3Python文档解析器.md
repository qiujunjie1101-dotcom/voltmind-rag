---
title: R1-4-3 Python 文档解析器
slug: r1-4-3-python-document-parsers
description: 记录 PDF、DOCX、Markdown、TXT 到统一 ParsedDocument 的解析实现、安全边界与测试结果。
date: '2026-09-29'
status: 已完成
---
## 实现范围

R1-4-3 在 `ai-service/app/parsing/` 实现文件字节到统一结构化文本的转换。当前没有新增 FastAPI 路由，不包含 Chunking、Java/Python HTTP、Embedding、Milvus、RAG 或前端修改。

统一模型：

- `ParsedDocument`：`document_id`、标准化 `file_type`、有序 `blocks`。
- `ParsedBlock`：`text`、可靠时才填写的 `page_number` 和 `section`。
- ParsedBlock 没有 `chunk_index`，不承诺固定长度，不是最终检索 Chunk。

## 格式处理

| 格式 | 实现与边界 |
| --- | --- |
| PDF | `pypdf 5.4.0`，按页面顺序提取文本并记录真实页码；空文本、损坏、加密和超页数分别失败；不做 OCR |
| DOCX | `python-docx 1.1.2`，按 OOXML 正文顺序提取段落与表格，识别 Heading 1-9 并形成章节路径；不伪造页码 |
| Markdown | 行级状态机识别 ATX/Setext 标题与围栏代码，保留代码换行和缩进，不渲染或执行 HTML、脚本和代码 |
| TXT | 使用 `utf-8-sig` 严格解码，支持 UTF-8 BOM；非法编码直接失败，不插入替换字符 |

## 安全和资源限制

- 默认最大文件 20 MiB。
- PDF 最多 2000 页。
- DOCX 最多 10000 个 ZIP 条目、解压后总大小最多 100 MiB。
- 单文档最多 100000 个解析块、20000000 个提取字符。
- DOCX 不解压到磁盘，Markdown 不加载链接，所有解析器不执行宏、脚本、代码或外部资源。
- 所有对外可用异常消息均为固定安全文案，不包含本地路径、文件正文或底层库异常。

## 异常体系

解析异常沿用 `ServiceError`，增加空文件、文件过大、不支持格式、损坏文档、PDF 加密、无有效文本、UTF-8 解码失败和资源超限类型。当前没有 HTTP 路由，因此异常只在模块调用边界使用；后续路由接入时再按 R1-4-1 契约输出结构化错误码。

## 验证

使用 Python 3.11.9、pytest 8.3.4 执行全量测试：原有 135 项与新增 18 项共 153 项通过，0 失败。测试样本在内存中生成，覆盖文本 PDF、多页与空白 PDF、损坏和加密 PDF、DOCX 标题/段落/表格顺序、损坏 DOCX、Markdown 标题与代码围栏、UTF-8/BOM、非法编码、不支持格式和资源限制。

唯一现有警告来自 Starlette `TestClient` 使用已弃用的 AnyIO 类型别名，与本次解析模块无关。

## 已知限制

- 扫描 PDF 和图片文字不做 OCR。
- PDF 文本顺序受原文件内部绘制顺序影响，复杂多栏版式可能不等同于视觉阅读顺序。
- DOCX 没有稳定分页信息，页码始终为空；浮动文本框、图片文字、页眉页脚和嵌入对象未提取。
- Markdown 保留源文本结构但不执行完整 CommonMark AST 语义，复杂自定义扩展按普通文本处理。
- TXT 不尝试 GBK、UTF-16 或自动编码猜测。

## 关联资料

- 契约：《[文档处理接口契约](../01-架构设计/06-文档处理接口契约.md)》
- 状态与持久化：《[文档处理状态与 Chunk 持久化决策](../01-架构设计/07-文档处理状态与Chunk持久化决策.md)》

