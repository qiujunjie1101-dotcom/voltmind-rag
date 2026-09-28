# AI2CC · AI to Coding Community

记录 AI Coding 社区从 0 到 1 的产品、架构、编码、经验与视觉设计过程。网站名称为 AI2CC，主题为 AI to Coding Community。

## 本地运行

需要 Node.js 22.12+（或满足 Vite 7 要求的版本）。

```sh
npm install
npm run dev
```

## 构建与部署

```sh
npm run build
npm run preview
```

将 `dist/` 整体部署到任意静态托管服务。使用 hash 路由，无需服务器路由回退；相对资源路径支持子目录托管。没有后端或数据库。修改 Markdown 后需重新构建发布。

## 内容维护

在 `src/content/` 添加 Markdown，文件夹自动成为多层分类；数字前缀控制排序，显示时会被去除。文档头部支持 `title`、唯一的 `slug`、`description`、字符串 `date` 和 `status`。移动文件时保留 slug 即可保持文章链接。

正文从 `##` 开始，二三级标题生成大纲。文档间使用相对 `.md` 链接。图片放在 `public/images/`，正文引用 `./images/文件名`，该路径相对于站点入口。

详见站内「内容写作指南」。默认禁用 Markdown 原始 HTML。请勿把私人或敏感文档放进公开静态产物。

## 技术结构

- Vue 3 + TypeScript + Vite
- shadcn-vue（Reka UI）+ Tailwind CSS 4
- markdown-it + markdown-it-anchor + highlight.js
- YAML 文档元信息

`src/lib/content.ts` 负责内容解析、导航树和内部链接解析；`src/components/NavTree.vue` 提供递归目录；`src/App.vue` 提供文章导航、阅读及移动端交互。

## 当前范围

包含嵌套分类、Markdown 预览、代码高亮与复制、文章大纲、前后篇导航、文章链接、移动端目录、404 状态。文档随应用一起加载，适合初始知识规模。

初始内容是项目方向与写作模板，不代表用户研究已完成。社区账户、发帖、评论和搜索尚未纳入本期。

## 本地可视化维护

在支持 File System Access API 的桌面 Chrome/Edge 中，点击“本地编辑”并选择此项目根目录。新建目录、Markdown 编辑、图片/视频粘贴与尺寸调整均由前端完成。文档写入 `src/content`，媒体以 UUID 文件名写入 `public/media`，保存前的媒体仅作为内存草稿。没有服务器上传接口。

权限被浏览器撤销时需重新连接。不支持该 API 的浏览器仍可阅读。视频粘贴取决于来源应用能否提供文件，也支持直接选择文件。尺寸仅影响显示，不重采样原始媒体。浏览器授权目录会保存在本机 IndexedDB，刷新时只在权限仍有效的情况下重新读取。

保存前比较磁盘原文，避免覆盖外部编辑。文档提交成功和读取刷新失败会分别提示。开发模式下 Markdown 热更新保留编辑器与未保存草稿。修改本地文件后，线上站点需重新构建发布。
