---
title: Workspace AI 新范式介绍
slug: workspace-ai-guide
description: 从创建项目空间，到关联代码仓库、配置 harness 和选择角色的完整入门。
date: '2026-09-17'
status: 使用指南
---
## 为什么需要 workspace

AI 能够快速生成代码，团队仍需要共同理解“要解决什么问题、依据什么设计、如何证明已经完成”。Workspace 将这些上下文变成可以版本管理、被人和 AI 一起维护的项目资源。

协作流程是：需求 → 设计 → 业务工程实现 → 验收 → 交接。每个角色从同一空间读取上下文，在自己负责的目录沉淀成果，通过资料链接和工程 ID 串联工作。

## 目录怎么分工

```text
workspace/
├── AGENTS.md                      # Agent 入口和工作约定
├── .agents/skills/workspace-*/     # RD、FE、PM、QA、OP、UIUE、POM 技能
├── code/
│   ├── README.md                  # 代码引用配置说明
│   ├── projects.example.json      # 团队共享的配置骨架
│   ├── projects.schema.json       # JSON 字段提示与约束
│   └── projects.local.json        # 个人名称、路径、角色，不提交
├── harness/
│   ├── README.md                  # 协作闭环与验证说明
│   ├── roles.json                 # 团队共享的角色目录映射
│   ├── templates/                 # 需求、决策、验收、任务模板
│   └── tasks/                     # 复杂任务的进度与交接
├── src/content/                   # 项目资料，网页自动生成目录
├── public/media/                  # 图片和视频
└── scripts/                       # Workspace 自身的检查工具
```

`src/` 中除 `content/` 外的前端文件是 workspace 服务本身。业务源码放在 workspace 之外，通过配置关联。

## 页面配置入口

点击右上角“空间配置”，或展开左侧“空间配置 → 配置中心”。页面可添加代码仓库、勾选多个角色、查看目录约束与完整 harness 规则，连接本地 workspace 后保存到 `code/projects.local.json`。

通过 `npm run dev` 启动时，可点击“授权绑定当前空间”，确认服务对应的 workspace 目录后读取、保存个人配置，浏览器无需支持文件夹选择接口。导入的草稿在绑定后保留，点击保存才写入文件；刷新或重启服务后重新授权。静态站点继续使用文件夹授权或导入、下载 JSON。此配置授权不代替资料和 Harness 编辑所需的文件夹授权。

一级空间按“开始阅读、产品空间、设计空间、技术空间、运维空间、测试空间、空间配置”排序。默认仅展开开始阅读；拖动左侧目录右边线可调宽，双击恢复默认。

## 第一次使用

需要 Node.js 22.12+。在 workspace 根目录执行：

```bash
npm ci
npm run workspace:init
npm run workspace:role -- PM
npm run workspace:check
npm run dev
```

`workspace:init` 只在本地配置不存在时创建文件，不覆盖已有内容。启动地址以终端显示为准。

## 代码仓库怎么配置

修改 `code/projects.local.json`。以下是完整 JSON 示例，路径需要换成本机的真实工程位置：

```json
{
  "$schema": "./projects.schema.json",
  "version": 1,
  "workspace": {
    "name": "Ai Workspace"
  },
  "roles": ["PM", "QA"],
  "projects": [
    {
      "id": "web",
      "name": "示例前端",
      "path": "../example-web"
    },
    {
      "id": "api",
      "name": "示例服务端",
      "path": "../example-api"
    }
  ]
}
```

| 字段 | 含义 |
| --- | --- |
| `version` | 配置版本，目前为 `1` |
| `workspace.name` | 本地协作使用的项目空间名称，不会自动修改网页品牌 |
| `roles` | 当前角色数组，可多选 `RD`、`FE`、`PM`、`QA`、`OP`、`UIUE`、`POM`；未选择时为 `[]` |
| `projects[].id` | 稳定工程 ID，小写字母、数字和连字符，团队资料用它引用工程 |
| `projects[].name` | 工程显示名称 |
| `projects[].path` | 本机路径，支持绝对路径、`~/` 或相对 workspace 根目录的路径 |

