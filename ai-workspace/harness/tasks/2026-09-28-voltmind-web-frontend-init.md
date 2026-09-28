# 任务：初始化 VoltMind RAG 前端工作台

## 目标与边界

- 预期结果：在仓库根目录新建 `voltmind-web/`，完成工程初始化、依赖安装与配置，产出左侧导航 + 右侧内容区的 AI 工作台静态布局，支持深色模式。
- 任务类型：关联业务工程（新建前端工程），workspace 侧只做资料同步。
- 关联工程 ID：未登记。`code/projects.local.json` 的 `projects` 为空数组，`ai-service` 与 `voltmind-web` 都未登记。
- 范围和完成标准：技术栈按架构文档（Vue 3 + Tailwind CSS + Vite + shadcn 组件库）落地；类型检查与生产构建通过；深色模式可用；不接入后端。
- 明确不做：不接后端接口、不做 RAG/检索交互、不改动 `ai-service/`、不引入 Vue Router 与 Pinia。

## 上下文

- 技术选型与架构：`src/content/03-技术空间/01-架构设计/02-技术架构.md`
- 后端接口契约：`src/content/03-技术空间/01-架构设计/04-AI服务接口契约.md`
- 已确认决策：前端为 Vue 3 系；前后端通过 HTTP 通信；初期云端模型 API。
- 待验证假设：工作台信息架构（对话 / 知识库 / 设置三分区）是否符合真实使用流程。
- 需要保留的内容：既有 `ai-workspace/` 模板工程与 `ai-service/` 均未改动。

## 角色范围说明

用户未指定角色。本任务显式要求创建前端工程，属前端研发范围，因此资料写入 FE 目录 `src/content/03-技术空间/02-前端设计/`。但 `code/projects.local.json` 的 `roles` 当前为 `RD / PM / QA`，**不含 FE**，此为按用户显式授权的跨角色写入，特此记录原因。

## 执行计划与进度

- [x] 读取 workspace 资料，确认技术选型与产品定位。
- [x] 搭建工程骨架：Vite 7、TypeScript strict、Tailwind CSS 4 语义令牌、shadcn-vue 配置。
- [x] 安装依赖并接入 shadcn-vue 组件（button / card / badge / input / textarea）。
- [x] 实现工作台布局与深色模式。
- [x] 实现静态视图：对话、知识库、设置。
- [x] 类型检查与生产构建，启动开发服务验证。
- [x] 同步 workspace 资料。

## 验证记录

| 检查 | 环境/版本 | 实际结果 | 证据 |
| --- | --- | --- | --- |
| 依赖安装 | Node v24.20.0、npm 11.19.0 | 通过：86 个包，无安装失败 | `npm install` 退出码 0 |
| 图标导出核对 | `@lucide/vue` 1.46.0 | 通过：计划使用的 31 个图标名全部存在 | 共 6350 个导出，`missing=[]` |
| 类型检查 | vue-tsc 3.x | 通过：0 错误 | 修正 1 处未使用导入后 `vue-tsc --noEmit` 退出码 0 |
| 生产构建 | Vite 7.3.6 | 通过：2519 模块，2.25 秒；JS 133.22 kB（gzip 48.38）、CSS 27.92 kB（gzip 5.67） | `npm run build` 退出码 0 |
| 设计令牌 | 构建产物 | 通过：语义令牌与工具类均已编译 | 产物含 `--sidebar:`、`var(--sidebar)`、`.bg-sidebar`、`.dark` 深色令牌块 |
| 开发服务 | Vite dev，127.0.0.1:5174 | 通过：入口与模块均 200 | `/`、`/src/main.ts`、`/src/App.vue`、`/src/assets/index.css` 全部 200 |
| 产物内容 | dist（UTF-8 读取） | 通过：界面文案与接口路径均在包内 | 14 项中文与路径断言全部命中，`js_missing=[]` |
| 浏览器渲染 | 本机未安装 Playwright | **未执行**：未自动断言 DOM 与截图，视觉效果待人工确认 | 无 |
| 品牌资源提取 | 原图 863x314 RGBA | 通过：原始图 0 个透明像素（背景实测 252,252,252）；派生图形标 274x189，四角 alpha 均为 0 | 回读产物自检：透明 24661、不透明 27092、半透明 33 |
| 品牌资源接入 | 构建产物 + dev 服务 | 通过：三个图片进入 `dist/brand/`，dev 服务均返回 200 与 `image/png` | `index.html` 已引用 `brand/favicon.png` |
| 回归构建 | Vite 7.3.6 | 通过：2521 模块，2.68 秒，类型检查 0 错误 | `npm run build` 退出码 0 |

## 交接

- 已完成：`voltmind-web/` 工程与静态工作台；workspace 侧新增本任务记录与《VoltMind 前端工作台结构》。
- 未完成与阻塞：
  - 浏览器渲染未自动化验证，仅完成构建与服务可达性检查。
  - 深色模式仅验证令牌编译与状态实现，未在真实浏览器核对对比度。
  - 移动端抽屉未做焦点管理（无 focus trap），可访问性待补。
- 下一步（需用户决定）：
  1. `code/projects.local.json` 的 `roles` 是否需要加入 `FE`。
  2. 是否登记 `voltmind-web` 与 `ai-service` 两个工程。
  3. 视图切换当前用组件内状态实现，是否需要引入 Vue Router。
  4. 接入后端时启用 `vite.config.ts` 中预留的 `/api` 代理。
- 交接建议（跨角色）：`src/content/03-技术空间/01-架构设计/02-技术架构.md` 的「当前实现进度」仍写「前端尚未开始」，需 RD 角色补充前端已落地静态骨架；本任务未修改该文件。
- 涉及业务工程的仓库相对路径：`voltmind-web/`、`ai-service/`。
- 未提交、未推送。
