# 任务：Python AI 服务接入 DeepSeek 单轮问答

## 目标与边界

- 预期结果：在已跑通的 FastAPI 服务上增加 POST /api/v1/chat，用 OpenAI SDK 调用 DeepSeek，返回 answer。
- 任务类型：关联业务工程（Python AI 服务），workspace 侧只做资料同步。
- 关联工程 ID：未在 `code/projects.local.json` 登记；业务代码位于本仓库 `ai-service/`。
- 范围和完成标准：模型调用封装在独立 Service；密钥只从 .env 或环境变量读取；参数校验与异常处理完整；/health 不回归；测试用 Mock 且不消耗 API 额度。
- 明确不做：RAG、Embedding、向量库、数据库、Java 业务服务、流式输出、多轮上下文。

## 上下文

- 接口契约与错误码：`src/content/03-技术空间/01-架构设计/04-AI服务接口契约.md`
- 验证记录：`src/content/05-测试空间/02-AI服务接口验证记录.md`
- 已确认决策：技术架构文档已确定 Python 3.11 + FastAPI、服务分离、云端模型 API 优先。
- 待验证假设：上游异常分类是否满足 Java 侧重试判断的需要。
- 需要保留的内容：既有 /health、/scalar 调试页面与相关测试。

## 执行计划与进度

- [x] 明确目标与验收（沿用既有调用约定：OpenAI SDK + DeepSeek 兼容端点）。
- [x] 配置层：加载 .env，密钥不进代码与日志。
- [x] 服务层：ChatService 封装调用与异常翻译。
- [x] 接口层：POST /api/v1/chat，入参校验与统一错误响应。
- [x] 测试：Service 层与接口层全部使用替身，无真实调用。
- [x] 运行态验证并同步 workspace 资料。

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 自动化测试 | Windows；Python 3.11.9；pytest 8.3.4 | 通过：41 项用例，0 失败，0.10 秒 | `41 passed`；模型调用全部为测试替身 |
| 健康检查回归 | 本机 uvicorn 127.0.0.1:8000 | 通过：HTTP 200，status=ok | 未配置变更影响 |
| 未配置密钥 | 显式置空 DEEPSEEK_API_KEY | 通过：HTTP 503，无上游调用 | 配置缺失说明 |
| 参数校验 | 同上 | 通过：缺失/纯空白 question 返回 422 | 校验先于模型调用 |
| 真实模型调用 | 本机用户级环境变量提供密钥 | 通过：HTTP 200，`answer` 长度 62 | 正式验收 1 次调用，连同早期 1 次共 2 次，已记入验证记录 |
| 依赖核对 | openai 3.19.2 | 已按实际安装版本核对异常构造签名与客户端参数后编码 | 未凭假设编写异常映射 |

## 交接

- 已完成：`ai-service/` 目录下服务骨架、/health、/scalar、/api/v1/chat、41 项测试；workspace 侧新增接口契约与验证记录，更新技术架构文档。
- 未完成与阻塞：Java 业务服务未接入；RAG、Embedding、向量库与数据库未开始；本工程尚未登记到 `code/projects.local.json`。
- 下一步：按《架构原则与演进》进入基础 RAG 的第一个环节前，先明确文档入库链路的组件归属。
- 注意：业务工程未配置独立 harness，本仓库的 npm 检查不适用于 `ai-service/`；该工程的验证命令为 `python -m pytest`。
- 未提交、未推送。
