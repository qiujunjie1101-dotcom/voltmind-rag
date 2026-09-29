# 任务：VoltMind R1-4-1 文档处理接口契约设计

## 目标与边界

- 预期结果：基于当前 Java、Python 与 MySQL 实现，形成可审查的文档解析与切片内部接口契约和架构决策。
- 任务类型：项目资料。
- 关联工程：仓库内 `voltmind-server/`、`ai-service/`，本任务只读检查业务工程。
- 范围和完成标准：明确职责、Multipart 字段、响应 Chunk、异常映射、状态流转、V4 迁移方案、持久化位置、Embedding/Milvus 扩展和风险。
- 明确不做：不修改 Java、Python、Vue 生产代码，不创建或执行 Flyway 迁移，不安装依赖，不实现解析、Embedding 或 Milvus。

## 上下文

- 当前架构：《[技术架构](../../src/content/03-技术空间/01-架构设计/02-技术架构.md)》
- Java 现有契约：《[Java 业务服务接口契约](../../src/content/03-技术空间/01-架构设计/05-Java业务服务接口契约.md)》
- Python 现有契约：《[AI 服务接口契约](../../src/content/03-技术空间/01-架构设计/04-AI服务接口契约.md)》
- 实际检查范围：Java `DocumentService`、`FileStorage`、`LocalFileStorage`、`DocumentStatus`、`DocumentController`、异常处理、V1-V3；Python 路由聚合、Pydantic Schema、`ServiceError` 与异常处理。
- 已确认事实：Java 当前上传后写 `PENDING` 与 `chunk_count=0`；Python 当前没有文档处理路由；Python 不直接修改 Java MySQL；V1-V3 不可修改。
- 设计提议：同步 Multipart、字符长度切片、新增 `PARSED`、Chunk 存 Java MySQL、处理版本防迟到响应覆盖。
- 开始时 Git 工作区无未提交改动。

## 执行计划与进度

- [x] 检查 Java、Python、数据库和 workspace 现状
- [x] 明确服务职责和 HTTP Multipart 契约
- [x] 设计状态、异常、并发与 Chunk 持久化
- [x] 编写接口契约和 ADR
- [x] 运行内容检查并检查最终差异
- [x] 提交审查并记录待确认项

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 业务工程边界 | 当前仓库 | 通过 | 仅只读检查 `voltmind-server/` 与 `ai-service/` |
| workspace 内容 | Node 24.20.0 | 通过 | `npm run check:content` 验证 31 篇文档，唯一链接、目录、内部链接和安全渲染均通过 |
| 差异格式 | Git | 通过 | `git diff --check` 无输出 |
| 差异范围 | Git | 通过 | 仅新增两份 RD 架构资料、一份本任务记录，并更新技术架构中的待审查链接 |

## 交接

- 已完成和成果位置：《[文档处理接口契约](../../src/content/03-技术空间/01-架构设计/06-文档处理接口契约.md)》、《[文档处理状态与 Chunk 持久化决策](../../src/content/03-技术空间/01-架构设计/07-文档处理状态与Chunk持久化决策.md)》。
- 未完成与阻塞：契约与 ADR 均待人工审查，尚未实施；默认切片参数、超时、容量和服务认证方式待确认。
- 下一步：审查通过后，后续任务新增 V4、Python 文档处理端点、Java HTTP 客户端与 Chunk 持久化，并补充真实文档集成测试。
- 涉及业务工程的相对路径：`voltmind-server/`、`ai-service/`（本任务无修改）。