一个空间支持多个业务工程。暂未准备代码时使用 `"projects": []`，仍可以完成设计和资料工作。

```bash
npm run workspace:check
```

这条命令检查字段、重复 ID、目录是否存在、是否错误地指向 workspace 内部，以及多个工程是否引用同一真实目录。它不下载代码、不安装业务依赖，也不执行业务工程命令。

团队共享示例和 schema，个人配置应只留在本机。当前模板的 `code/projects.local.json` 已被 Git 跟踪，模板维护者需设置忽略规则并取消跟踪后再分发；仅添加 `.gitignore` 不会停止跟踪。复制新项目时排除旧本地配置并重新初始化。不要将个人路径写入共享 Markdown 或 `public/`。

构建不会导入个人配置，也不会将路径发布到静态网页。授权后的本地读取只用于当前配置会话；网页编辑器记住的 workspace 文件夹授权与工程引用是两种不同配置。

## 不同角色如何进入

在配置中心勾选自己的角色，可同时承担多个职责。例如选择前端研发和测试，也可执行：

```bash
npm run workspace:role -- FE QA
```

命令仅更新个人配置中的 `roles` 数组，保留工程路径。旧版 `role` 会在保存时转换为数组。然后在从此 workspace 根目录打开的 Agent 会话中，明确使用对应技能：

```text
使用 $workspace-fe，根据产品需求和视觉设计完善前端交互状态说明。
成果写入前端设计目录，引用对应需求和验收标准。
```

| 角色 | Skill | 负责的资料目录 | 典型产物 |
| --- | --- | --- | --- |
| RD · 研发设计 | `workspace-rd` | `03-技术空间/01-架构设计/`、`03-技术空间/03-Coding实战/` | 技术方案、接口契约、实现记录 |
| FE · 前端研发 | `workspace-fe` | `03-技术空间/02-前端设计/` | 组件设计、交互状态、可访问性说明 |
| PM · 产品经理 | `workspace-pm` | `01-产品空间/01-产品设计/` | 用户场景、需求、验收标准 |
| QA · 测试 | `workspace-qa` | `05-测试空间/` | 测试计划、用例、缺陷、验证证据 |
| OP · 运维 | `workspace-op` | `04-运维空间/` | 发布、监控、应急与回退手册 |
| UIUE · 视觉与体验 | `workspace-uiue` | `02-设计空间/` | 视觉规范、交互稿、体验说明 |
| POM · 项目与交付管理 | `workspace-pom` | `01-产品空间/02-项目管理/` | 里程碑、依赖、风险和交接 |

表中资料目录均位于 `src/content/` 下。POM 当前按项目与交付管理定义，团队可按职责调整角色说明。角色附件对应 `public/media/<小写角色>/`，例如 `public/media/qa/`。Agent 可按角色路径维护附件；网页编辑器目前仍统一保存至 `public/media/`，不会根据 JSON 自动切换角色。

角色可以读取其他目录，以理解上下文；普通任务可修改已选角色目录的并集；显式以某个角色执行时只修改该角色资源；所有角色可在 `harness/tasks/` 维护自己当前任务的计划与交接，不修改其他任务记录。需要改其他角色内容时，先输出交接建议，或按用户明确授权执行跨角色任务。配置目录只是 Agent 协作规则，不是网页权限系统或操作系统访问控制。

没有选择角色时不会默认指定身份；可以先阅读资料。新建 Skill 后，如果当前 Agent 会话尚未识别它，从 workspace 根目录重新打开会话；也可以明确让 Agent 读取相应的 `SKILL.md`。

## harness 怎么配置

打开左侧“空间配置 → Harness 管理”，连接当前 workspace 后直接维护团队规则：

- **Agent 工作规则**：编辑文字或 Markdown，使用阅读预览检查效果。
- **角色职责与目录约束**：选择角色，通过名称、职责和目录表单修改，无需编写 JSON。
- **Harness 协作说明**：维护团队工作流程。
- **各角色技能**：修改角色的工作规则，技能名称等元信息自动保留。

