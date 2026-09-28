# Ai Workspace harness

Harness 在这个模板里指支撑 Agent 持续工作的约定、上下文入口、任务记录和验证工具。这是一套项目级基础配置，不绑定模型、账号、个人插件或业务框架。

## 结构

| 位置 | 职责 |
| --- | --- |
| `AGENTS.md` | Agent 的仓库入口、边界、资料规则和完成标准 |
| `src/content/` | 人和 Agent 共用的产品、视觉、测试、项目引用资料 |
| `code/projects.example.json` | 可提交的本地引用配置骨架 |
| `code/projects.local.json` | 每个人的空间名称和业务工程路径，不提交 |
| `harness/templates/` | 需求、决策、任务与验收模板 |
| `harness/tasks/` | 复杂任务的进行状态、证据和交接 |
| `scripts/workspace.mjs` | 初始化配置、校验结构和本地路径 |
| `scripts/check-content.mjs` | 检查内容、导航、链接与渲染 |
| `npm run check` | 不依赖私人路径的统一质量检查 |

根 `AGENTS.md` 使用 Codex 官方支持的项目指令入口。其他 Agent 按各自支持方式读取它，不假设任意工具会自动加载。配置参考：[官方 AGENTS.md 文档](https://learn.chatgpt.com/docs/agent-configuration/agents-md)。

## 页面维护

在左侧“空间配置 → Harness 管理”中维护团队规则。工作规则、协作说明和角色 Skill 可直接编辑文字并预览；角色名称、职责、目录使用表单。保存写回本地工程的标准规则文件，无需修改前端组件。新工程缺失文件时可使用内置模板创建。

个人角色和仓库路径仍在“配置中心”保存，团队规则在“Harness 管理”独立保存。团队规则可提交，个人配置应只留在本机。当前模板的 `code/projects.local.json` 仍被 Git 跟踪，模板维护者需先设置忽略规则并取消跟踪；仅添加忽略规则不会影响已跟踪的文件。

## 角色配置

`harness/roles.json` 定义团队目录职责，`.agents/skills/workspace-*/SKILL.md` 提供角色工作指引。个人可在网页“空间配置 → 配置中心”勾选多个角色，或运行 `npm run workspace:role -- PM QA`。角色保存在 roles 数组，普通任务的修改范围取所选角色目录的并集。各角色均可维护 `harness/tasks/` 中自己的任务记录。角色规则是 Agent 协作约定，不是文件系统权限。共享模板维护和明确授权的跨角色任务按任务范围执行。

## 开始工作

```sh
npm ci
npm run workspace:init
npm run workspace:check
npm run dev
```

复制 `code/projects.example.json` 的初始化操作只创建本地配置，不创建业务工程。填写真实路径之后再次执行 `workspace:check`。没有关联工程时，空列表合法。

使用者从 workspace 根目录启动 Agent，让其读取 `AGENTS.md`。首次配置后在新会话询问“本仓库的工作边界和验证命令是什么”，检查它是否理解资料空间与业务工程的边界。

## 任务闭环

1. **理解目标**：从需求和已有资料中定位任务，说明预期产物和验收方式。
2. **准备上下文**：链接必要设计、约束、决策和工程 ID。复杂任务复制任务模板；简单文案改动无需建立计划文档。
3. **执行**：资料与空间模板在本仓库修改。业务实现进入配置指向的工程，先读工程自己的规则；该工程的 harness 后续单独配置。
4. **验证**：运行与修改相符的检查；有实际浏览器或测试结果才记录“通过”。失败记录现象和下一步。
5. **交接**：保存成果位置、决定、验证证据、未解决问题，后续 Agent 从记录继续。

本模板不强制每次任务创建卡片、启动子 Agent 或审批设计文档，也不自动运行其他仓库的命令。

## 资料和模板

- `templates/requirement.md`：问题、用户场景、范围、验收标准。
- `templates/decision.md`：方案选择、依据、影响和替代方案。
- `templates/verification.md`：环境、用例、实际结果、证据与缺陷。
- `templates/task.md`：上下文、计划、进度、验证和交接。

带 frontmatter 的模板复制到 `src/content/` 后，替换所有占位内容与 slug，再建立相对文档链接。视觉成果放既有视觉分类，并链接关联需求与验收。任务日志保留在 `harness/tasks/`，不自动发布到资料网站。

## 验证入口

| 命令 | 使用时机 |
| --- | --- |
| `npm run check:content` | 修改项目资料后 |
| `npm run check:harness` | 检查规则文件、角色范围和页面保存边界 |
| `npm run test:harness` | 修改本地引用脚本后 |
| `npm run check` | 修改 workspace 模板或 harness 后，共享 CI 也可直接运行 |
| `npm run workspace:check` | 本机初始化或修改项目路径后，包含真实目录检查 |

`check` 不要求私有配置存在，不依赖任何业务工程。构建不导入 `code/` 下的配置。静态站点只发布 `dist/`，不能以“已加入 gitignore”为理由把个人文件放入 `public/`。

## 为另一个项目复制模板

1. 复制模板，不复制 `projects.local.json`、`node_modules/`、`dist/` 和已有任务执行记录。
2. 更新 README、首页、页面品牌文字和图片、示例中的空间名称和 `AGENTS.md` 标题。
3. 按新项目替换模板介绍和示例资料，保留资料分类及模板。历史搭建记录不作为新项目事实或当前验证结果。
4. 本机初始化代码引用，运行统一检查。
5. 在每个业务工程内分别建立其开发、构建、测试和交付约定。
