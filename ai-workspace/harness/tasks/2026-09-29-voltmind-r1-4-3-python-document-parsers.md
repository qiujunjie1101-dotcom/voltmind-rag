# 任务：VoltMind R1-4-3 Python 文档解析器

## 目标与边界

- 预期结果：在现有 Python AI 服务实现 PDF、DOCX、Markdown、TXT 到统一结构化文本的内部解析模块。
- 任务类型：关联业务工程与项目资料。
- 关联工程：仓库内 `ai-service/`。
- 明确不做：切片、文档处理 HTTP、Java/Python 联调、Chunk 数据库写入、Embedding、Milvus、RAG 和前端修改。

## 上下文

- 契约：《[文档处理接口契约](../../src/content/03-技术空间/01-架构设计/06-文档处理接口契约.md)》
- Java 持久化记录：《[R1-4-2 文档处理持久化基础](../../src/content/03-技术空间/03-Coding实战/04-R1-4-2文档处理持久化基础.md)》
- Python 实现记录：《[R1-4-3 Python 文档解析器](../../src/content/03-技术空间/03-Coding实战/05-R1-4-3Python文档解析器.md)》
- 开始前 Python 全量基线为 135 项通过。

## 执行计划与进度

- [x] 检查 Schema、异常、依赖和测试规范
- [x] 定义 ParsedDocument、ParsedBlock 和统一解析入口
- [x] 实现四种格式解析器及资源限制
- [x] 生成隔离测试样本并覆盖正常与异常场景
- [x] 执行 Python 全量回归
- [x] 更新 README、workspace 和交接

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| Python 基线 | Python 3.11.9、pytest 8.3.4 | 135 项通过 | 修改前 `python -m pytest` |
| 解析器定向测试 | pypdf 5.4.0、python-docx 1.1.2 | 18 项通过 | `pytest tests/test_document_parsing.py -v` |
| Python 全量测试 | Python 3.11.9 | 153 项通过，0 失败 | `python -m pytest` |
| Python 依赖 | 项目 `.venv` | 无冲突 | `python -m pip check` |
| workspace 内容 | Node 24.20.0 | 通过，33 篇文档 | `npm run check:content` |

## 交接

- 已完成：统一 Schema、解析器选择、四格式解析、安全异常、资源预算和测试样本。
- 未完成与阻塞：无 R1-4-3 阻塞；HTTP Multipart 和字符切片由后续任务实现。
- 已知限制：无 OCR；复杂 PDF 版式顺序依赖源文件；DOCX 不提供页码且不提取浮动文本框；TXT 只接受 UTF-8。
- 下一步：在独立任务实现字符切片，再组装文档处理 HTTP 路由；不得把 ParsedBlock 直接当作最终 Chunk。
- 业务工程路径：`ai-service/`。

