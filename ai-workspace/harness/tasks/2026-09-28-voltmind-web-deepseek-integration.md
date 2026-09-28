# 任务：前端对话页接入 DeepSeek 真实接口

## 目标与边界

- 预期结果：`voltmind-web` 的对话页通过 Axios 调用 `POST /api/v1/chat`，展示真实模型回答，替换静态模拟内容。
- 任务类型：关联业务工程（前端 + Python 后端同时改动）。
- 关联工程 ID：未登记，`code/projects.local.json` 的 `projects` 仍为空数组。
- 范围和完成标准：保留现有布局、Logo、视觉风格；地址与超时走 Vite 环境变量；Enter 发送、Shift+Enter 换行；请求期间禁止重复提交；超时/网络/API 错误均有提示；后端 CORS 放行本地前端；前端不接触 API Key。
- 明确不做：RAG、知识检索、多轮记忆、SSE 流式输出、Java 后端、Vue Router 与状态管理。

## 上下文

- 接口契约：`src/content/03-技术空间/01-架构设计/04-AI服务接口契约.md`
- 前端结构：`src/content/03-技术空间/02-前端设计/02-VoltMind前端工作台结构.md`
- 已确认决策：前后端通过 HTTP 通信，前端为 Vue 3 系，密钥只由后端持有。
- 需要保留的内容：既有布局结构、品牌标识、浅色主题与语义令牌。

## 角色范围说明

用户未指定角色。本任务显式要求同时改动前端与 Python 服务的 CORS 配置，因此资料写入 FE 目录 `src/content/03-技术空间/02-前端设计/`，并更新 RD 目录下的《AI 服务接口契约》以补入 CORS 配置项——后者是按用户显式授权的跨角色写入，特此记录原因。`code/projects.local.json` 的 `roles` 为 `RD / PM / QA`，不含 FE，情况与上一任务相同。

## 执行计划与进度

- [x] 读取 workspace 与前后端现有代码，确认契约与约束。
- [x] 后端：CORS 中间件 + 可配置来源 + 测试。
- [x] 前端：Axios 接入，地址与超时改由 Vite 环境变量提供。
- [x] 前端：对话页真实请求、Loading、键盘、防重复提交与错误提示。
- [x] 更新页面状态文案与两端 README。
- [x] 后端测试、前端构建检查、真实接口联调。
- [x] 同步 workspace 资料。

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 后端测试 | Python 3.11.9；pytest 8.3.4 | 通过：50 项用例（新增 9 项 CORS 与配置用例），0 失败 | `50 passed`，模型调用仍全部为替身，0 次额度消耗 |
| 前端类型检查 | vue-tsc 3.x | 通过：0 错误 | `npm run type-check` 退出码 0 |
| 前端构建 | Vite 7.3.6 | 通过：2579 模块，2.83 秒；JS 188.28 kB（gzip 69.84） | `npm run build` 退出码 0 |
| CORS 预检（放行来源） | `Origin: http://127.0.0.1:5174` | 通过：200，`allow-origin` 回显该来源，`allow-methods=GET, POST, OPTIONS` | 真实 HTTP 请求 |
| CORS 预检（未放行来源） | `Origin: https://evil.example.com` | 通过：400 且无 `allow-origin` 头 | 真实 HTTP 请求 |
| 真实问答联调 | 本机 uvicorn + 真实 DeepSeek | 通过：200，带 `allow-origin`，响应仅含 `answer`，长度 46 | 回答原文已记入《AI 服务接口验证记录》 |
| 环境变量注入 | 构建产物 | 通过：产物含 `.env` 中的地址与超时值 | `VITE_API_BASE_URL` 值已内联进 JS |
| 密钥不泄漏 | dist 与 src 全量扫描 | 通过：真实密钥（35 字符）在 0 个前端文件中出现 | 字符串包含性检查，未打印密钥 |
| 开发服务 | Vite dev，127.0.0.1:5174 | 通过：入口与新增模块均 200 | `/`、`src/lib/env.ts`、`src/api/chat.ts`、`ChatView.vue` |
| 浏览器交互 | 本机未安装 Playwright | **未执行**：未自动验证发送、Loading、Enter 与错误气泡的实际表现 | 无 |

## 交接

- 已完成：后端 CORS（可配置、不用通配来源）；前端 Axios 接入、环境变量配置层、对话页真实请求与四类错误提示；两端 README 与 workspace 资料。
- 未完成与阻塞：
  - 浏览器交互未自动化验证，仅完成构建、服务可达性与 HTTP 层联调。
  - 前端无单元测试框架，错误分类与防重复提交逻辑未被测试覆盖。
  - 移动端抽屉仍无焦点陷阱。
  - 知识库页仍为占位数据。
- 下一步（需用户决定）：
  1. 是否引入前端单元测试框架覆盖 `src/api/chat.ts` 的错误分类。
  2. 是否登记 `voltmind-web` 与 `ai-service` 两个工程，并把 FE 加入 `roles`。
  3. 后端 `CORS_ALLOW_ORIGINS` 在部署环境需显式配置，部署方案未定。
- 交接建议（跨角色）：`src/content/05-测试空间/02-AI服务接口验证记录.md` 记录了本次联调的真实调用，调用次数需由 QA 角色累计更新。
- 涉及业务工程的仓库相对路径：`voltmind-web/`、`ai-service/`。
- 未提交、未推送。
