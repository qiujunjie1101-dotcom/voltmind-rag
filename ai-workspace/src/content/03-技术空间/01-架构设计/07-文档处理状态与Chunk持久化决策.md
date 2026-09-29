---
title: 文档处理状态与 Chunk 持久化决策
slug: document-processing-state-and-chunk-storage-decision
description: 决定解析完成状态、Chunk 权威存储位置和当前阶段 Java/Python 同步协作方式。
date: '2026-09-29'
status: 部分实施
---
## 背景

Java 已保存原始文件、文档元数据和 `PENDING / INDEXING / INDEXED / FAILED` 状态，Python 尚未实现解析与切片。R1-4 当前不接入 Embedding 和 Milvus，因此“解析与切片成功”不能等同于“已建立向量索引”。同时，解析结果不能只保存 `chunk_count`，否则正文 Chunk 会在 HTTP 响应结束后丢失。

约束如下：

- Java 是文档业务数据、原始文件和处理状态的权威服务。
- Python 只做解析与切片，不访问 Java MySQL。
- 已执行的 Flyway V1-V3 不可修改。
- 当前优先完成单机可验证闭环，不提前引入消息队列、对象存储或 Milvus。

## 方案与取舍

### 处理接口

| 方案 | 优点 | 代价 |
| --- | --- | --- |
| 同步 Multipart HTTP | 契约简单；Java 可直接从 `FileStorage` 转发；当前部署无需共享目录 | 大文件响应与超时压力；事务不能覆盖远程调用 |
| Python 读取共享路径 | 少一次文件传输 | 泄露本地路径；容器和多机部署耦合；权限边界不清晰 |
| 异步任务/消息队列 | 适合长任务、重试和进度 | 当前无消息基础设施；显著扩大 R1-4 范围 |

当前选择同步 Multipart HTTP。达到以下任一信号时重新评估异步化：真实文档经常超过读取超时、解析需要 OCR、单次响应 Chunk 体积明显影响内存，或需要跨实例排队与取消。

### 解析完成状态

| 方案 | 结论 |
| --- | --- |
| 成功后写 `INDEXED` | 拒绝。没有 Embedding 和 Milvus 时会向前端谎报可检索状态 |
| 成功后仍写 `PENDING` | 拒绝。无法区分未处理与已解析，也无法可靠启动下一阶段 |
| 新增 `PARSED` | 采用。明确表示 Chunk 已落库但尚未向量化 |
| 同时新增 `PARSING` | 暂缓。现有 `INDEXING` 可作为当前处理中状态以减少本轮迁移范围，但其命名作为已知语义债记录 |

### Chunk 权威存储

| 方案 | 结论 |
| --- | --- |
| 只保存 `chunk_count` | 拒绝。正文丢失，无法审计、重试 Embedding 或重建向量 |
| Python 本地文件/数据库 | 拒绝。形成第二套业务真源并违反 Python 不修改业务数据的边界 |
| 直接写 Milvus | 拒绝。本阶段没有 Milvus，且向量库不应是正文唯一真源 |
| Java MySQL 新建 Chunk 表 | 采用。与文档事务一致，便于约束、删除、审计和后续 Embedding |
| 对象存储保存 Chunk 正文 | 暂缓。规模增长时可迁移，但当前会提前引入额外基础设施和一致性问题 |

## 决策

以下决策已在 R1-4-2 的 Java 数据结构与持久化层实施；同步 HTTP 与 Python 解析部分仍待后续任务：

1. Java 通过同步 Multipart 调用 Python `POST /api/v1/documents/process`，只传文件字节、业务关联 ID 和字符切片参数。
2. 开始处理时 Java 将状态条件更新为 `INDEXING` 并递增 `processing_version`；解析与 Chunk 事务写入成功后更新为新增状态 `PARSED`。
3. `INDEXED` 只保留给未来 Embedding 与 Milvus 全部成功后的最终状态。
4. 新增 Java MySQL 表 `kb_document_chunk` 作为 Chunk 正文权威来源。Python 不持久化业务结果，也不访问 Java MySQL。
5. Java 在单个数据库事务中覆盖式替换同文档 Chunk、更新 `chunk_count`、处理参数、元数据和状态；原始文件继续由 `FileStorage` 管理。
6. 已执行的 V1-V3 保持不变，V4 已增量增加 `PARSED`、错误信息、处理版本与 Chunk 表。

具体字段、校验、错误映射和 V4 方案见《[文档处理接口契约](./06-文档处理接口契约.md)》。

## 影响与回退

### 正向影响

- 前端能准确区分“待处理”“解析完成”“向量可检索”。
- Python 保持无业务数据库依赖，可以独立扩缩容和替换解析器。
- 原始文件、文档元数据、Chunk 正文和状态都由 Java 形成可审计闭环。
- 后续 Embedding 可以从稳定 Chunk ID 与内容哈希开始，不必重新解析原文件。

### 代价

- MySQL 会承担正文存储与批量替换压力。
- 同步请求需要严格的超时、响应大小和并发控制。
- `INDEXING` 在当前阶段实际表示解析中，名称与未来向量化存在冲突。
- 文件系统、远程 HTTP 与数据库之间仍需补偿，无法获得单个 ACID 事务。

### 回退与演进

- V4 实施后若需要回退应用，旧应用无法识别 `PARSED`；应先停止新处理并把已解析数据保留，不能直接删除 Chunk 表或覆盖 V1-V3。
- 正文规模超出 MySQL 承载目标时，可把 Chunk 正文迁移到对象存储，数据库继续保存 Chunk ID、位置、哈希和检索元数据。
- 引入 OCR、长文档或任务队列后，可保留请求/响应 Schema 的核心字段，将同步执行演进为创建任务、查询任务和分页获取结果。
- Embedding 阶段开始前重新评估状态机，优先增加明确的 `PARSING`、`EMBEDDING` 或独立 `processing_stage`，不继续扩张 `INDEXING` 的含义。

## 待审查事项

- `chunk_size=1000`、`chunk_overlap=200` 的字符默认值是否满足首批真实文档。
- Java 到 Python 的读取超时初值及最大响应体限制。
- `MEDIUMTEXT` 的容量规划和单文档最大 Chunk 数。
- 部署环境采用何种服务间认证与网络隔离。
- 后续迁移应把切片参数和解析器版本保存为独立列，还是统一进入 `processing_metadata` JSON。
- Embedding 阶段是否直接拆分 `PARSING/EMBEDDING`，从而避免继续使用兼容性的 `INDEXING`。

## 关联资料

- 接口设计：《[文档处理接口契约](./06-文档处理接口契约.md)》
- 当前服务划分：《[技术架构](./02-技术架构.md)》
- 当前 Java 边界：《[Java 业务服务接口契约](./05-Java业务服务接口契约.md)》
- 当前 Python 边界：《[AI 服务接口契约](./04-AI服务接口契约.md)》