点击“保存到工程”，页面会写入默认的 `AGENTS.md`、`harness/roles.json`、`harness/README.md` 或 `.agents/skills/` 文件，不需要修改前端组件。新工程缺少某个规则文件时，页面会提供模板，保存后创建。

这些是可随工程提交的团队规则。它们与个人路径配置分开保存，个人配置的 Git 跟踪处理见上文。正在运行的 Agent 会话需要重新读取规则；新会话读取最新配置。


Workspace harness 由四部分组成：

1. **工作入口**：根 `AGENTS.md`，说明项目定位、角色读取方式、工作边界与完成标准。
2. **角色职责**：`harness/roles.json`，定义各角色的资料目录和对应 Skill。
3. **任务上下文**：`harness/templates/` 和 `harness/tasks/`，保存需求、决定、进度、证据与交接。
4. **验证工具**：`npm run check`，检查配置骨架、脚本行为、文档链接和站点构建。

角色映射使用 JSON。下面是 `roles.json` 中 FE 条目的结构示例，修改时保留其他角色：

```json
{
  "name": "前端研发",
  "skill": "workspace-fe",
  "directories": [
    "src/content/03-技术空间/02-前端设计",
    "public/media/fe"
  ],
  "outputs": "前端结构、交互状态、组件契约和可访问性说明"
}
```

角色 Skill 使用 Markdown 文件和 YAML 元信息：

```markdown
---
name: workspace-fe
description: 维护 workspace 中的前端设计资料。
---
# FE 角色协作

读取根 AGENTS.md、harness/roles.json 和本地角色配置。
普通 FE 资料任务只修改 FE 负责的资源，引用 PM 和 UIUE 的上下文。
完成后运行内容检查，记录真实结果和后续交接。
```

团队调整角色职责时同步修改 `roles.json`、对应 Skill 和入门说明；维护共享规则属于 workspace 管理任务。个人角色选择不修改团队职责表。

```bash
# 只改资料
npm run check:content

# 改 workspace 模板、脚本或 harness
npm run check

# 修改本机工程路径
npm run workspace:check
```

业务工程自己的技术栈、构建、测试和发布规则，后续在对应工程配置。进入业务工程执行任务时，先读取该工程的 Agent 约定，不复制 workspace 的 npm 检查作为业务验收。

## 新项目如何快速创建空间

1. 使用团队的 workspace 模板创建独立仓库；如果仓库平台没有模板功能，可复制模板目录，排除 `.git/`、`node_modules/`、`dist/`、`code/projects.local.json` 和已有任务执行记录，再初始化新仓库。
2. 修改 `code/projects.example.json` 的 `workspace.name`。修改 README、`AGENTS.md` 标题、首页、`index.html` 和 `src/App.vue` 中的品牌名称。同时替换 `public/brand/ai-logo.png`、`public/brand/workspace-hero.png` 和 `index.html` 所引用的 favicon；如更换文件名，同步修改页面引用。当前版本不自动将本地配置映射为网页名称。
3. 将模板介绍与示例资料替换为新项目的真实背景，保留需要的角色分类、模板和检查工具。历史搭建教程和开发记录不应作为新项目事实或验收结果沿用。
4. 初始化依赖、本地配置和角色，关联已经存在的业务仓库。

```bash
npm ci
npm run workspace:init
npm run workspace:role -- PM
# 编辑 code/projects.local.json，填写自己的项目路径
npm run workspace:check
npm run check
npm run dev
```

5. 团队成员各自克隆新 workspace，各自完成上述本地配置。共享同一份资料和 harness，保留不同的本机路径。
6. 发布资料网站时只部署 `dist/`。Agent 技能和本地工程引用在本机使用，部署静态站点不会使浏览器获得代码目录权限。

## 一次跨角色协作示例

PM 在产品目录写需求与验收条件，UIUE 在视觉目录输出设计并引用需求；FE/RD 阅读设计，在各自目录记录实现约束，然后按任务进入实际业务工程开发；QA 在测试目录记录实际结果；OP 维护发布和回退说明；POM 汇总里程碑与阻塞。

这些成果通过相对 Markdown 链接和稳定工程 ID 关联。重要决定保留理由，未验证结论标注状态，让下一位同事或 Agent 可以继续工作。
