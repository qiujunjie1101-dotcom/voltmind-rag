# Workspace 基础配置与入门重组

状态：已完成，2026-09-16。

## 目标与边界

一个项目一个 workspace，管理产品、视觉、测试资料与项目引用；业务源码和业务 harness 留在独立工程。本次是 workspace 模板管理任务，包含共享规则、角色技能、配置工具和资料组织变更。

## 交付

- 根 `AGENTS.md` 和 `harness/README.md` 作为 Agent 入口与协作闭环。
- `code/` 配置骨架、schema、本地初始化和路径校验；本地配置由 Git 忽略。
- 七个角色 Skill、`harness/roles.json`、个人角色选择命令。
- 开始阅读仅保留项目介绍和 Workspace AI 新范式介绍；写作、编辑、搭建文章迁移到 Workspace 指南，保留 slug 并修复相对链接。
- 需求、决策、任务、验证模板，以及测试、引用、前端、运维、项目管理资料分类。

## 验证

- `npm run check`：通过，8 个脚本测试、19 篇内容检查、类型检查和生产构建。
- 七个角色 Skill：通过 skill-creator 的 quick_validate。
- `git check-ignore code/projects.local.json`：确认忽略，未被跟踪。
- JSON、YAML、Bash 示例渲染验证通过。
- 独立审查的三个问题已修复：检查绑定示例、角色任务日志边界、模板品牌图片替换说明遗漏。
- 未进行真实浏览器目视检查；角色行为通过规则与结构检查验证，未宣称是文件系统权限控制。

## 交接

- 尚未提供业务工程真实路径，个人配置 projects 保持空列表，role 为 null。
- POM 暂按项目与交付管理定义，若团队实际含义不同，调整映射、Skill 与入门说明。
- 业务工程 harness 后续在各业务仓库自行配置。
- 本次未提交、推送或发布。工作区保留先前的界面和编辑器改动。
