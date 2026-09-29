# 任务：VoltMind R1-3 前端知识库管理与真实接口联调

## 目标与边界

- 预期结果：在现有 Vue 3 工作台实现知识库和文档管理，独立连接 Java 业务服务并完成真实联调。
- 任务类型：关联业务工程与前端设计资料。
- 关联工程 ID：仓库内 `voltmind-web/`，最小联调变更涉及 `voltmind-server/`。
- 明确不做：文档解析、Chunking、Embedding、Milvus、RAG、SSE、鉴权和侧栏重构。

## 上下文

- 前端结构：《[VoltMind 前端工作台结构](../../src/content/03-技术空间/02-前端设计/02-VoltMind前端工作台结构.md)》
- Java 契约：《[Java 业务服务接口契约](../../src/content/03-技术空间/01-架构设计/05-Java业务服务接口契约.md)》
- 已确认决策：Python AI 与 Java 业务服务使用独立 Axios 客户端和环境变量；Java `ApiResponse` 在客户端统一解包；知识库删除与文档删除等待服务端一致性处理完成后再刷新。
- 已有未提交改动：保留 R1-1、R1-2 业务工程和 workspace 资料，不清理用户本地配置。

## 执行计划与进度

- [x] 明确页面、接口和 DTO 契约
- [x] 实现双后端配置与 Java 响应处理
- [x] 实现知识库 CRUD、文档上传与删除交互
- [x] 增加 Java 本地开发 CORS 白名单
- [x] 完成构建、Java 回归、真实 HTTP 与浏览器验证
- [x] 更新 FE workspace 资料与交接

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| Vue TypeScript | Vue 3.5、TypeScript 5.9 | 通过 | `npm run type-check` 无错误 |
| Vue 生产构建 | Vite 7 | 通过 | 2592 个模块转换完成，`dist/` 构建成功 |
| Java 全量测试 | Java 17 编译目标、Spring Boot 3.5.6、MySQL 8.4.9 | 34 项通过 | `mvn test` 输出 `BUILD SUCCESS`，含 2 项 CORS 测试 |
| 真实 HTTP 联调 | Java 8080、MySQL 13306 | 通过 | 创建、重新查询、修改、TXT 上传、`PENDING/0`、文档删除清文件、知识库删除清关联文件、CORS 均断言通过 |
| 浏览器端 | 前端 5174 | 通过 | 实测创建、刷新持久化、编辑、TXT 上传、二次确认；1440/390、明暗主题无页面级横向溢出，控制台无错误 |
| Python 回归 | FastAPI 8000 | 通过 | `/health` 正常，模型列表与设置页正常，对话模型仍为 `deepseek-chat` |
| workspace 内容 | Node 24.20.0 | 通过 | 29 篇文档检查通过 |

## 交接

- 已完成和成果位置：`voltmind-web/src/api/knowledge.ts`、`src/lib/business-http.ts`、`src/components/knowledge/`、`src/views/KnowledgeView.vue`；Java CORS 在 `voltmind-server/src/main/java/com/voltmind/config/CorsConfig.java`。
- 未完成与阻塞：R1-3 无阻塞。Flyway 启动日志提示当前版本正式测试到 MySQL 8.1，而实际 MySQL 为 8.4；迁移校验和运行均通过，后续依赖维护时评估升级。
- 下一步：R1-4 再接入文档解析、分块与状态回写；在此之前文档保持 `PENDING`、片段数为 `0`。
- 业务工程路径：`voltmind-web/`、`voltmind-server/`。
