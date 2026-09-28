# 代码项目引用

此目录登记 workspace 关联的业务工程。业务源码保留在各自独立仓库，一个空间可关联前端、后端等多个工程。

## 本地配置

1. 在 workspace 根目录运行 `npm run workspace:init`，创建 `code/projects.local.json`，已有文件不会覆盖。
2. 修改空间名称，在 `projects` 中填写本机已有工程：

```json
{
  "$schema": "./projects.schema.json",
  "version": 1,
  "workspace": { "name": "Ai Workspace" },
  "roles": [],
  "projects": [
    { "id": "web", "name": "示例前端", "path": "../example-web" },
    { "id": "api", "name": "示例服务端", "path": "../example-api" }
  ]
}
```

3. 运行 `npm run workspace:check` 验证路径。示例路径必须换成自己的路径。

支持当前操作系统的绝对路径、`~/`，以及相对 workspace 根目录的路径。路径必须指向 workspace 之外的目录，符号链接按真实位置判断。不同工程的 ID 和真实路径必须唯一；名称可以相同。空列表表示尚未关联工程，可以先做设计和资料管理。

团队提交 `projects.example.json` 和 schema，个人路径与角色保存在 `projects.local.json`，应只留在本机。新空间修改示例的空间名称后重新初始化，不将业务源码放入此仓库。

当前模板的 `projects.local.json` 已被 Git 跟踪。首次随模板提交配置后，维护者需要为 `/code/projects.local.json` 设置忽略规则，再取消该文件的 Git 跟踪；本机文件可以保留。只修改 `.gitignore` 无法停止跟踪已经提交的文件。复用模板时排除旧的本地配置，用共享示例重新初始化。

## 角色选择

网页右上角“空间配置”可添加代码仓库并多选角色；也可运行 `npm run workspace:role -- FE QA`。本地配置使用 roles 数组，例如 `"roles": ["FE", "QA"]`，初始为空数组。旧 role 单角色配置仍可读取，保存时自动转换。共享职责见 `harness/roles.json`，角色技能位于 `.agents/skills/`。

## 与网页编辑的关系

本配置供本地命令和 Agent 定位业务工程。静态网页不读取它，也不把本机路径发布到网站。网页编辑器记住的是 workspace 自身的文件夹授权，两者独立。这里的空间名称是本地协作元信息，网页品牌仍由模板页面维护。

运行 `npm run dev` 时，配置中心可授权绑定当前服务所在的 workspace。确认面板展示目标目录，授权后仅能读取和保存 `code/projects.local.json`。无需浏览器提供文件夹选择接口，导入草稿也会在绑定后保留。保存检查原文件是否变化，遇到其他程序的修改会拒绝覆盖；可下载草稿，再重新读取并合并。

授权只在当前页面会话有效，可点击“解除绑定”撤销；刷新页面或重启服务后重新授权。需要配置其他 workspace 时，从该空间启动开发服务并打开其地址。此服务仅接受本机、同源请求，不接收任意文件路径；生产静态站点继续使用文件夹授权或导入、下载方式。

## 工程边界

登记路径不触发 clone、安装依赖、执行脚本或写入业务仓库。开始业务任务时先读取目标仓库自己的 Agent 约定，具体实现、构建、测试和提交均在目标仓库完成。业务工程尚未配置 harness 时由维护者后续配置，不自动复制 workspace 的规则或检查命令。
