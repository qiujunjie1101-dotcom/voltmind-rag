# 任务：VoltMind R1-2 知识库与文档管理接口

## 目标与边界

- 预期结果：在现有 Java 服务实现知识库 CRUD、文档上传与管理、本地文件存储抽象及一致性处理。
- 任务类型：关联业务工程与项目资料。
- 关联工程 ID：仓库内 `voltmind-server/`。
- 明确不做：文档解析、Chunking、Embedding、Milvus、RAG、SSE、鉴权和前端改造。

## 上下文

- 架构：《[技术架构](../../src/content/03-技术空间/01-架构设计/02-技术架构.md)》
- 接口：《[Java 业务服务接口契约](../../src/content/03-技术空间/01-架构设计/05-Java业务服务接口契约.md)》
- 验证：《[R1-2 验证记录](../../src/content/05-测试空间/03-R1-2知识库与文档管理验证记录.md)》
- 已确认决策：Java 负责业务逻辑；Python 负责 AI；不提前引入 MinIO、Milvus 或复杂架构。

## 执行计划与进度

- [x] 明确目标与验收
- [x] 完成知识库和文档接口
- [x] 完成本地存储与失败补偿
- [x] 完成自动化和真实 HTTP 验证
- [x] 更新 workspace 资料与交接

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| Maven 全量测试 | Java 17、Spring Boot 3.5.6、MySQL 8.4.9 | 32 项通过 | `mvn test` 输出 `BUILD SUCCESS` |
| 真实 HTTP 工作流 | Java 8080、MySQL 13306 | CRUD、上传、列表和两种删除清理通过 | QA 验证记录 |
| workspace 内容 | Node 24.20.0 | 29 篇文档检查通过 | `npm run check:content` |

## 交接

- 已完成：Controller、DTO、Service、MyBatis-Plus Mapper 复用、FileStorage 抽象、本地存储、业务错误与测试。
- 未完成与阻塞：无 R1-2 阻塞；跨数据库和文件系统的持久化清理重试未实现。
- 下一步：设计 Java 与 Python 的文档解析、分块和状态回写契约。
- 业务工程路径：`voltmind-server/`。
