# 任务：VoltMind R1-4-2 文档处理数据结构与持久化

## 目标与边界

- 预期结果：在 Java 服务实现 Flyway V4、Chunk 数据层、处理版本原子更新和事务持久化能力。
- 任务类型：关联业务工程与项目资料。
- 关联工程：仓库内 `voltmind-server/`。
- 明确不做：Python 解析器、切片算法、Java/Python HTTP、Embedding、Milvus、RAG 和前端改造。

## 上下文

- 契约：《[文档处理接口契约](../../src/content/03-技术空间/01-架构设计/06-文档处理接口契约.md)》
- 决策：《[文档处理状态与 Chunk 持久化决策](../../src/content/03-技术空间/01-架构设计/07-文档处理状态与Chunk持久化决策.md)》
- 实现记录：《[R1-4-2 文档处理持久化基础](../../src/content/03-技术空间/03-Coding实战/04-R1-4-2文档处理持久化基础.md)》
- 开始时已有 R1-4-1 workspace 文档改动，已保留并基于实际 V4 更新，未回退。

## 执行计划与进度

- [x] 检查实体、Mapper、Service、V1-V3 和 R1-4-1 契约
- [x] 新增 V4、Chunk 实体与 Mapper
- [x] 实现原子版本抢占、行锁校验和有界批量事务写入
- [x] 补充真实 MySQL 集成测试
- [x] 执行 JDK 17 Maven 全量测试和数据库结构核验
- [x] 更新 workspace 资料与交接

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| Maven 全量测试 | JDK 17.0.20.1、Spring Boot 3.5.6 | 42 项通过 | `mvn test` 输出 `BUILD SUCCESS` |
| Flyway 实际迁移 | MySQL 8.4.9 | V3 -> V4 成功，重复执行 0 项 | 启动日志和集成测试 |
| 数据库结构 | Docker `voltmind-mysql` | 表、字段、默认值、外键、唯一键、检查约束和索引符合 V4 | `information_schema` 只读查询 |
| 事务与版本 | MySQL 8.4.9 | 旧版本、已删除文档被拒绝；跨批次失败无部分数据 | `DocumentProcessingPersistenceIntegrationTest` 6 项通过 |
| workspace 内容 | Node 24.20.0 | 通过，32 篇文档 | `npm run check:content` |

## 交接

- 已完成：Flyway V4、`DocumentChunk`、Chunk Mapper、处理版本条件 SQL、持久化服务与 10 项要求对应的自动化覆盖。
- 未完成与阻塞：无 R1-4-2 阻塞；Python 路由、解析器和 HTTP 编排按后续任务实施。
- 已知问题：当前 Flyway 对 MySQL 8.4 输出“正式支持到 8.1”的升级建议，实际迁移和重复校验通过。
- 下一步：实现 Python Multipart 解析与字符切片，再接入 Java HTTP 编排；需要保存切片参数与解析器版本时新增 V5，不修改 V4。
- 业务工程路径：`voltmind-server/`。

