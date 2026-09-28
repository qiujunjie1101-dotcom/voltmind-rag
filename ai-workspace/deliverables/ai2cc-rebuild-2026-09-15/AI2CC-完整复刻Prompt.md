# AI2CC 知识库完整复刻 Prompt

> 使用方式：把本文件全文复制给 Coding Agent，并同时附上 `AI2CC-exact-template.zip`。这个 Prompt 包含明确的产品约束和完整文本源码；压缩包补全原始图片、字体、依赖锁文件、截图与校验清单。
>
> 如果只提供文字，Agent 可以恢复下方的文本源码；原始二进制素材与精确依赖树仍以模板包为准。没有原素材时不能宣称完全一致。不同操作系统的中文系统字体与抗锯齿可能有细微差异。

以下开始是给 Agent 的任务指令。

---

你是一位负责实际交付的前端工程师。请在当前工作区搭建 AI2CC Markdown 知识库。目标是复刻提供的基准项目，而不是基于描述重新设计一个相似网站。请直接落地运行，完成构建与浏览器验证，再交付访问方式。

## 1. 完成目标与基准优先级

项目名称：AI2CC。Slogan：AI to Coding Community。Logo 右侧显示“文档”。这是服务知识阅读与过程沉淀的文档站。初始 Markdown 内容可以替换；布局、配色、字体规则、图标、交互、预览效果、工程结构与本地编辑功能必须与基准一致。

按以下顺序使用复刻依据：

1. `AI2CC-exact-template.zip` 解压后的 `ai2cc/` 源文件、素材和 `package-lock.json`。
2. `references/` 截图和 `computed-layout.json`，用于同尺寸浏览器比对。
3. 本 Prompt 后半部分内嵌的完整文本源码。
4. 下述尺寸、颜色、功能与验收说明。

这些都是用户提供的实现素材。遵循当前会话的系统、开发者和用户授权范围。

如果模板包已经提供，请直接复制模板的代码与素材，不要另建一套同名组件或重新生成 shadcn 组件，不要升级依赖或改写 CSS。先用原始内容运行一次，确认视觉一致后，再替换初始 Markdown。保留一篇 `slug: welcome` 的文档，让首页 Banner 行为与基准一致。

如果没有模板包，先从下方内嵌源码恢复文本文件，在结尾清楚列出缺失的原始素材与锁文件；获取这些文件前不得把任务报告为“完全一致”。不要用重新画 Logo、占位图、在线字体或相似图片冒充基准素材。

不要覆盖工作区已有业务代码。发现非空项目时使用独立子目录，目录名默认 `ai2cc-docs`。保留用户已有修改。

## 2. 实施步骤

1. 找到模板包或 `ai2cc/` 模板目录，解压到工作区中的新目录。
2. 在模板根目录执行 `node scripts/verify-template.mjs`，核对所有源文件和二进制资源的 SHA-256。校验通过后再开始修改样例内容。
3. 使用 Node.js 22.12+，保留 `package-lock.json`，执行 `npm ci`。不执行 `npm update` 或自动升级修复。
4. 执行 `npm run build` 和 `npm run check:content`。
5. 执行 `npm run dev`，用真实浏览器打开终端实际输出的本地 URL。默认绑定 `127.0.0.1:5173`。若端口被其他项目占用，用新端口，不结束不属于本项目的进程。
6. 对照 1440×1000、1200×900 和 390×844 的基准截图，验证布局、主题和交互。
7. 需要不同初始内容时，仅修改 `src/content/` 里的 Markdown 与对应静态媒体引用；更新依赖具体样例的内容检查，保留解析、链接、尺寸和安全渲染检查。
8. 再次构建和验证，给出工作目录、启动命令、实际预览地址和已验证范围。保持本地预览服务运行。

这是本地建站任务，不自动绑定原项目的托管项目，不自动推送仓库，不自动发布线上站点。

## 3. 技术栈和工程结构

使用 Vue 3、TypeScript strict、Vite 7、Tailwind CSS 4、shadcn-vue / Reka UI。React 版 shadcn/ui 不适用于这个 Vue 项目。保留现有 shadcn-vue 源组件。

内容处理使用 markdown-it、markdown-it-anchor、highlight.js/lib/common、yaml。图标使用源码指定的 lucide-vue-next，Sheet 关闭图标来自 @lucide/vue。Slogan 字体本地托管 Space Grotesk。

不引入后端 API、数据库、登录、云存储、图片上传服务。没有 Vue Router 或 Pinia 依赖；使用 hash 路由、Vue 响应式集合与组件状态。

```text
ai2cc-docs/
├── index.html                  # 挂载入口，挂载前初始化主题
├── package.json
├── package-lock.json           # 精确依赖树
├── tsconfig.json               # strict，ES2022，@/* → src/*
├── vite.config.ts              # Vue、Tailwind、内容 HMR；base: './'
├── components.json             # shadcn-vue new-york / neutral
├── public/
│   ├── favicon.svg
│   ├── brand/
│   │   ├── ai2cc-logo.png       # 原始素材，1774×887
│   │   └── ai2cc-welcome.png    # 原始素材，1378×536
│   ├── fonts/
│   │   ├── space-grotesk.ttf
│   │   └── OFL-Space-Grotesk.txt
│   └── media/                  # 本地保存时按需创建，UUID 媒体
├── src/
│   ├── main.ts                 # style.css 后加载 theme.css
│   ├── App.vue                 # 阅读布局、路由、目录定位、主题和编辑入口
│   ├── style.css               # 原始布局和浅色样式，保留规则顺序
│   ├── theme.css               # 深色覆盖，保留选择器与优先级
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── content.ts          # Markdown、导航树、相对链接、媒体、HMR
│   │   └── local-workspace.ts  # 浏览器目录授权、磁盘读写、冲突检查
│   ├── components/
│   │   ├── NavTree.vue         # 递归多级目录
│   │   ├── LocalEditor.vue     # 按需加载的本地 Markdown 编辑抽屉
│   │   └── ui/
│   │       ├── button/
│   │       ├── collapsible/
│   │       ├── separator/
│   │       └── sheet/
│   └── content/               # 唯一 Markdown 内容来源
│       ├── 00-开始阅读/
│       ├── 01-产品设计/01-需求探索/
│       ├── 02-架构设计/
│       ├── 03-Coding 实战/
│       ├── 04-经验与分享/
│       ├── 05-工具与灵感/
│       └── 06-视觉设计/
└── scripts/
    ├── check-content.mjs
    └── verify-template.mjs     # 模板包附带的原文件校验工具
```

`references/`、`TEMPLATE-MANIFEST.json` 和复刻说明属于交付辅助材料，不要把它们做成站内菜单。

## 4. 布局尺寸与响应式规则

单位全部为 CSS px。页面不使用浏览器缩放实现缩小。

| 区域 | 基准规则 |
|---|---|
| 顶栏 | 桌面高 52，sticky top:0，z-index:30；左右 padding:24，gap:17；1px 下边框；背景轻微透明 + blur(12px) |
| 顶栏元素 | Logo、“文档”、1px 分隔线、英文 Slogan；右侧本地编辑入口、浅深色图标按钮 |
| Logo | 可见容器 100×24；原图 img 宽 150%，绝对居中 left:50% top:50%，translate(-50%,-49%)；容器 overflow:hidden 裁掉原图留白 |
| 文档标签 | 12px，weight:550，margin-left:-7px，nowrap |
| Slogan | Space Grotesk 12px/500，letter-spacing:.65px |
| 左侧栏 | 桌面宽 236，sticky top:52，高 calc(100dvh - 52px)，独立纵向滚动，1px 右边框 |
| 左栏内边距 | 顶 18、左右 16、底 28；目录标题为“文档”，右侧加号用于创建文档或目录 |
| 左栏折叠按钮 | 27×27，fixed，z-index:35，left:calc(var(--sidebar) - 14px)，top:calc(var(--header) + 15px)；在左栏分隔线旁，不在 Logo 前 |
| 收起后的按钮 | left:10px；按钮自身在被折叠 aside 外，不会跟着 inert/隐藏；仍可点击展开 |
| 主框架 | grid-template-columns:var(--sidebar) minmax(0,1fr)；折叠改为 0 minmax(0,1fr) |
| 面包屑 | 高 45，max-width:1240，margin:auto；桌面水平 padding:42，12px 字体，gap:8 |
| 阅读网格 | max-width:1240；margin:auto；列 minmax(0,740px) 160px；gap:128；padding:26px 40px 44px 42px |
| 正文 | 最大宽度 740，自适应收窄；不是全屏通栏 |
| 右侧本页目录 | 宽 160，padding-top:4；内部 sticky top:84；使用布局 gap 保持与正文的 128px 间距，不使用 translateX 推到屏幕外 |
| 首页 Banner | 只在 slug=welcome 显示；在 h1 上方；原图比例 1378/536；width:100%，height:auto，圆角 6，margin-bottom:26 |
| 本地编辑面板 | 右侧 Sheet，宽 min(1120px,96vw)，padding:23px 26px 18px，全高，内部上下布局，中间编辑区域独立滚动 |
| 编辑器双栏 | 源码 / 预览等宽；最小高度 220；源码 12px/1.85 等宽字体，padding:18px 19px；预览 padding:20px 24px |

响应式以 CSS media query 的最终层叠为准：

- 宽度 ≤1200：左栏 220；正文网格为 minmax(0,1fr) 145px；gap:88；左 padding:32；右 padding:40。不要把正文强制为 740px。
- 宽度 ≤1020：隐藏右侧目录；阅读布局 display:block；正文容器和面包屑 max-width:790；左栏仍保留到 760px。
- 宽度 ≤760：顶栏高 48，水平 padding:17、gap:10；Logo 容器 87×22；隐藏 Slogan 与顶栏分隔线；保留“文档”标签。
- 宽度 ≤760：隐藏桌面侧栏和收起按钮；面包屑左侧显示 26×26 的 Menu 按钮，打开左侧移动目录 Sheet，最大宽 290。
- 移动端面包屑高 42，水平 padding:16，字号 11。阅读区 padding:20px 21px 32px。390px 屏宽下正文宽 348px、left=21px。
- 移动端本地编辑入口仅显示 FolderOpen 图标；主题切换按钮仍可点击。面板宽 100vw，padding:20px 15px 16px；双栏编辑改为上下两行。
- 320、390、760、1021、1100、1200、1440 宽度均不应出现页面级横向溢出；表格和代码块允许在自身容器内横向滚动。

基准定位（原样首页、滚动到顶部、DPR=1）：

| 视口 | 正文起点 x/y | 正文宽 | TOC 起点 x | TOC 宽 |
|---|---|---|---|---|
| 1440×1000，展开 | 278 / 123 | 740 | 1146 | 160 |
| 1440×1000，收起 | 142 / 123 | 740 | 1010 | 160 |
| 1200×900，展开 | 252 / 123 | 675 | 1015 | 145 |
| 390×844 | 21 / 110 | 348 | 隐藏 | 0 |

文章高度由内容自然撑开，不写固定高度。替换内容后换行和文章高度可以变化。

## 5. 字体、色彩和 Markdown 视觉

正文系统字体栈固定为：
`Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif`。
不加载在线 Inter。Slogan 使用随包提供的 Space Grotesk 字体，保留 OFL 许可文件。

| 对象 | 字号/行高等 |
|---|---|
| 左侧分类、文档 | 12px，line-height:1.55，min-height:25，padding:3px 9px，圆角 3；分类 weight:550；不是 36–44px 的后台菜单行 |
| 二级分类 | 11px；嵌套文档仍 12px；嵌套 margin-left:9、padding-left:7、1px 左边线 |
| 分类间距 | 首层文件夹 margin-top:12、margin-bottom:2；文档列表 li margin:0 |
| 文档 h1 | 28px/1.4，weight:620，letter-spacing:-.8；移动端 25px |
| 描述 | 14px/1.85；移动端 13px |
| 元信息 | 11px，margin:16px 0 23px；移动端 10px；状态小边框标签 10px |
| Markdown 正文 | 14px/1.9；段落 margin:12px 0；overflow-wrap:anywhere |
| h2 | 20px/1.6，weight:600，letter-spacing:-.3，margin:30px 0 12px；移动端 19px |
| h3 | 15px，weight:600，margin:22px 0 8px |
| 强调文本 | weight:580，深于正文 |
| 引用块 | 13px；padding:10px 15px；2px 左边线；右侧 4px 圆角；移动端 12px |
| 列表 | 有序/无序真实序号或圆点，padding-left:20；li margin:6px 0 |
| 行内代码 | 12px 等宽；padding:2px 4px；1px 边框；圆角 3 |
| 代码块 | 12px/1.75；padding:32px 16px 15px；1px 边框；圆角 6；上方左侧 CODE，右侧复制按钮；移动端字号 11px |
| 表格 | 正文 13px，表头 11px/500；单元格 padding:10px 12px；1px 下边线；首列 weight:550；外围滚动容器 |
| 媒体 | max-width:100%，保持比例，圆角 6；明确 height 时 object-fit:contain |
| 右侧 TOC | 标题 11px/550；条目 11px/1.55；padding:6px 0 6px 13px；h3 左 padding:23；左侧 1px 竖线和活动指示线 |
| 前后篇 | 2 列，gap:24；margin-top:35；padding-top:19；上边线；辅助文字 11px，标题 13px/500 |

浅色核心颜色：

- 页面 `#ffffff`，根文本 `#292b31`，顶栏 `rgba(255,255,255,.96)`。
- h1 `#292c33`，正文 `#565d68`，h2 `#303743`，h3 `#414854`，strong `#363d49`。
- 文档描述 `#80858f`，元信息 `#9a9da5`，目录文档 `#767a84`，分类 `#41444d`。
- 导航 hover 背景 `#f6f6f8`；选中背景 `#f0f3fb`、文本 `#435eab`。
- 框架边线 `#ededf0`，嵌套线 `#ededf1`，正文分隔线 `#ededf1`。
- Markdown 链接 `#4a64ad`、下划线 `#d4dcef`；引用背景 `#f8f9fc`、左线 `#a7b6dc`、文字 `#79859d`。
- 行内代码背景 `#f7f7f9`、文字 `#59657c`、边线 `#eaecf0`；代码块背景 `#f8f9fb`、边线 `#eaecf1`。
- TOC 默认 `#949ba7`，活动 `#4e67ab`，活动线 `#6d85c3`。
- shadcn primary `#3f5dc1`，primary foreground `#fff`，border `#e9e9ed`，ring `#677dc3`。

深色核心颜色：

- 页面、顶栏、侧栏、编辑器主面板 `#181a1f`；标题 `#e0e4ec`；正文/分类 `#b9c1cf`。
- 次级正文/导航 `#a2adbf`，辅助文字 `#909caf`，边框 `#30343e`，顶栏下边框 `#2b2f38`。
- hover 背景 `#262b35`；导航选中背景 `#29334a`、文本 `#acc1ff`；活动链接 `#a4bbfa`。
- 引用背景 `#202735`、左边线 `#6176a5`、文字 `#b2bfd8`。
- 行内代码背景 `#252a34`、文字 `#b8c7e4`；代码块/表头 `#20232b`。
- 表单输入背景 `#232832`、边线 `#3c4657`、文本 `#c4cee0`。
- 警告背景 `#342823`，文字 `#e8b19a`；保存提示文字 `#bbd3c5`。
- 代码高亮：关键字 `#f398a4`；字符串 `#a4d3b1`；函数标题 `#c6b2ed`；数字/内置 `#91bdf1`；注释 `#909aab`。
- 原始 Logo 在深色下 `filter:invert(1);mix-blend-mode:screen`。不得反相整页，也不得反相内容图片、视频或首页 Banner。

完整颜色、圆角、阴影、状态细节以下方 `style.css`、`theme.css` 原文件为准。保留 CSS 层叠顺序，不按上述概括重写。

## 6. 图标和动画

使用 Lucide 线性图标，沿用组件默认描边。不要用 emoji 或另一套实心图标替代。

- 桌面目录折叠/展开：PanelLeftClose / PanelLeftOpen，16px。
- 移动目录：Menu，图标实际 CSS 17px。
- 目录展开箭头：ChevronRight，目录 CSS 控制 12px；展开时旋转 90deg。
- 面包屑：BookOpen 实际 13px、ChevronRight 13px。
- 本地编辑入口：FolderOpen 14px；创建入口 Plus 14px。
- 文章编辑 Pencil 13px；复制 Copy / Check 14px。
- 主题按钮：Moon / Sun 16px，容器 28×28；显示将要切换到的目标模式。
- 上下篇：ArrowLeft / ArrowRight，CSS 12px。
- 编辑器：FilePlus2、FolderPlus、Save、LoaderCircle、ImagePlus；尺寸沿源码。

动画基准：

- 主缓动 `cubic-bezier(.22,1,.36,1)`。
- 左栏列宽与按钮 left：280ms；侧栏 opacity:180ms，transform/visibility:280ms；收起 translateX(-32px)。
- 文件夹展开 210ms，从 height:0 到 Reka 提供的内容高度；关闭 180ms ease-out。
- 文章进入 220ms，opacity:0→1，translateY(5px)→0。
- 移动 Sheet 展开 250ms，关闭 180ms；遮罩 180ms；编辑面板进入 230ms、退出 180ms，位移 25px。
- Toast 180ms，位移 5px。主题图标进入 180ms，rotate(-25deg) scale(.85)→正常。
- 不额外增加大范围翻转、弹跳、页面淡出或新主题切换动画。基准主题是直接更换配色并带图标进入动画。
- `prefers-reduced-motion:reduce` 时停用动画/transition，目录锚点滚动改为 auto。

## 7. Markdown、导航与阅读功能

1. 从 `src/content/**/*.md` eager raw import 生成文档集。目录结构就是左侧树，不额外维护一份导航配置。
2. 数字前缀用于排序，例如 `01-产品设计`；展示时按源码 `clean()` 去掉数字和紧邻的点/短横线。路径排序使用 `zh-CN` numeric localeCompare。
3. 文档支持 YAML frontmatter：`title`、唯一 `slug`、`description`、字符串 `date`、`status`；没有 title 时从文件名回退；没有 slug 时从相对路径回退；默认状态“草稿”。
4. 推荐头部格式：

```md
---
title: 欢迎来到 AI2CC
slug: welcome
description: 记录一个想法从 0 到 1 的过程。
date: '2026-09-15'
status: 项目起点
---

## 从一个想法开始

这里是 Markdown 正文。
```

5. h1 由文档元信息展示；正文主要从 h2 开始。解析 h2/h3 进入右侧 TOC。slugify trim/lowercase/空白转连字符，重复标题由插件处理。
6. 路由 `#/编码后的slug`；标题深链 `#/slug?heading=编码后的id`。浏览器前进/后退有效。文章切换回页首，标题深链滚动到目标。
7. 相对 `.md` 链接与 `.md#标题` 转换为真实 hash href，支持 Ctrl/Cmd 点击与新标签页；同文档标题链接也转换。外部链接保留。
8. IntersectionObserver 更新当前 TOC；rootMargin 使用 `-90px 0px -65% 0px`；h2/h3 scroll-margin-top:76。
9. 代码高亮识别已有语言，未知语言 escapeHtml。复制按钮复制纯代码，显示“已复制”；剪贴板失败给出手动复制提示。
10. 文章有日期、状态、编辑入口、复制链接和前后篇导航；浏览器 title 随文章更新。
11. 空库与不存在的文档分别显示状态页。移动端点文档后关闭目录。
12. Markdown 原始 HTML 关闭；媒体通过自定义 renderer 支持，不能为支持视频就开启任意 HTML。
13. 当前基准不包含账户、权限后台、搜索、收藏、评论、阅读统计仪表盘。不要额外加入这些模块，也不要把已有内容改成大卡片网格。

## 8. 纯前端本地编辑与媒体

保留完整功能，不把“保存到项目”做成假的 Toast 或只写 localStorage。

### 本地目录连接

- 使用 `window.showDirectoryPicker({id:'ai2cc-project',mode:'readwrite'})`，由用户在支持该能力的浏览器中选择根目录。
- 校验目录包含 `package.json` 和 `src/content`，查询并在用户触发时请求 readwrite 权限。
- 真实 Markdown 写入所选根目录的 `src/content`；真实图片视频写入 `public/media`。
- 根目录 handle 保存到 IndexedDB：库 `ai2cc-local-project`，store `handles`，key `project`。
- 刷新时仅在权限已授予时自动恢复；权限撤销通过“重新连接”处理。
- 当前浏览器不支持 API 或页面安全环境限制时，显示源码中的清楚提示。纯网页不能通过 polyfill 获得任意本地文件覆盖权限。
- 网站阅读保持可用。不使用 OPFS、ZIP 下载、后端接口冒充“直接写入所选项目”；OPFS 只可作为独立测试夹具。

### 文档/目录编辑

- 右上角“本地编辑”、正文“编辑”、左侧“+”打开同一个按需加载的右侧 Sheet。
- 支持创建目录、选父目录创建 `.md` 文档、编辑现有文档。
- 空目录写入 `.gitkeep`，静态构建和 Git 留存后仍可见。
- 校验非法文件名、路径穿越、同名文件、重复 slug、YAML 格式。
- 源码、双栏、预览三种模式；新文件名同步 frontmatter title；随机唯一 slug。
- 未保存修改有标记；关闭、重新读取、切换模式、重新连接确认放弃；beforeunload 防误离开。
- Cmd/Ctrl+S 保存；保存中禁用/inert 编辑区域和关闭，避免请求期间又改草稿导致丢失。

### 粘贴、拖拽与尺寸

- 从 ClipboardEvent 的文件数据、DragEvent 文件数据、原生 file input 读取真实 File。支持多文件。
- 图片：PNG、JPEG、WebP、GIF、AVIF；视频：MP4、WebM、OGV、MOV。格式是否可播放取决于浏览器解码支持，不承诺转码。
- 仅有网址字符串时，不自动下载远程媒体。视频来源没有提供文件数据时，用拖入/选择文件。
- 插入时使用 `crypto.randomUUID()` 唯一命名；保留媒体原始 bytes 与扩展名，不重采样、不真实上传。
- 粘贴后仅保存在内存 File / Blob URL 预览；点保存才真正写盘；取消时释放临时 URL。
- 保存的 Markdown 使用 `![描述](./media/UUID.png "width=640")`；视频同语法，例如 `![视频](./media/UUID.webm "width=640 height=360")`。
- 媒体选择器可选已引用媒体，调整宽/高 px，宽默认 640，高为空自动；尺寸限制 1–4096，可恢复“自适应”。renderer 支持安全百分比宽度。
- 修改的只是显示尺寸；媒体 max-width:100%，明确 height 时 object-fit:contain。
- 视频 renderer 输出 controls、playsinline、preload=metadata 的 video，不能转成 iframe 或 autoplay 视频。

### 保存一致性与热更新

- 保存前对比磁盘原文与打开时原文，发现外部修改不得静默覆盖。
- 在写媒体后、写 Markdown 前再次检查文件变化；新文件出现同名冲突也要拒绝覆盖。
- 只写仍在 Markdown 中被引用的待保存媒体。先媒体，后 Markdown。
- 写文档前失败时，仅回滚本次新建文件，不删除原有媒体或原有文档。
- 文档已经写入而刷新列表失败时，提示“文件已保存，但列表刷新失败”，更新编辑器 baseline，不能假报保存失败而导致后续自冲突。
- 本地媒体通过 Blob URL 即时预览；重新读取时管理旧 URL 生命周期。
- Vite 的文档新增、修改、删除事件经 `content.ts` self-accept 模块更新；保留编辑器和未保存草稿，不触发整页刷新。
- 本地保存不会自动发布线上版本；静态发布需要重新 build。

## 9. 主题与可访问性

- 右上角点击切换浅/深色；`html[data-theme=light|dark]` 是显式主题状态。
- localStorage key 为 `ai2cc-theme`，值 light/dark。
- 第一次无保存偏好时使用 `prefers-color-scheme`。HTML head 内脚本在应用挂载前设定主题，避免挂载后的颜色闪烁。
- localStorage 不可用时仍可切换；刷新行为按无持久化处理。
- `color-scheme` 同步主题；编辑器、表单、语法高亮、Sheet、Toast 都适配。CSS 从 style.css 后加载 theme.css。
- 折叠按钮具有动态 aria-label/aria-expanded/aria-controls；被隐藏侧栏 inert。
- 移动目录和编辑器使用 Reka Dialog/Sheet 的焦点控制、Escape 与遮罩关闭；未保存时经过既有确认。
- 图标按钮有可读 aria-label；当前文章 aria-current=page；错误 role=alert；保存反馈 role=status。
- 保留“跳到正文”键盘跳转，不破坏 hash 路由；焦点框可见。

## 10. 验收与交付

不要仅凭页面打开就宣布完成。至少完成：

- 模板校验通过；`npm run build`、`npm run check:content` 通过。
- 展开/收起后图标始终可见，滚动页面后也能重新展开；布局过渡无跳变。
- 对照三个尺寸的参考坐标与浅深色截图；同内容同浏览器下关键几何误差控制在 1px 左右。系统字体差异应单独说明，不以其掩盖布局错误。
- 截图前等待字体和图片加载、至少 400ms 动画完成，不把入场动画半透明帧当最终颜色。
- 主题切换、刷新保持、移动目录、嵌套展开、TOC 深链、返回/前进、代码复制均有效。
- 在支持 API 的浏览器中用隔离的测试项目验证创建目录、创建文档、编辑、图片粘贴、视频文件插入、尺寸保存，确认磁盘中真实文件和 UUID 路径。
- 测试取消草稿不留下新媒体、外部修改拒绝覆盖、保存期间禁用编辑、刷新失败不谎报写入失败。可使用真实 FileSystemHandle 的隔离 OPFS 夹具辅助测试，但真实用户路径仍必须是目录选择授权。
- 不支持目录 API 的环境清楚提示；不得隐藏这个限制或用假的成功状态。
- 控制台无未处理错误；无断图；当前本地服务保持运行。

交付文字简要说明：项目目录、实际 URL、启动与构建命令、模板一致性结果、允许替换的 Markdown 路径，以及不能在当前环境实际验证的项目。不要声称跨浏览器都支持本地目录写入。

## 11. 固定素材与依赖

二进制素材必须从模板读取，禁止根据名字重新生成。当前锁文件解析版本如下，若与 npm 最新版不同仍以模板锁文件为准：

```json
{
  "@lucide/vue": "1.46.0",
  "@vueuse/core": "14.4.0",
  "class-variance-authority": "0.7.1",
  "clsx": "2.1.1",
  "highlight.js": "11.12.0",
  "lucide-vue-next": "0.468.0",
  "markdown-it": "14.3.2",
  "markdown-it-anchor": "9.2.1",
  "reka-ui": "2.10.4",
  "tailwind-merge": "3.7.0",
  "vue": "3.5.42",
  "yaml": "2.9.1",
  "@tailwindcss/vite": "4.3.3",
  "@types/markdown-it": "14.2.0",
  "@types/node": "22.20.2",
  "@vitejs/plugin-vue": "6.0.9",
  "tailwindcss": "4.3.3",
  "typescript": "5.9.3",
  "vite": "7.3.6",
  "vue-tsc": "3.3.11"
}
```

原始二进制素材校验：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `public/brand/ai2cc-logo.png` | 1287351 | `7f2b2ec1ae4c0ce950a53bec0c299de13b20e5da22afab676cf7b9b91efb876f` |
| `public/brand/ai2cc-welcome.png` | 167003 | `f57d54d055aa09f6608227366e6a56b519ddd42539a8873d0e66a80e0271e161` |
| `public/fonts/OFL-Space-Grotesk.txt` | 4495 | `564ce565c371c5e5bbf286006565a7c9aa55a9f56e7ca58d56e05d649dd61a72` |
| `public/fonts/space-grotesk.ttf` | 69416 | `3e699ead1876244fa392243054ddefe7cf631b488438828a8a100731a22ab995` |

## 12. 完整文本源码基准

以下文件来自实际运行的基准项目，可逐文件恢复。每个 `FILE:` 标题均为项目根目录下的相对路径。围栏内容就是文件内容，不要重新格式化 CSS、改写组件或省略逻辑。原始图片、TTF 与 package-lock.json 从模板包取得；原样例 Markdown 已包含，允许在首次验证通过后替换。校验脚本和 manifest 在模板包中。


### FILE: .gitignore

````text
node_modules/
dist/
*.tsbuildinfo
.DS_Store
.sites-runtime/
.env*
deliverables/
````

### FILE: README.md

````md
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
````

### FILE: components.json

````json
{"$schema":"https://shadcn-vue.com/schema.json","style":"new-york","typescript":true,"tailwind":{"config":"","css":"src/style.css","baseColor":"neutral","cssVariables":true},"aliases":{"components":"@/components","utils":"@/lib/utils","ui":"@/components/ui","lib":"@/lib"},"iconLibrary":"lucide"}
````

### FILE: index.html

````html
<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><meta name="description" content="AI2CC · AI to Coding Community，记录社区从 0 到 1 的产品、设计与开发过程。"/><link rel="icon" href="/favicon.svg"/><script>try{const theme=localStorage.getItem('ai2cc-theme');document.documentElement.dataset.theme=theme==='dark'||(theme!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}</script><title>AI2CC · AI to Coding Community</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>
````

### FILE: package.json

````json
{
  "name": "aicoding-notes",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "check:content": "node scripts/check-content.mjs"
  },
  "dependencies": {
    "@lucide/vue": "^1.46.0",
    "@vueuse/core": "^14.4.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "highlight.js": "^11.11.0",
    "lucide-vue-next": "^0.468.0",
    "markdown-it": "^14.1.0",
    "markdown-it-anchor": "^9.2.0",
    "reka-ui": "^2.10.4",
    "tailwind-merge": "^3.0.0",
    "vue": "^3.5.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/markdown-it": "^14.1.2",
    "@types/node": "^22.0.0",
    "@vitejs/plugin-vue": "^6.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "~5.9.2",
    "vite": "^7.0.0",
    "vue-tsc": "^3.0.0"
  }
}
````

### FILE: public/favicon.svg

````xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#202123"/><path d="m11 10-5 6 5 6m10-12 5 6-5 6m-3-14-4 16" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
````

### FILE: public/fonts/OFL-Space-Grotesk.txt

````text
Copyright 2020 The Space Grotesk Project Authors (https://github.com/floriankarsten/space-grotesk)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded, 
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
````

### FILE: scripts/check-content.mjs

````js
import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const { docs, navigation, resolveMarkdownLink, parseDocument, renderDocument, buildKnowledge } = await server.ssrLoadModule('/src/lib/content.ts')
  assert(docs.length > 0, '知识库至少应有一篇文档')
  assert.equal(new Set(docs.map(d => d.id)).size, docs.length, 'slug 必须唯一')
  for (const doc of docs) {
    assert.equal(new Set(doc.headings.map(h => h.id)).size, doc.headings.length, `${doc.title} 标题 ID 应唯一`)
    assert(!/<(?:script|iframe)\b/i.test(doc.html), '不应渲染可执行 HTML')
    for (const [, href] of doc.html.matchAll(/href="([^"]+)"/g)) {
      assert(!/\.md(?:#|$)/.test(href), `${doc.title} 存在未解析的 Markdown 链接: ${href}`)
      if (href.startsWith('#/')) {
        const [id, query] = href.slice(2).split('?')
        const target = docs.find(d => d.id === decodeURIComponent(id))
        assert(target, `${doc.title} 内部文档链接应存在`)
        const heading = new URLSearchParams(query).get('heading')
        if (heading) assert(target.headings.some(h => h.id === heading), `${doc.title} 目标标题应存在`)
      }
    }
  }
  const writing = docs.find(d => d.id === 'writing-guide')
  assert.equal(resolveMarkdownLink('#markdown-%E6%8E%92%E7%89%88%E7%A4%BA%E4%BE%8B', writing).heading, 'markdown-排版示例')
  assert.equal(resolveMarkdownLink('./02-项目愿景.md', docs.find(d => d.id === 'welcome')).doc?.id, 'vision')
  assert(navigation.some(n => n.children?.some(child => child.children)), '应包含多层目录样例')
  const mediaDoc = parseDocument('media.md', '![图片](./media/test.png "width=320")\n\n![视频](./media/test.webm "width=640 height=360")\n\n<script>alert(1)</script>')
  const mediaHtml = renderDocument(mediaDoc, [mediaDoc])
  assert(mediaHtml.includes('width:320px;'), '图片宽度应保留')
  assert(mediaHtml.includes('<video') && mediaHtml.includes('controls') && mediaHtml.includes('height:360px;'), '视频应带控制栏并保留尺寸')
  assert(!mediaHtml.includes('<script>'), '媒体语法不能开启原始 HTML 执行')
  const sized = parseDocument('invalid-size.md', '![图片](./media/test.png "width=1;position:fixed height=999999")')
  assert(!renderDocument(sized, [sized]).includes('position:fixed'), '媒体尺寸不能注入 CSS')
  assert(buildKnowledge({}, ['目录/空子目录']).navigation[0].children[0].children, '空目录也应进入文档树')
  console.log(`已验证 ${docs.length} 篇文档：唯一链接、目录层级、内部链接、中文标题与安全渲染。`)
} finally { await server.close() }
````

### FILE: src/App.vue

````vue
<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, BookOpen, Copy, FolderOpen, Pencil, Plus, Sun, Moon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import NavTree from '@/components/NavTree.vue'
import { docs, navigation, docHref, type Doc } from '@/lib/content'
import { localProject, restoreLocalProject } from '@/lib/local-workspace'
const LocalEditor = defineAsyncComponent(() => import('@/components/LocalEditor.vue'))
const editorOpen = ref(false), editorLoaded = ref(false), editorMode = ref<'edit' | 'new' | 'folder'>('edit')
const editorDocument = shallowRef<Doc>()
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
const homeLink = computed(() => docHref(docs[0]?.id || 'welcome'))
function openEditor(mode: 'edit' | 'new' | 'folder') { editorDocument.value = current.value; editorMode.value = mode; editorLoaded.value = true; editorOpen.value = true }
function saved(message: string) { toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 4000) }
const route = ref(location.hash)
const mobileOpen = ref(false)
const collapsed = ref(false)
const dark = ref(document.documentElement.dataset.theme === 'dark')
function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'
  try { localStorage.setItem('ai2cc-theme', dark.value ? 'dark' : 'light') } catch { /* Theme still works when storage is unavailable. */ }
}
const article = ref<HTMLElement>()
const activeHeading = ref('')
const copied = ref(false)
const currentId = computed(() => { try { return decodeURIComponent(route.value.replace(/^#\/?/, '').split('?')[0]) || docs[0]?.id } catch { return '' } })
const current = computed(() => docs.find(d => d.id === currentId.value))
const index = computed(() => docs.findIndex(d => d.id === currentId.value))
const previous = computed(() => docs[index.value - 1])
const following = computed(() => docs[index.value + 1])
const headingUrl = (id: string) => docHref(current.value!.id) + '?heading=' + encodeURIComponent(id)
let observer: IntersectionObserver | undefined
function onHash() { route.value = location.hash; mobileOpen.value = false }
function scrollHeading(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); activeHeading.value = id }
async function refresh() {
  document.title = `${current.value?.title || '文档未找到'} · AI2CC`
  await nextTick()
  observer?.disconnect()
  const heading = new URLSearchParams(route.value.split('?')[1]).get('heading')
  if (heading) scrollHeading(heading)
  else { window.scrollTo({ top: 0 }); activeHeading.value = current.value?.headings[0]?.id || '' }
  observer = new IntersectionObserver(entries => { const visible = entries.filter(e => e.isIntersecting); if (visible[0]) activeHeading.value = visible[0].target.id }, { rootMargin: '-90px 0px -65% 0px' })
  article.value?.querySelectorAll('h2, h3').forEach(el => observer?.observe(el))
  article.value?.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button')
    button.className = 'copy-code'; button.type = 'button'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码')
    button.onclick = async () => { try { await navigator.clipboard.writeText(pre.querySelector('code')?.textContent || ''); button.textContent = '已复制'; setTimeout(() => button.textContent = '复制', 1800) } catch { button.textContent = '请手动复制' } }
    if (!pre.querySelector('.copy-code')) pre.appendChild(button)
  })
}
watch([route, () => current.value?.html], refresh)
onMounted(() => { window.addEventListener('hashchange', onHash); refresh(); void restoreLocalProject() })
onUnmounted(() => { window.removeEventListener('hashchange', onHash); observer?.disconnect(); clearTimeout(toastTimer) })
function onArticleClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('a')
  if (!link || !current.value || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const href = link.getAttribute('href') || ''
  if (href === location.hash) {
    const heading = new URLSearchParams(href.split('?')[1]).get('heading')
    if (heading) { event.preventDefault(); scrollHeading(heading) }
  }
}
function skipToContent() { const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView() }
async function copyLink() { try { await navigator.clipboard.writeText(location.href); copied.value = true; setTimeout(() => copied.value = false, 1800) } catch { copied.value = false } }
</script>
<template>
  <a class="skip-link" href="#main-content" @click.prevent="skipToContent">跳到正文</a>
  <header class="topbar">
    <a :href="homeLink" class="brand" aria-label="AI2CC 首页"><span class="brand-logo"><img :src="'./brand/ai2cc-logo.png'" alt="AI2CC" width="1774" height="887" /></span></a>
    <span class="brand-doc-label">文档</span>
    <div class="header-divider" /><span class="header-label">AI to Coding Community</span>
    <button class="local-project-button" :aria-label="localProject.connected ? '本地项目' : '本地编辑'" @click="openEditor(current ? 'edit' : 'new')"><FolderOpen :size="14" /><span>{{ localProject.connected ? '本地项目' : '本地编辑' }}</span></button>
    <Button class="theme-toggle" variant="ghost" size="icon" :aria-label="dark ? '切换到浅色模式' : '切换到深色模式'" :title="dark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleTheme"><Sun v-if="dark" :size="16" /><Moon v-else :size="16" /></Button>
  </header>
  <div :class="['workspace', { 'sidebar-collapsed': collapsed }]">
    <Button class="sidebar-toggle" variant="ghost" size="icon" :aria-label="collapsed ? '展开目录' : '收起目录'" :aria-expanded="!collapsed" aria-controls="document-sidebar" @click="collapsed = !collapsed"><PanelLeftOpen v-if="collapsed" :size="16" /><PanelLeftClose v-else :size="16" /></Button>
    <aside id="document-sidebar" class="sidebar" :inert="collapsed || undefined">
      <div class="sidebar-heading"><span>文档</span><button aria-label="创建文档或目录" title="创建文档或目录" @click="openEditor('new')"><Plus :size="14" /></button></div>
      <nav aria-label="文档分类"><NavTree :nodes="navigation" :active="currentId" /></nav>
    </aside>
    <main id="main-content" tabindex="-1">
      <div class="breadcrumb-bar">
        <Sheet v-model:open="mobileOpen"><SheetTrigger as-child><Button class="mobile-menu" variant="ghost" size="icon" aria-label="打开文档目录"><Menu :size="20" /></Button></SheetTrigger><SheetContent side="left" class="mobile-sheet"><SheetTitle>文档目录</SheetTitle><SheetDescription>社区从 0 到 1 的成长知识库</SheetDescription><nav aria-label="移动端文档分类"><NavTree :nodes="navigation" :active="currentId" @navigate="mobileOpen = false" /></nav></SheetContent></Sheet>
        <BookOpen :size="15" class="crumb-icon" /><span>{{ current?.categories[0] || '知识库' }}</span><ChevronRight :size="13" /><span class="crumb-current">{{ current?.title || '文档未找到' }}</span>
      </div>
      <div v-if="current" class="reading-layout">
        <div :key="current.id" class="document-column">
          <img v-if="current.id === 'welcome'" class="welcome-cover" :src="'./brand/ai2cc-welcome.png'" alt="AI2CC，Max VibeCoding Developer Community，AI to Coding Community" width="1378" height="536" />
          <h1>{{ current.title }}</h1>
          <p v-if="current.description" class="document-description">{{ current.description }}</p>
          <div class="document-meta"><span v-if="current.date">更新于 {{ current.date }}</span><span class="status">{{ current.status }}</span><div class="document-actions"><button aria-label="编辑文档" @click="openEditor('edit')"><Pencil :size="13" />编辑</button><button @click="copyLink"><Check v-if="copied" :size="14" /><Copy v-else :size="14" />{{ copied ? '已复制链接' : '复制链接' }}</button></div></div>
          <Separator class="article-separator" />
          <article ref="article" class="markdown" @click="onArticleClick" v-html="current.html" />
          <div class="page-navigation"><a v-if="previous" :href="docHref(previous.id)"><span><ArrowLeft :size="14" />上一篇</span><strong>{{ previous.title }}</strong></a><div v-else /><a v-if="following" :href="docHref(following.id)" class="next-page"><span>下一篇<ArrowRight :size="14" /></span><strong>{{ following.title }}</strong></a></div>
        </div>
        <aside class="toc"><div class="toc-sticky"><div class="toc-title">本页目录</div><nav aria-label="本页目录"><a v-for="heading in current.headings" :key="heading.id" :href="headingUrl(heading.id)" :class="{ active: activeHeading === heading.id, subheading: heading.level === 3 }" @click="scrollHeading(heading.id)">{{ heading.title }}</a></nav></div></aside>
      </div>
      <div v-else class="not-found"><BookOpen :size="36" /><h1>{{ docs.length ? '这篇文档还不存在' : '还没有文档' }}</h1><p>{{ docs.length ? '链接可能有误，或文档已移动。可以从左侧目录继续阅读。' : '连接本地项目后，就可以创建第一篇 Markdown 文档。' }}</p><Button v-if="docs.length" as-child><a :href="homeLink">返回知识库</a></Button><Button v-else @click="openEditor('new')">创建第一篇文档</Button></div>
    </main>
  </div>
  <LocalEditor v-if="editorLoaded" v-model:open="editorOpen" :mode="editorMode" :document="editorDocument" @saved="saved" />
  <Transition name="toast"><div v-if="toast" class="save-toast" role="status"><Check :size="14" />{{ toast }}</div></Transition>
</template>
````

### FILE: src/components/LocalEditor.vue

````vue
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { stringify } from 'yaml'
import { FolderOpen, Save, ImagePlus, FolderPlus, FilePlus2, Check, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { docs, parseDocument, renderDocument, docHref, type Doc } from '@/lib/content'
import { connectLocalProject, createLocalFolder, localAsset, localProject, reloadLocalProject, saveLocalDocument, stageMedia, validateName, type PendingAsset } from '@/lib/local-workspace'
const props = defineProps<{ open: boolean; mode: 'edit' | 'new' | 'folder'; document?: Doc }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [message: string] }>()
const mode = ref(props.mode)
const raw = ref(''), baseline = ref(''), original = ref<string>(), filename = ref(''), parent = ref(''), error = ref(''), busy = ref(false), pane = ref<'both' | 'source' | 'preview'>('both')
const originalPath = ref(''), folderName = ref('')
const textarea = ref<HTMLTextAreaElement>(), mediaInput = ref<HTMLInputElement>()
const assets = ref<PendingAsset[]>([])
const selectedMedia = ref(0), mediaWidth = ref(640), mediaHeight = ref('')
const dirty = computed(() => raw.value !== baseline.value || (mode.value === 'new' && !!filename.value) || (mode.value === 'folder' && !!folderName.value))
const filePath = computed(() => mode.value === 'edit' ? originalPath.value : [parent.value, filename.value.replace(/\.md$/i, '') + '.md'].filter(Boolean).join('/'))
const folderOptions = computed(() => ['', ...localProject.folders])
const preview = computed(() => {
  try {
    const doc = parseDocument(filePath.value || 'preview.md', raw.value)
    return { title: doc.title, html: renderDocument(doc, [...docs.filter(d => d.path !== doc.path), doc], source => assets.value.find(asset => asset.source === source)?.objectUrl || localAsset(source)), error: '' }
  } catch (e) { return { title: '', html: '', error: (e as Error).message } }
})
const mediaEntries = computed(() => [...raw.value.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g)].map(match => ({ index: match.index!, text: match[0], label: match[1] || '媒体文件', source: match[2]!, title: match[3] || '' })))
function releaseAssets() { assets.value.forEach(asset => URL.revokeObjectURL(asset.objectUrl)); assets.value = [] }
function template(title: string) { return '---\n' + stringify({ title, slug: 'doc-' + crypto.randomUUID().slice(0, 12), date: new Date().toLocaleDateString('en-CA'), status: '草稿' }) + '---\n\n## 开始记录\n\n' }
function initialise() {
  releaseAssets(); error.value = ''; busy.value = false; mode.value = props.mode; pane.value = 'both'; selectedMedia.value = 0
  const doc = docs.find(d => d.path === props.document?.path) || props.document
  originalPath.value = doc?.path || ''; parent.value = doc?.path.split('/').slice(0, -1).join('/') || ''
  if (!folderOptions.value.includes(parent.value)) parent.value = ''
  filename.value = ''; folderName.value = ''
  original.value = mode.value === 'edit' ? doc?.raw : undefined
  raw.value = original.value ?? template('新文档'); baseline.value = raw.value
}
watch(() => props.open, open => { if (open) initialise(); else releaseAssets() }, { immediate: true })
watch(filename, name => { if (mode.value === 'new' && name.trim()) raw.value = raw.value.replace(/^title:.*$/m, 'title: ' + JSON.stringify(name.replace(/\.md$/i, ''))) })
watch([selectedMedia, mediaEntries], () => {
  const entry = mediaEntries.value[selectedMedia.value]
  if (entry) { mediaWidth.value = Number(entry.title.match(/width=(\d+)/)?.[1] || 640); mediaHeight.value = entry.title.match(/height=(\d+)/)?.[1] || '' }
})
function changeOpen(open: boolean) {
  if (!open && busy.value) return
  if (!open && dirty.value && !window.confirm('还有未保存的内容。确定关闭并放弃这些修改吗？')) return
  emit('update:open', open)
}
async function connect() {
  error.value = ''; busy.value = true
  try { await connectLocalProject(); initialise() } catch (e) { if ((e as DOMException).name !== 'AbortError') error.value = (e as Error).message } finally { busy.value = false }
}
function reconnect() { if (dirty.value && !window.confirm('重新连接会放弃未保存的修改，继续吗？')) return; void connect() }
function selectMode(next: 'new' | 'folder') { if (busy.value) return; if (dirty.value && !window.confirm('切换后将放弃未保存的内容，继续吗？')) return; mode.value = next; original.value = undefined; filename.value = ''; folderName.value = ''; raw.value = template('新文档'); baseline.value = raw.value; releaseAssets() }
async function insertFiles(files: File[]) {
  if (busy.value) return
  error.value = ''
  const start = textarea.value?.selectionStart ?? raw.value.length, end = textarea.value?.selectionEnd ?? start
  const staged: PendingAsset[] = []
  try {
    for (const file of files) staged.push(stageMedia(file))
    const inserted = staged.map(asset => `\n![${asset.file.name.replace(/[\[\]\\\r\n]/g, '').slice(0, 100) || (asset.file.type.startsWith('video/') ? '视频' : '图片')}](${asset.source} "width=640")\n`).join('\n')
    assets.value.push(...staged)
    raw.value = raw.value.slice(0, start) + inserted + raw.value.slice(end)
    await nextTick(); textarea.value?.focus(); textarea.value?.setSelectionRange(start + inserted.length, start + inserted.length)
    selectedMedia.value = Math.max(0, mediaEntries.value.length - 1)
  } catch (e) { staged.forEach(asset => URL.revokeObjectURL(asset.objectUrl)); error.value = (e as Error).message }
}
function paste(event: ClipboardEvent) { const files = Array.from(event.clipboardData?.files || []); if (files.length) { event.preventDefault(); void insertFiles(files) } }
function drop(event: DragEvent) { const files = Array.from(event.dataTransfer?.files || []); if (files.length) { event.preventDefault(); void insertFiles(files) } }
function selectFiles(event: Event) { const input = event.target as HTMLInputElement; void insertFiles(Array.from(input.files || [])); input.value = '' }
function resizeMedia(reset = false) {
  const entry = mediaEntries.value[selectedMedia.value]
  if (!entry) return
  const width = Math.min(4096, Math.max(1, Math.round(Number(mediaWidth.value) || 640)))
  const height = mediaHeight.value ? Math.min(4096, Math.max(1, Math.round(Number(mediaHeight.value) || 1))) : ''
  const replacement = `![${entry.label}](${entry.source}${reset ? '' : ' "width=' + width + (height ? ' height=' + height : '') + '"'})`
  raw.value = raw.value.slice(0, entry.index) + replacement + raw.value.slice(entry.index + entry.text.length)
}
async function save() {
  if (busy.value || !localProject.connected) return
  error.value = ''; busy.value = true
  try {
    if (mode.value === 'folder') {
      const warning = await createLocalFolder(parent.value, folderName.value)
      folderName.value = ''; emit('saved', '目录已创建到本地项目'); if (warning) error.value = warning; else emit('update:open', false)
    } else {
      if (mode.value === 'new') validateName(filename.value.replace(/\.md$/i, ''))
      if (preview.value.error) throw new Error(preview.value.error)
      const snapshot = raw.value, savedPath = filePath.value
      const result = await saveLocalDocument(savedPath, snapshot, original.value, [...assets.value])
      baseline.value = snapshot; original.value = snapshot; originalPath.value = savedPath; mode.value = 'edit'; filename.value = ''; releaseAssets()
      emit('saved', '文档和媒体已保存到本地项目')
      if (result.warning) error.value = result.warning
      else if (raw.value === snapshot) { location.hash = docHref(result.id); emit('update:open', false) }
    }
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
async function reread() {
  if (dirty.value && !window.confirm('重新读取会放弃未保存的修改，继续吗？')) return
  error.value = ''; busy.value = true
  try { await reloadLocalProject(); initialise() } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
function keyboard(event: KeyboardEvent) { if (props.open && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() } }
function beforeUnload(event: BeforeUnloadEvent) { if (props.open && (dirty.value || busy.value)) event.preventDefault() }
onMounted(() => { window.addEventListener('keydown', keyboard); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => { releaseAssets(); window.removeEventListener('keydown', keyboard); window.removeEventListener('beforeunload', beforeUnload) })
</script>
<template>
  <Sheet :open="open" @update:open="changeOpen"><SheetContent side="right" class="local-editor-sheet">
    <div class="editor-heading"><div><SheetTitle>{{ mode === 'edit' ? '编辑文档' : mode === 'folder' ? '创建目录' : '创建文档' }}</SheetTitle><SheetDescription>{{ localProject.connected ? `本地项目 · ${localProject.name}` : '直接在你选择的项目文件夹中保存内容' }}</SheetDescription></div><span v-if="dirty && localProject.connected" class="unsaved-badge">未保存</span></div>
    <div v-if="!localProject.connected" class="editor-connect"><FolderOpen :size="30" /><h3>连接本地项目</h3><p>选择包含 <code>package.json</code> 和 <code>src/content</code> 的 AI2CC 项目文件夹，并允许浏览器编辑文件。</p><p>文档写入 <code>src/content</code>，图片和视频写入 <code>public/media</code>。内容保存在你的电脑上。</p><Button :disabled="busy || !localProject.supported" @click="connect"><FolderOpen :size="15" />选择项目文件夹</Button><p v-if="!localProject.supported" class="editor-warning">当前浏览器不支持文件夹读写。请使用桌面 Chrome 或 Edge 打开本地知识库后重试。</p><span class="editor-fineprint">网站无法在未经选择和授权的情况下访问本地文件。</span></div>
    <fieldset v-else class="editor-workarea" :disabled="busy" :inert="busy || undefined" :aria-busy="busy">
      <div v-if="mode !== 'edit'" class="creation-types"><button :class="{ active: mode === 'new' }" @click="selectMode('new')"><FilePlus2 :size="14" />文档</button><button :class="{ active: mode === 'folder' }" @click="selectMode('folder')"><FolderPlus :size="14" />目录</button></div>
      <div v-if="mode !== 'edit'" class="editor-file-fields"><label>所在目录<select v-model="parent" aria-label="所在目录"><option v-for="folder in folderOptions" :key="folder" :value="folder">{{ folder || '知识库根目录' }}</option></select></label><label v-if="mode === 'new'">文件名<input v-model="filename" aria-label="文件名" placeholder="例如：我的第一篇实践" /><span>.md</span></label><label v-else>目录名<input v-model="folderName" placeholder="例如：产品调研" /></label></div>
      <template v-if="mode !== 'folder'">
        <div class="editor-toolbar"><span class="editor-path" :title="filePath">{{ mode === 'edit' ? filePath : 'Markdown' }}</span><input ref="mediaInput" type="file" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime" multiple hidden @change="selectFiles" /><button title="插入图片或视频" @click="mediaInput?.click()"><ImagePlus :size="15" /><span>插入媒体</span></button><div class="editor-view-modes" aria-label="编辑视图"><button :aria-pressed="pane === 'source'" @click="pane = 'source'">源码</button><button :aria-pressed="pane === 'both'" @click="pane = 'both'">双栏</button><button :aria-pressed="pane === 'preview'" @click="pane = 'preview'">预览</button></div></div>
        <div :class="['editor-panes', 'pane-' + pane]"><textarea v-show="pane !== 'preview'" ref="textarea" v-model="raw" aria-label="Markdown 源码" spellcheck="false" placeholder="在这里输入 Markdown，也可以粘贴图片或视频文件…" @paste="paste" @drop="drop" @dragover.prevent /><div v-show="pane !== 'source'" class="editor-preview"><p v-if="preview.error" class="editor-warning">{{ preview.error }}</p><template v-else><h2>{{ preview.title }}</h2><div class="markdown" @click="(event: MouseEvent) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault() }" v-html="preview.html" /></template></div></div>
        <div v-if="mediaEntries.length" class="media-size-tools"><label>媒体<select v-model.number="selectedMedia"><option v-for="(entry, i) in mediaEntries" :key="entry.index" :value="i">{{ entry.label }}</option></select></label><label>宽<input v-model.number="mediaWidth" type="number" min="1" max="4096" aria-label="媒体宽度" />px</label><label>高<input v-model="mediaHeight" type="number" min="1" max="4096" placeholder="自动" aria-label="媒体高度" />px</label><button @click="resizeMedia()">应用尺寸</button><button @click="resizeMedia(true)">自适应</button></div>
        <p class="editor-media-hint">支持粘贴剪贴板提供的图片、视频文件，也可拖入或选择文件。只有文字链接时不会复制媒体。原文件保留，保存时使用唯一文件名。</p>
      </template>
      <div class="editor-footer"><button class="editor-reload" :disabled="busy" @click="reread">重新读取</button><button class="editor-reload" :disabled="busy" title="更换项目文件夹或重新授权" @click="reconnect">重新连接</button><span>仅保存到本地，线上更新需重新发布</span><Button size="sm" :disabled="busy || (mode === 'new' && !filename.trim()) || (mode === 'folder' && !folderName.trim())" @click="save"><LoaderCircle v-if="busy" class="spin" :size="14" /><Save v-else :size="14" />{{ busy ? '保存中…' : mode === 'folder' ? '创建目录' : '保存到项目' }}</Button></div>
    </fieldset>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
  </SheetContent></Sheet>
</template>
````

### FILE: src/components/NavTree.vue

````vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { docHref, type NavNode } from '@/lib/content'
const props = withDefaults(defineProps<{ nodes: NavNode[]; active: string; depth?: number }>(), { depth: 0 })
const emit = defineEmits<{ navigate: [] }>()
const closed = ref<Record<string, boolean>>({})
const contains = (node: NavNode): boolean => node.doc?.id === props.active || !!node.children?.some(contains)
watch(() => props.active, () => { for (const node of props.nodes) if (contains(node)) closed.value[node.key] = false }, { immediate: true })
</script>
<template>
  <ul :class="['nav-tree', { nested: depth > 0 }]">
    <li v-for="node in nodes" :key="node.key">
      <Collapsible v-if="node.children" :open="!closed[node.key]" @update:open="closed[node.key] = !$event">
        <CollapsibleTrigger class="folder-row"><span>{{ node.title }}</span><ChevronRight :size="14" :class="{ expanded: !closed[node.key] }" /></CollapsibleTrigger>
        <CollapsibleContent><NavTree :nodes="node.children" :active="active" :depth="depth + 1" @navigate="emit('navigate')" /></CollapsibleContent>
      </Collapsible>
      <a v-else-if="node.doc" :href="docHref(node.doc.id)" :class="['doc-row', { selected: active === node.doc.id }]" :aria-current="active === node.doc.id ? 'page' : undefined" @click="emit('navigate')"><span>{{ node.title }}</span></a>
    </li>
  </ul>
</template>
````

### FILE: src/components/ui/button/Button.vue

````vue
<script setup lang="ts">
import type { PrimitiveProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import type { ButtonVariants } from "."
import { Primitive } from "reka-ui"
import { cn } from "@/lib/utils"
import { buttonVariants } from "."

interface Props extends PrimitiveProps {
  variant?: ButtonVariants["variant"]
  size?: ButtonVariants["size"]
  class?: HTMLAttributes["class"]
}

const props = withDefaults(defineProps<Props>(), {
  as: "button",
})
</script>

<template>
  <Primitive
    data-slot="button"
    :data-variant="variant"
    :data-size="size"
    :as="as"
    :as-child="asChild"
    :class="cn(buttonVariants({ variant, size }), props.class)"
  >
    <slot />
  </Primitive>
</template>
````

### FILE: src/components/ui/button/index.ts

````ts
import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        "default": "h-9 px-4 py-2 has-[>svg]:px-3",
        "xs": "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        "sm": "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        "lg": "h-10 rounded-md px-6 has-[>svg]:px-4",
        "icon": "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)
export type ButtonVariants = VariantProps<typeof buttonVariants>
````

### FILE: src/components/ui/collapsible/Collapsible.vue

````vue
<script setup lang="ts">
import type { CollapsibleRootEmits, CollapsibleRootProps } from "reka-ui"
import { CollapsibleRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<CollapsibleRootProps>()
const emits = defineEmits<CollapsibleRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <CollapsibleRoot
    v-slot="slotProps"
    data-slot="collapsible"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </CollapsibleRoot>
</template>
````

### FILE: src/components/ui/collapsible/CollapsibleContent.vue

````vue
<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui"
import { CollapsibleContent } from "reka-ui"

const props = defineProps<CollapsibleContentProps>()
</script>

<template>
  <CollapsibleContent
    data-slot="collapsible-content"
    v-bind="props"
  >
    <slot />
  </CollapsibleContent>
</template>
````

### FILE: src/components/ui/collapsible/CollapsibleTrigger.vue

````vue
<script setup lang="ts">
import type { CollapsibleTriggerProps } from "reka-ui"
import { CollapsibleTrigger } from "reka-ui"

const props = defineProps<CollapsibleTriggerProps>()
</script>

<template>
  <CollapsibleTrigger
    data-slot="collapsible-trigger"
    v-bind="props"
  >
    <slot />
  </CollapsibleTrigger>
</template>
````

### FILE: src/components/ui/collapsible/index.ts

````ts
export { default as Collapsible } from "./Collapsible.vue"
export { default as CollapsibleContent } from "./CollapsibleContent.vue"
export { default as CollapsibleTrigger } from "./CollapsibleTrigger.vue"
````

### FILE: src/components/ui/separator/Separator.vue

````vue
<script setup lang="ts">
import type { SeparatorProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { Separator } from "reka-ui"
import { cn } from "@/lib/utils"

const props = withDefaults(defineProps<
  SeparatorProps & { class?: HTMLAttributes["class"] }
>(), {
  orientation: "horizontal",
  decorative: true,
})

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <Separator
    data-slot="separator"
    v-bind="delegatedProps"
    :class="
      cn(
        'bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px',
        props.class,
      )
    "
  />
</template>
````

### FILE: src/components/ui/separator/index.ts

````ts
export { default as Separator } from "./Separator.vue"
````

### FILE: src/components/ui/sheet/Sheet.vue

````vue
<script setup lang="ts">
import type { DialogRootEmits, DialogRootProps } from "reka-ui"
import { DialogRoot, useForwardPropsEmits } from "reka-ui"

const props = defineProps<DialogRootProps>()
const emits = defineEmits<DialogRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
</script>

<template>
  <DialogRoot
    v-slot="slotProps"
    data-slot="sheet"
    v-bind="forwarded"
  >
    <slot v-bind="slotProps" />
  </DialogRoot>
</template>
````

### FILE: src/components/ui/sheet/SheetClose.vue

````vue
<script setup lang="ts">
import type { DialogCloseProps } from "reka-ui"
import { DialogClose } from "reka-ui"

const props = defineProps<DialogCloseProps>()
</script>

<template>
  <DialogClose
    data-slot="sheet-close"
    v-bind="props"
  >
    <slot />
  </DialogClose>
</template>
````

### FILE: src/components/ui/sheet/SheetContent.vue

````vue
<script setup lang="ts">
import type { DialogContentEmits, DialogContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { X } from "@lucide/vue"
import { reactiveOmit } from "@vueuse/core"
import {
  DialogClose,
  DialogContent,
  DialogPortal,
  useForwardPropsEmits,
} from "reka-ui"
import { cn } from "@/lib/utils"
import SheetOverlay from "./SheetOverlay.vue"

interface SheetContentProps extends DialogContentProps {
  class?: HTMLAttributes["class"]
  side?: "top" | "right" | "bottom" | "left"
}

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<SheetContentProps>(), {
  side: "right",
})
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, "class", "side")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <DialogPortal>
    <SheetOverlay />
    <DialogContent
      data-slot="sheet-content"
      :class="cn(
        'bg-background data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col gap-4 shadow-lg transition ease-in-out data-[state=closed]:duration-300 data-[state=open]:duration-500',
        side === 'right'
          && 'data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right inset-y-0 right-0 h-full w-3/4 border-l sm:max-w-sm',
        side === 'left'
          && 'data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left inset-y-0 left-0 h-full w-3/4 border-r sm:max-w-sm',
        side === 'top'
          && 'data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top inset-x-0 top-0 h-auto border-b',
        side === 'bottom'
          && 'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom inset-x-0 bottom-0 h-auto border-t',
        props.class)"
      v-bind="{ ...$attrs, ...forwarded }"
    >
      <slot />

      <DialogClose
        class="ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
````

### FILE: src/components/ui/sheet/SheetDescription.vue

````vue
<script setup lang="ts">
import type { DialogDescriptionProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogDescription } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DialogDescriptionProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <DialogDescription
    data-slot="sheet-description"
    :class="cn('text-muted-foreground text-sm', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogDescription>
</template>
````

### FILE: src/components/ui/sheet/SheetFooter.vue

````vue
<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <div
    data-slot="sheet-footer"
    :class="cn('mt-auto flex flex-col gap-2 p-4', props.class)
    "
  >
    <slot />
  </div>
</template>
````

### FILE: src/components/ui/sheet/SheetHeader.vue

````vue
<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { cn } from "@/lib/utils"

const props = defineProps<{ class?: HTMLAttributes["class"] }>()
</script>

<template>
  <div
    data-slot="sheet-header"
    :class="cn('flex flex-col gap-1.5 p-4', props.class)"
  >
    <slot />
  </div>
</template>
````

### FILE: src/components/ui/sheet/SheetOverlay.vue

````vue
<script setup lang="ts">
import type { DialogOverlayProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogOverlay } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DialogOverlayProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <DialogOverlay
    data-slot="sheet-overlay"
    :class="cn('data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogOverlay>
</template>
````

### FILE: src/components/ui/sheet/SheetTitle.vue

````vue
<script setup lang="ts">
import type { DialogTitleProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { DialogTitle } from "reka-ui"
import { cn } from "@/lib/utils"

const props = defineProps<DialogTitleProps & { class?: HTMLAttributes["class"] }>()

const delegatedProps = reactiveOmit(props, "class")
</script>

<template>
  <DialogTitle
    data-slot="sheet-title"
    :class="cn('text-foreground font-semibold', props.class)"
    v-bind="delegatedProps"
  >
    <slot />
  </DialogTitle>
</template>
````

### FILE: src/components/ui/sheet/SheetTrigger.vue

````vue
<script setup lang="ts">
import type { DialogTriggerProps } from "reka-ui"
import { DialogTrigger } from "reka-ui"

const props = defineProps<DialogTriggerProps>()
</script>

<template>
  <DialogTrigger
    data-slot="sheet-trigger"
    v-bind="props"
  >
    <slot />
  </DialogTrigger>
</template>
````

### FILE: src/components/ui/sheet/index.ts

````ts
export { default as Sheet } from "./Sheet.vue"
export { default as SheetClose } from "./SheetClose.vue"
export { default as SheetContent } from "./SheetContent.vue"
export { default as SheetDescription } from "./SheetDescription.vue"
export { default as SheetFooter } from "./SheetFooter.vue"
export { default as SheetHeader } from "./SheetHeader.vue"
export { default as SheetTitle } from "./SheetTitle.vue"
export { default as SheetTrigger } from "./SheetTrigger.vue"
````

### FILE: src/content/00-开始阅读/01-欢迎来到起点.md

````md
---
title: 欢迎来到 AI2CC
slug: welcome
description: 一个 AI Coding 社区从 0 到 1 的生长记录。把想法写下来，把过程留下来，把经验分享出去。
date: '2026-09-14'
status: 项目起点
---
## 从一个想法开始

我们想做一个面向国内的 **AI Coding 分享、交流与学习社区**。让有想法的人能够借助 AI，把脑海中的 idea 变成真正可以使用的产品。

这份知识库，是这个社区的第一块基石。从产品构想到设计与开发，从踩坑记录到经验分享，我们会在这里留下从 0 到 1 的完整过程。

> **先做出来，再一起变好。**
>
> 不必等到一切准备就绪。每一次尝试、每一个决定、每一份复盘，都是值得沉淀的知识。

## 我们会在这里记录什么

| 知识板块 | 我们关心的问题 |
| --- | --- |
| 产品设计 | 为谁解决什么问题？如何把想法变成可验证的需求？ |
| 架构设计 | 如何选择技术方案，让第一版简单，也方便后续迭代？ |
| Coding 实战 | 如何与 AI 协作，把一个功能真正做出来？ |
| 经验与分享 | 哪些方法有效？踩过哪些坑？可以如何复用？ |
| 工具与灵感 | 有哪些值得亲自试用的工具、作品和工作流？ |
| 视觉设计 | 如何让产品清晰、易用，并拥有自己的气质？ |

## 从 0 到 1 的路线

### 01 · 把想法说清楚

从具体的人和场景出发，记录问题、假设与待验证的信号。先回答“为什么有人需要它”，再决定“我们要做什么”。

### 02 · 做出最小可用版本

围绕一个核心场景完成设计、架构和开发。让真实用户能够走完一次完整流程，用反馈推动下一步。

### 03 · 在实践中持续生长

记录每次迭代的选择与结果，把零散经验整理成他人能够理解、尝试和复用的内容。

## 如何使用这份知识库

- **第一次来**：先读[项目愿景](./02-项目愿景.md)，了解我们想做什么。
- **准备参与设计**：从[核心用户与使用场景](../01-产品设计/01-需求探索/01-核心用户与场景.md)开始，把模糊想法变成具体问题。
- **准备动手开发**：查看[知识库技术方案](../02-架构设计/01-知识库技术方案.md)，了解当前站点如何运行。
- **准备记录过程**：参考[内容写作指南](./03-内容写作指南.md)，新增一篇 Markdown 即可开始。

## 当前进度

目前处于 **想法探索阶段**。这份知识库先于社区产品搭建，用来支撑后续协作、决策和复盘。

现有文档是工作起点，其中用户画像、MVP 范围和产品方向都还需要进一步验证。我们会保留决策依据，也会坦诚记录改变想法的原因。

**下一步：找到第一个值得解决的真实问题。**
````

### FILE: src/content/00-开始阅读/02-项目愿景.md

````md
---
title: 项目愿景
slug: vision
description: 让更多有想法的人，用 AI 完成自己的第一个作品。
date: '2026-09-14'
status: 方向草案
---
## 我们想做什么

面向国内 AI Coding 实践者，构建一个分享作品、交流过程、共同学习的社区。这里既关注做出了什么，也关注如何做出来。

## 已经明确的方向

- 以 AI Coding 和 Vibe Coding 的真实实践为主题。
- 鼓励记录从 idea 到上线的完整过程。
- 将产品、架构、编码与视觉设计放在同一个实践语境中。
- 通过分享与讨论，让经验可以被他人复用。

## 仍需验证的假设

1. 初学者是否更需要完整案例，而不是零散提示词？
2. 创作者是否愿意持续公开项目过程？
3. 交流、作品展示、结构化教程中，哪一种最能带来持续价值？

这些是探索问题，不是已经得到证实的用户结论。

## 第一阶段的成功信号

先观察少量真实参与者能否完成学习、动手与分享的循环。具体衡量方式和目标值在用户访谈后确定，不把社区规模当作第一版唯一目标。
````

### FILE: src/content/00-开始阅读/03-内容写作指南.md

````md
---
title: 内容写作指南
slug: writing-guide
description: 用 Markdown 记录思考，让目录和排版交给知识库。
date: '2026-09-14'
status: 使用指南
---
## 新增一篇文档

在 `src/content/` 对应分类下新建 `.md` 文件。目录按文件夹自动生成，数字前缀用于排序，展示时自动隐藏。新增文件后，本地开发页面会更新；线上站点需要重新构建发布。

```text
src/content/
  01-产品设计/
    01-需求探索/
      01-核心用户与场景.md
      02-访谈记录.md
  03-Coding 实战/
    01-AI 协作工作流.md
```

可以继续嵌套文件夹，不需要手动编辑侧栏配置。

## 设置文档信息

文件开头填写 YAML 信息。`slug` 是唯一链接标识，移动或重命名文件时保留它，可以维持文章链接稳定。日期建议加引号。

```yaml
---
title: 我的第一篇实践记录
slug: my-first-build
description: 这次解决了什么问题，有哪些收获。
date: '2026-09-14'
status: 实践记录
---
```

正文从二级标题开始，文章标题由 `title` 统一显示。二级和三级标题自动进入右侧大纲。

## 写下过程，而不只是结论

一篇有用的实践记录可以包含：

1. **背景**：原本遇到了什么问题？
2. **尝试**：用了什么方法，为什么选择它？
3. **结果**：实际发生了什么，如何验证？
4. **复盘**：下一次会保留或改变什么？

> 将事实、推测和待验证项区分开。没有做过的实验，不写成已经验证的经验。

## Markdown 排版示例

支持 **粗体**、*强调*、`行内代码`、引用、有序和无序列表、表格、图片以及带语言标识的代码块。为保证静态内容安全，正文中的原始 HTML 不会执行。

```typescript
const idea = '让更多人完成自己的第一个作品'
const nextStep = '找到一个真实问题'
console.log({ idea, nextStep })
```

| 类型 | 建议内容 |
| --- | --- |
| 产品决策 | 背景、选项、取舍、验证方式 |
| 开发记录 | 目标、关键实现、问题、验证结果 |
| 工具体验 | 具体场景、亲测过程、优点和限制 |

## 链接与图片

文档之间使用相对 `.md` 链接。例如 `[项目愿景](./02-项目愿景.md)`。标题链接可以写成 `[排版示例](#markdown-排版示例)`。

图片放入 `public/images/`，在正文使用 `![图片说明](./images/example.png)`。图片路径相对于站点根入口，请勿引用个人电脑绝对路径。替代文本应描述图片中的关键信息。

## 发布前检查

- 文档标题清晰，`slug` 没有重复。
- 内容来源和验证状态写清楚。
- 代码、链接和图片已检查。
- 没有密钥、账号隐私或未经授权的材料。
- 执行构建后，将 `dist/` 更新到静态托管服务。
````

### FILE: src/content/00-开始阅读/04-本地编辑与媒体.md

````md
---
title: 本地编辑与媒体
slug: local-editor
description: 直接在浏览器中维护项目文件，图片和视频与文档一起留在本地。
date: '2026-09-15'
status: 使用指南
---
## 连接项目文件夹

点击右上角 **本地编辑**，选择项目根文件夹，并允许浏览器读写。这个文件夹内应包含 `package.json` 和 `src/content`。

直接读写文件夹需要桌面 Chrome、Edge 等支持 File System Access API 的浏览器。若当前应用内浏览器提示不支持，请在 Chrome 中打开本地知识库。浏览器只能访问你明确选择并授权的文件夹。

## 创建目录和文档

点击左侧“文档”旁的加号，选择创建文档或目录，再指定所在目录与名称。

- 文档保存为 `src/content/所选目录/文档名.md`。
- 新目录会写入 `.gitkeep`，空目录也能被 Git 保留。
- 文件名用于本地路径；文档中的 `title` 控制显示标题，`slug` 控制访问链接。
- 同名文件与重复 slug 会阻止保存，不会静默覆盖现有文档。

## 编辑与预览

点击文章信息行中的 **编辑**。编辑器提供 Markdown 源码、预览和双栏视图，文件开头的 YAML 信息也可直接修改。

使用 **保存到项目**，或按 `⌘S` / `Ctrl+S` 写入文件。文件已被其他编辑器修改时，会提示冲突并保留当前草稿；可以复制需要保留的内容，再重新读取和合并。

## 粘贴图片和视频

将剪贴板中的图片、视频文件粘贴到 Markdown 输入框，或使用“插入媒体”选择文件，也可以拖入文件。

剪贴板是否提供视频文件，取决于来源应用和浏览器。只有文字链接时，不会自动下载媒体；这种情况下请使用文件选择入口。

媒体先在草稿中预览，点击保存后才写入 `public/media`，文件名由 UUID 生成。取消编辑不会把草稿中的媒体写入项目，也不会修改原文件。

## 调整媒体尺寸

插入媒体后，在编辑器下方选择对应文件，设置宽度和可选高度，再点击“应用尺寸”。高度留空时保持原始比例；点击“自适应”可恢复默认尺寸。

尺寸保存在标准 Markdown 的标题字段中，例如：

```markdown
![流程截图](./media/唯一文件名.png "width=640")
![演示视频](./media/唯一文件名.webm "width=640 height=360")
```

知识库会把常见视频后缀渲染为带控制栏的视频，图片和视频都不会超出正文宽度。原始媒体保持不变，只调整展示尺寸。

## 保存与发布的区别

所有创建、粘贴和保存都由前端直接操作授权的本地文件夹，没有上传接口，也不需要后端。

本地保存完成后，知识库会重新读取文档。线上静态站点不会随之自动变化，需要重新构建并发布。保存的目录授权通常可以被浏览器记住；若权限过期，重新选择项目即可。
````

### FILE: src/content/01-产品设计/01-需求探索/01-核心用户与场景.md

````md
---
title: 核心用户与场景
slug: users-and-scenarios
description: 从具体的人和具体的问题开始，避免为想象中的用户堆叠功能。
date: '2026-09-14'
status: 待验证
---
## 初始用户假设

以下是后续访谈的候选方向，尚未形成优先级。

| 候选人群 | 可能遇到的问题 | 需要验证的行为 |
| --- | --- | --- |
| 有想法的非技术创作者 | 能生成代码，但难以把产品完整落地 | 是否尝试过发布一个可用作品 |
| 刚开始用 AI 的开发者 | 不清楚怎样组织上下文与验证结果 | 是否愿意阅读和复用完整工作流 |
| 独立开发者 | 项目经验分散，缺少高质量交流 | 是否愿意分享过程并回答问题 |

## 优先探索的场景

一个人看到社区里的真实项目，理解它解决的问题，按照过程记录完成一次尝试，并能在遇到问题时发起具体讨论。

这只是初始场景，是否作为 MVP 核心流程，需要真实访谈支撑。

## 访谈问题

1. 最近一次借助 AI 做作品是什么时候？最后做到哪一步？
2. 卡住时，你在哪里寻找帮助？哪些资料真正有用？
3. 你会收藏什么样的案例？有没有实际复现过？
4. 什么情况下，你愿意把自己的过程公开分享？

## 如何沉淀反馈

记录原话、具体行为和背景，避免只记录“用户喜欢”。将观察到的事实与我们的推断分开，并为每个判断保留证据。
````

### FILE: src/content/01-产品设计/02-MVP 范围.md

````md
---
title: MVP 范围
slug: mvp-scope
description: 先让一个核心流程成立，再逐步扩展社区能力。
date: '2026-09-14'
status: 待讨论
---
## 当前正在建设

知识库作为项目过程的沉淀空间，具备多层级 Markdown 导航、文档阅读、代码高亮与文章大纲。它是产品建设的基础设施。

## 社区 MVP 的候选核心流程

发现一个项目 → 阅读实现过程 → 自己动手尝试 → 针对问题交流。

是否选择这条流程，需要结合用户访谈和内容供给能力决定。账号、发帖、评论等能力尚未实现，也不属于当前纯静态知识库。

## 暂缓讨论的能力

积分体系、复杂推荐、付费课程与大规模运营工具，等核心价值验证后再评估。

## 下一次需要作出的决定

明确第一批目标用户、最重要的使用场景，以及第一批由谁来提供的内容。
````

### FILE: src/content/02-架构设计/01-知识库技术方案.md

````md
---
title: 知识库技术方案
slug: knowledge-base-architecture
description: 以文件为内容源，以静态构建提供稳定、轻量的阅读服务。
date: '2026-09-14'
status: 实现说明
---
## 技术组成

| 层次 | 选择 | 职责 |
| --- | --- | --- |
| 应用 | Vue 3 + TypeScript | 组件、响应式状态与导航 |
| 构建 | Vite | 导入 Markdown，输出静态资源 |
| 界面 | shadcn-vue + Tailwind CSS | 可访问的交互组件与统一视觉 |
| 内容 | Markdown + YAML | 文档正文、标题与元数据 |
| 渲染 | markdown-it + highlight.js | Markdown 排版、代码高亮 |

## 内容如何进入页面

构建工具读取 `src/content/**/*.md`。应用解析元数据，以文件夹构建导航树，再渲染 Markdown 正文。内容随静态资源一起发布，不需要数据库或后端服务。

```text
Markdown 文件
  → 读取元数据与目录层级
  → 构建文档树与文章大纲
  → Vue 阅读界面
  → dist 静态资源
```

## 导航与部署

使用 hash 路由，例如 `#/welcome`。刷新文章页时请求仍然落在静态首页，不要求托管平台配置路由重写。标题大纲使用文章链接中的 `heading` 参数保存位置。

## 当前边界

文档在构建时打包，修改内容需要重新构建上线。提供通过浏览器 File System Access API 的本地编辑，直接写入授权的项目文件夹；没有服务端用户账号、访问权限管理或讨论系统。公开部署的静态资源可被读取，因此不能放入需要保密的文档。

当前全文随应用加载，适合初期内容规模。文档体积明显增长时，再评估按文章懒加载与索引拆分。

## 后续演进

先观察真实内容增长与使用反馈。搜索、内容工作流、权限与社区服务在需求明确后再引入，避免提前增加维护成本。
````

### FILE: src/content/03-Coding 实战/01-AI 协作工作流.md

````md
---
title: AI 协作工作流
slug: ai-collaboration
description: 一次只推进一个可验证的目标，把上下文和结果都说清楚。
date: '2026-09-14'
status: 方法草案
---
## 开始前：写清目标

说明当前用户、待解决的问题、已有环境和验收方式。将期望行为举成具体例子，比只说“做得高级一点”更容易协作。

## 实施中：缩小改动范围

先做一个端到端的最小流程。每次迭代明确输入、输出和边界，遇到错误时提供可复现步骤与真实错误信息。

```text
目标：新增一篇经验记录，并在侧栏展示。
输入：带有 title、slug 的 Markdown 文件。
预期：目录出现新文章，点击可以阅读，刷新链接仍然有效。
验证：本地阅读、手机布局、生产构建。
```

## 完成后：验证真实行为

运行成功只是起点。检查用户能否完成任务、异常状态是否明确、不同屏幕是否可用。对关键结果保留可复现的验证方法。

## 最后：写一份短复盘

留下本次目标、关键取舍、遇到的问题与解决方式。将仍有疑问的地方标注为待验证，下一次继续补充。
````

### FILE: src/content/03-Coding 实战/02-知识库搭建记录.md

````md
---
title: 知识库搭建记录
slug: knowledge-base-build-log
description: 从空目录到可运行的文档站，记录第一次实现的范围、取舍和验证。
date: '2026-09-14'
status: 开发记录
---
## 这次解决的问题

社区产品目前只有初始想法，需要一个轻量的空间，持续沉淀产品设计、架构、开发过程与经验分享。第一版选择纯静态前端，通过仓库中的 Markdown 维护内容。

## 实现范围

- Vue 3、TypeScript、shadcn-vue 和 Tailwind CSS。
- 文件夹自动生成多层级分类，支持折叠和展开。
- Markdown 阅读、代码高亮和复制、文章大纲。
- 稳定的文章链接、前后篇导航和不存在文档的提示。
- 桌面三栏布局，手机端抽屉目录。

## 为什么这样选择

静态站点不需要维护后端或数据库，内容和代码一起保存，方便追踪每一次变化。文章使用独立 slug，目录调整后仍能保留访问链接。

当前文档量较少，先把内容随应用一起构建；后续规模增长后再考虑懒加载与搜索索引。

## 评审中修复的问题

1. 键盘“跳到正文”原本会改变 hash，误触发文章路由。改为聚焦和滚动正文。
2. 中文标题链接存在重复编码。统一解码后再转换为文章标题参数。
3. 内部 Markdown 链接最初只处理普通点击。改为渲染时生成正式文章链接，兼容新标签打开和链接复制。

## 已完成的验证

类型检查和生产构建通过。内容检查覆盖唯一 slug、多层目录、站内文档链接及中文标题解析。Chrome 自动化验证了页面渲染、文档切换、刷新、目录折叠、404 状态以及手机目录导航，未发现运行时异常。

桌面和手机截图已经目视检查。当前第一版尚未包含在线编辑、账号或讨论系统，社区本身的 MVP 仍需继续设计。

## 下一步

先通过真实内容使用这份知识库，再共同明确社区的首批用户、核心场景和最小产品范围。
````

### FILE: src/content/04-经验与分享/01-实践复盘模板.md

````md
---
title: 实践复盘模板
slug: retrospective-template
description: 让一次实践的收获，成为下一次可以复用的方法。
date: '2026-09-14'
status: 内容模板
---
## 背景与目标

用几句话交代起点、具体场景与预期结果。附上必要的项目或问题链接。

## 关键过程

按重要决策组织内容，记录考虑过的选项、选择依据以及实际操作。不要把完整对话记录直接当作经验总结。

## 结果与证据

说明最终实现了什么、如何验证、仍存在哪些限制。没有数据时，如实记录观察，不编造收益比例。

## 踩坑与改进

记录问题现象、定位方法和修复思路。补充下一次如何更早发现同类问题。

## 可复用结论

提炼适用场景和使用前提，并列出下一步需要验证的事项。
````

### FILE: src/content/05-工具与灵感/01-工具体验记录.md

````md
---
title: 工具体验记录
slug: tool-notes
description: 从真实任务出发，记录工具在哪些地方帮上了忙。
date: '2026-09-14'
status: 内容模板
---
## 先记录使用场景

你要完成什么任务？此前的做法是什么？这次为什么选择试用这个工具？

## 亲测过程

填写使用日期、版本、输入和操作步骤。涉及费用、模型能力或平台限制的描述，需要注明实际验证时间和来源。

## 结果与限制

记录做到了什么、失败在哪里、需要人工介入的部分。将自己的体验与官方能力说明区分开。

## 是否值得复用

说明适合谁、适合什么任务、有什么前提。推荐建立在具体证据上，避免只列工具名称或泛泛而谈。
````

### FILE: src/content/06-视觉设计/01-知识库视觉原则.md

````md
---
title: 知识库视觉原则
slug: visual-principles
description: 让内容成为主角，让结构帮助阅读。
date: '2026-09-14'
status: 初版规范
---
## 视觉方向

AI2CC 知识库以清晰的文档结构为核心。使用白色阅读区与导航区，结合细分隔线，蓝色用于当前导航、正文链接与大纲位置。

## 三栏阅读结构

左侧表示知识分类，中间承载文章，右侧展示当前文档的标题大纲。小屏幕隐藏大纲，分类目录通过按钮打开。

## 内容排版

标题、摘要、元信息与正文形成连续的阅读层次。正文保留充分行距，引用使用轻量背景，代码和表格使用独立边界，长代码块允许横向滚动。

## 交互原则

导航选中状态明确，目录可折叠。按钮提供可理解的文字或标签，键盘用户能访问导航与移动端抽屉。移除空间卡片、页尾口号与重复分类标签。目录折叠约 200ms、文章淡入约 220ms、移动端抽屉约 250ms；用户启用系统“减少动态效果”时关闭动画。

## 后续品牌探索

网站名称为 **AI2CC**，主题为 **AI to Coding Community**。在这一命名基础上，后续继续探索社区标识、品牌叙事和更完整的视觉体系。

## 紧凑的界面尺度

桌面页头高度为 52px，目录行高为 25px，文章标题为 28px，正文为 14px。通过字号、字重与留白区分层级，减少图标和卡片边框。手机端保持可点击的目录行高，表格和代码独立横向滚动。

这一版参考了 [Mintlify 导航](https://www.mintlify.com/docs/organize/navigation)与 [GitBook 文档布局](https://gitbook.com/docs/publishing-documentation/customization/layout-and-structure)的文字导航和清晰层级，延续 AI2CC 自己的简洁视觉。

## 品牌素材

页头使用提供的 AI2CC 图片 Logo，欢迎页顶部使用提供的品牌横幅，原始图片保存在 `public/brand`。Slogan 使用本地托管的 Space Grotesk 字体。左侧目录的收放入口固定在页头，滚动后仍可访问。
````

### FILE: src/lib/content.ts

````ts
import { reactive } from 'vue'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import hljs from 'highlight.js/lib/common'
import { parse } from 'yaml'

export interface Heading { id: string; title: string; level: number }
export interface Doc { id: string; path: string; raw: string; title: string; description: string; date: string; status: string; body: string; html: string; headings: Heading[]; categories: string[]; minutes: number }
export interface NavNode { key: string; title: string; children?: NavNode[]; doc?: Doc }
export type AssetResolver = (src: string) => string
const md: MarkdownIt = new MarkdownIt({ html: false, linkify: true, typographer: true, highlight(code, language): string { return hljs.getLanguage(language) ? hljs.highlight(code, { language }).value : md.utils.escapeHtml(code) } }).use(anchor, { level: [2, 3], slugify: (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-') })
md.renderer.rules.table_open = () => '<div class="table-wrap" tabindex="0" role="region" aria-label="表格"><table>\n'
md.renderer.rules.table_close = () => '</table></div>\n'
const escape = md.utils.escapeHtml
const dimension = (value?: string) => value && /^(?:\d{1,4}|(?:100|[1-9]?\d)%)$/.test(value) ? (/^\d+$/.test(value) ? Math.max(1, Math.min(4096, Number(value))) + 'px' : value) : ''
md.renderer.rules.image = (tokens, idx, _options, env) => {
  const token = tokens[idx]!
  const original = token.attrGet('src') || ''
  const source = env.resolveAsset?.(original) || original
  const title = token.attrGet('title') || ''
  const width = dimension(title.match(/(?:^|\s)width=(\d+%?)(?:\s|$)/)?.[1])
  const height = dimension(title.match(/(?:^|\s)height=(\d+)(?:\s|$)/)?.[1])
  const style = `max-width:100%;${width ? 'width:' + width + ';' : ''}${height ? 'height:' + height + ';object-fit:contain;' : 'height:auto;'}`
  const alt = escape(token.content)
  const sizeTitle = /(?:^|\s)(width|height)=/.test(title)
  if (/\.(mp4|webm|ogv|mov)(?:[?#]|$)/i.test(original)) return `<video class="document-video" src="${escape(source)}" controls playsinline preload="metadata" style="${style}" aria-label="${alt || '视频'}">你的浏览器不支持此视频格式。</video>`
  return `<img src="${escape(source)}" alt="${alt}" style="${style}" loading="lazy"${title && !sizeTitle ? ` title="${escape(title)}"` : ''} />`
}
export const clean = (name: string) => name.replace(/^\d+[.-]/, '').replace(/\.md$/, '')
export const docHref = (id: string) => '#/' + encodeURIComponent(id)
export function parseDocument(path: string, raw: string): Doc {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
  if (raw.startsWith('---\n') && !match) throw new Error(`${path}：文档信息缺少结尾的 ---`)
  const meta = match ? parse(match[1]) : {}
  if (meta && (typeof meta !== 'object' || Array.isArray(meta))) throw new Error(`${path}：文档信息应为 YAML 键值对`)
  const body = match ? raw.slice(match[0].length) : raw
  const tokens = md.parse(body, {})
  const headings = tokens.flatMap((token, index) => token.type === 'heading_open' && ['h2', 'h3'].includes(token.tag) ? [{ id: token.attrGet('id') || '', title: tokens[index + 1]?.content || '', level: Number(token.tag.slice(1)) }] : [])
  const segments = path.split('/')
  return { id: String(meta?.slug || path.replace(/\.md$/, '')), path, raw, title: String(meta?.title || clean(segments.at(-1)!)), description: String(meta?.description || ''), date: String(meta?.date || ''), status: String(meta?.status || '草稿'), categories: segments.slice(0, -1).map(clean), body, html: '', headings, minutes: Math.max(1, Math.ceil(body.length / 450)) }
}
export function resolveMarkdownLink(href: string, current: Doc, collection: Doc[] = docs) {
  const [file, rawHeading] = href.split('#')
  let heading = rawHeading
  try { if (rawHeading) heading = decodeURIComponent(rawHeading) } catch { /* Preserve literal anchors. */ }
  if (!file) return { doc: current, heading }
  const path = decodeURIComponent(new URL(file, 'https://content.local/' + current.path).pathname.slice(1))
  return { doc: collection.find(d => d.path === path), heading }
}
export function renderDocument(doc: Doc, collection: Doc[] = docs, resolveAsset?: AssetResolver) {
  const tokens = md.parse(doc.body, {})
  for (const block of tokens) for (const token of block.children || []) {
    if (token.type !== 'link_open') continue
    const href = token.attrGet('href') || ''
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href)) continue
    if (href.startsWith('#') || /\.md(#.*)?$/i.test(href)) {
      try {
        const target = resolveMarkdownLink(href, doc, collection)
        if (target.doc) token.attrSet('href', docHref(target.doc.id) + (target.heading ? '?heading=' + encodeURIComponent(target.heading) : ''))
      } catch { /* Leave unresolved author links visible for correction. */ }
    }
  }
  return md.renderer.render(tokens, md.options, { resolveAsset })
}
export function mediaSources(raw: string) {
  const document = parseDocument('media.md', raw)
  return md.parse(document.body, {}).flatMap(block => (block.children || []).filter(t => t.type === 'image').map(t => t.attrGet('src') || ''))
}
export function buildKnowledge(files: Record<string, string>, folders: string[] = [], resolveAsset?: AssetResolver) {
  const items = Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'zh-CN', { numeric: true })).map(([path, raw]) => parseDocument(path, raw))
  if (new Set(items.map(d => d.id)).size !== items.length) throw new Error('文档 slug 重复，请设置唯一标识后保存。')
  const tree: NavNode[] = []
  function folderNode(path: string) {
    let nodes = tree, key = ''
    for (const folder of path.split('/').filter(Boolean)) {
      key += '/' + folder
      let node = nodes.find(n => n.key === key && n.children)
      if (!node) { node = { key, title: clean(folder), children: [] }; nodes.push(node) }
      nodes = node.children!
    }
    return nodes
  }
  for (const path of [...folders].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))) folderNode(path)
  for (const doc of items) {
    folderNode(doc.path.split('/').slice(0, -1).join('/')).push({ key: doc.id, title: doc.title, doc })
    doc.html = renderDocument(doc, items, resolveAsset)
  }
  return { docs: items, navigation: tree }
}
const rawFiles = import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const markers = import.meta.glob('../content/**/.gitkeep', { query: '?raw', import: 'default', eager: true })
export const bundledFiles = Object.fromEntries(Object.entries(rawFiles).map(([path, raw]) => [path.replace('../content/', ''), raw]))
export const bundledFolders = Object.keys(markers).map(path => path.replace('../content/', '').replace(/\/.gitkeep$/, ''))
const initial = buildKnowledge(bundledFiles, bundledFolders)
const state: { docs: Doc[]; navigation: NavNode[]; local: boolean } = import.meta.hot?.data.knowledge || { docs: reactive<Doc[]>(initial.docs), navigation: reactive<NavNode[]>(initial.navigation), local: false }
export const docs = state.docs
export const navigation = state.navigation
export function replaceKnowledge(files: Record<string, string>, folders: string[] = [], resolveAsset?: AssetResolver) {
  const next = buildKnowledge(files, folders, resolveAsset)
  state.local = true
  docs.splice(0, docs.length, ...next.docs)
  navigation.splice(0, navigation.length, ...next.navigation)
}
if (import.meta.hot) {
  import.meta.hot.dispose(data => { data.knowledge = state })
  import.meta.hot.accept(next => {
    if (!next || state.local) return
    const updated = buildKnowledge(next.bundledFiles, next.bundledFolders)
    docs.splice(0, docs.length, ...updated.docs)
    navigation.splice(0, navigation.length, ...updated.navigation)
  })
}
````

### FILE: src/lib/local-workspace.ts

````ts
import { reactive, shallowRef } from 'vue'
import { buildKnowledge, mediaSources, parseDocument, replaceKnowledge } from './content'

type Directory = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
}
declare global { interface Window { showDirectoryPicker?: (options: { mode: 'readwrite'; id: string }) => Promise<Directory> } }
export const localProject = reactive({ connected: false, name: '', folders: [] as string[], busy: false, error: '', supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window })
const root = shallowRef<Directory>()
const urls = new Map<string, string>()
export const localAsset = (src: string) => urls.get(src) || src
export function validateName(name: string) {
  if (!name.trim() || name !== name.trim() || /[\\/<>:"|?*\x00-\x1f]/.test(name) || name === '.' || name === '..' || /[. ]$/.test(name) || name.length > 120) throw new Error('名称不能为空，不能包含路径分隔符、特殊字符或末尾空格。')
  return name
}
function parts(path: string) { return path.split('/').filter(Boolean).map(validateName) }
async function dirAt(base: Directory, path: string, create = false): Promise<Directory> {
  let dir = base
  for (const segment of parts(path)) dir = await dir.getDirectoryHandle(segment, { create }) as Directory
  return dir
}
async function contentRoot() {
  if (!root.value) throw new Error('请先选择本地项目文件夹。')
  return dirAt(root.value, 'src/content')
}
async function fileAt(base: Directory, path: string, create = false) {
  const segments = parts(path)
  const name = segments.pop()
  if (!name) throw new Error('文件名不能为空。')
  return (await dirAt(base, segments.join('/'), false)).getFileHandle(name, { create })
}
async function maybeFile(base: Directory, path: string) {
  try { return await fileAt(base, path) } catch (e) { if ((e as DOMException).name === 'NotFoundError') return null; throw e }
}
async function writeFile(handle: FileSystemFileHandle, data: string | File) {
  const stream = await handle.createWritable()
  try { await stream.write(data); await stream.close() } catch (error) { try { await stream.abort() } catch { /* Already closed. */ } throw error }
}
async function permission(dir: Directory, request: boolean) {
  if (!dir.queryPermission) return true
  if (await dir.queryPermission({ mode: 'readwrite' }) === 'granted') return true
  return request && await dir.requestPermission?.({ mode: 'readwrite' }) === 'granted'
}
async function handleStore(action: 'get' | 'put', value?: Directory): Promise<Directory | undefined> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ai2cc-local-project', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('handles')
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('handles', action === 'get' ? 'readonly' : 'readwrite')
      const op = action === 'get' ? tx.objectStore('handles').get('project') : tx.objectStore('handles').put(value, 'project')
      let result: Directory | undefined
      op.onsuccess = () => { result = op.result }
      tx.oncomplete = () => { db.close(); resolve(result) }
      tx.onerror = () => { db.close(); reject(tx.error) }
    }
  })
}
async function readTree(base: Directory) {
  const files: Record<string, string> = {}, folders: string[] = []
  async function walk(dir: Directory, prefix = '') {
    for await (const entry of dir.values()) {
      if (entry.name.startsWith('.')) continue
      const path = prefix + entry.name
      if (entry.kind === 'directory') { folders.push(path); await walk(entry as Directory, path + '/') }
      else if (/\.md$/i.test(entry.name)) files[path] = await (await (entry as FileSystemFileHandle).getFile()).text()
    }
  }
  await walk(base)
  return { files, folders }
}
export async function reloadLocalProject() {
  const { files, folders } = await readTree(await contentRoot())
  // Validate before replacing the working library or revoking its media URLs.
  buildKnowledge(files, folders)
  const nextUrls = new Map<string, string>()
  try {
    const publicDir = await dirAt(root.value!, 'public')
    for (const source of new Set(Object.values(files).flatMap(mediaSources))) {
      if (!source.startsWith('./')) continue
      const assetPath = source.slice(2).split(/[?#]/)[0]!
      try {
        const handle = await fileAt(publicDir, decodeURIComponent(assetPath))
        nextUrls.set(source, URL.createObjectURL(await handle.getFile()))
      } catch { /* Leave missing or remote media references visible in the document. */ }
    }
  } catch { /* A project can contain documents without a public directory. */ }
  const oldUrls = [...urls.values()]
  urls.clear(); nextUrls.forEach((value, key) => urls.set(key, value))
  replaceKnowledge(files, folders, localAsset)
  oldUrls.forEach(url => URL.revokeObjectURL(url))
  localProject.folders = folders.sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
  localProject.name = root.value!.name
  localProject.connected = true
}
export async function connectLocalProject() {
  if (!window.showDirectoryPicker) throw new Error('此浏览器不支持直接读写文件夹。请在桌面 Chrome 或 Edge 中打开本地知识库，再选择项目文件夹。')
  let selected: Directory
  try { selected = await window.showDirectoryPicker({ id: 'ai2cc-project', mode: 'readwrite' }) } catch (error) {
    if ((error as DOMException).name === 'SecurityError') throw new Error('当前页面环境限制文件夹访问。请使用桌面 Chrome 或 Edge 打开本地知识库，再选择项目。')
    throw error
  }
  try { await dirAt(selected, 'src/content'); await selected.getFileHandle('package.json') } catch { throw new Error('请选择 AI2CC 项目根文件夹，其中应包含 package.json 和 src/content。') }
  if (!await permission(selected, true)) throw new Error('未获得文件夹读写权限，请重新选择并允许编辑。')
  const old = root.value
  root.value = selected
  try { await reloadLocalProject() } catch (error) { root.value = old; throw error }
  try { await handleStore('put', selected) } catch { /* Connection remains usable for this session. */ }
}
export async function restoreLocalProject() {
  if (!localProject.supported) return
  try {
    const saved = await handleStore('get')
    if (!saved || !await permission(saved, false)) return
    root.value = saved; await reloadLocalProject()
  } catch { root.value = undefined; localProject.connected = false }
}
export async function createLocalFolder(parent: string, name: string) {
  validateName(name)
  if (!root.value || !await permission(root.value, true)) throw new Error('请重新连接项目并允许编辑。')
  const parentDir = await dirAt(await contentRoot(), parent)
  try { await parentDir.getDirectoryHandle(name); throw new Error('这个目录已存在，请换一个名称。') } catch (e) { if ((e as DOMException).name !== 'NotFoundError') throw e }
  const folder = await parentDir.getDirectoryHandle(name, { create: true })
  // Keep empty directories visible after Git checkout and a static rebuild.
  await writeFile(await folder.getFileHandle('.gitkeep', { create: true }), '')
  try { await reloadLocalProject(); return '' } catch (error) { return `目录已创建，但列表刷新失败：${(error as Error).message}` }
}
export interface PendingAsset { source: string; file: File; objectUrl: string }
export function stageMedia(file: File): PendingAsset {
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/quicktime': 'mov' }
  const type = file.type.split(';')[0]!
  const ext = extensions[type] || (file.name.match(/\.(png|jpe?g|webp|gif|avif|mp4|webm|ogv|mov)$/i)?.[1]?.toLowerCase())
  if (!ext) throw new Error('请选择 PNG、JPG、WebP、GIF、AVIF 图片或 MP4、WebM、MOV 视频。')
  return { source: `./media/${crypto.randomUUID()}.${ext}`, file, objectUrl: URL.createObjectURL(file) }
}
export async function saveLocalDocument(path: string, raw: string, expectedRaw: string | undefined, assets: PendingAsset[]) {
  if (!root.value || !await permission(root.value, true)) throw new Error('读写权限已失效，请重新连接项目。')
  parts(path)
  if (!/\.md$/i.test(path)) throw new Error('文档必须使用 .md 后缀。')
  const base = await contentRoot()
  const existing = await maybeFile(base, path)
  if (expectedRaw === undefined && existing) throw new Error('同名文档已存在，请修改文件名。')
  if (expectedRaw !== undefined && (!existing || await (await existing.getFile()).text() !== expectedRaw)) throw new Error('文件已被其他编辑器修改。请保留当前草稿，关闭后重新读取文件，再合并修改。')
  const latest = await readTree(base)
  buildKnowledge({ ...latest.files, [path]: raw }, latest.folders)
  const referenced = new Set(mediaSources(raw))
  const pending = assets.filter(asset => referenced.has(asset.source))
  const created: Array<{ parent: Directory; name: string }> = []
  let documentWritten = false
  try {
    if (pending.length) {
      const publicDir = await dirAt(root.value, 'public', true)
      const media = await dirAt(publicDir, 'media', true)
      for (const asset of pending) {
        const name = asset.source.slice('./media/'.length)
        validateName(name)
        if (await maybeFile(media, name)) throw new Error('媒体文件名发生冲突，请重新插入该文件。')
        const handle = await media.getFileHandle(name, { create: true })
        created.push({ parent: media, name })
        await writeFile(handle, asset.file)
      }
    }
    // Compare again after media writes to avoid overwriting edits made during the save.
    if (existing && await (await existing.getFile()).text() !== expectedRaw) throw new Error('保存期间文件发生变化，请重新读取后合并。')
    if (!existing && await maybeFile(base, path)) throw new Error('保存期间出现同名文件，请修改文件名后保存。')
    const handle = existing || await fileAt(base, path, true)
    if (!existing) created.push({ parent: await dirAt(base, parts(path).slice(0, -1).join('/')), name: parts(path).at(-1)! })
    await writeFile(handle, raw)
    documentWritten = true
  } finally {
    if (!documentWritten) for (const entry of created.reverse()) { try { await entry.parent.removeEntry(entry.name) } catch { /* Preserve original error. */ } }
  }
  for (const asset of pending) {
    const old = urls.get(asset.source)
    if (old) URL.revokeObjectURL(old)
    urls.set(asset.source, URL.createObjectURL(asset.file))
  }
  let warning = ''
  try { await reloadLocalProject() } catch (error) { warning = `文件已保存，但列表刷新失败：${(error as Error).message}` }
  return { id: parseDocument(path, raw).id, warning }
}
````

### FILE: src/lib/utils.ts

````ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
````

### FILE: src/main.ts

````ts
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme.css'
createApp(App).mount('#app')
````

### FILE: src/style.css

````css
@import "tailwindcss";
@import "highlight.js/styles/github.css";
@theme {
  --color-background: #fff; --color-foreground: #25272c; --color-primary: #3f5dc1; --color-primary-foreground: #fff; --color-secondary: #f5f5f6; --color-secondary-foreground: #27272a; --color-muted: #f6f6f7; --color-muted-foreground: #71717a; --color-accent: #f3f4f6; --color-accent-foreground: #27272a; --color-border: #e9e9ed; --color-input: #e4e4e7; --color-ring: #677dc3; --color-destructive: #dc2626; --color-card: #fff; --color-card-foreground: #25272c; --color-popover: #fff; --color-popover-foreground: #25272c; --radius-sm: 3px; --radius-md: 5px; --radius-lg: 6px; --radius-xl: 8px;
}
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;color:#292b31;background:#fff;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;--ease:cubic-bezier(.22,1,.36,1);--header:52px;--sidebar:236px}
*{box-sizing:border-box}body{margin:0}button,a{-webkit-tap-highlight-color:transparent}button{cursor:pointer}a{color:inherit;text-decoration:none}button:focus-visible,a:focus-visible,[tabindex]:focus-visible{outline:2px solid #7188ce;outline-offset:3px}button:disabled{cursor:default}::selection{background:#e2e8fb}.skip-link{position:fixed;top:-60px;left:16px;z-index:100;background:#fff;border:1px solid #e4e6eb;border-radius:5px;padding:8px 12px;font-size:13px}.skip-link:focus{top:7px}
.topbar{height:var(--header);position:sticky;top:0;z-index:30;border-bottom:1px solid #ededf0;display:flex;align-items:center;padding:0 24px;background:rgba(255,255,255,.96);backdrop-filter:blur(12px);gap:17px}.brand{display:flex;align-items:center;gap:9px;white-space:nowrap}.brand-mark{width:27px;height:27px;display:grid;place-items:center;background:#292b30;color:white;border-radius:6px}.brand-mark svg{width:18px;height:18px}.brand strong{font-size:17px;font-weight:650;letter-spacing:-.4px}.header-divider{height:15px;width:1px;background:#e4e5e9}.header-label{font-size:12px;color:#868892;letter-spacing:.1px}
.workspace{display:grid;grid-template-columns:var(--sidebar) minmax(0,1fr);transition:grid-template-columns 240ms var(--ease)}.sidebar{height:calc(100dvh - var(--header));width:var(--sidebar);min-width:0;position:sticky;top:var(--header);display:flex;flex-direction:column;border-right:1px solid #ededf0;background:#fff;padding:20px 16px 28px;overflow-x:hidden;overflow-y:auto;scrollbar-width:thin;scrollbar-color:#dedee4 transparent;transition:opacity 140ms ease,transform 240ms var(--ease),visibility 240ms}.sidebar-heading{display:flex;justify-content:space-between;align-items:center;padding:0 10px 8px;font-size:12px;color:#9799a2;letter-spacing:.3px}.sidebar-heading button{height:24px;width:24px;color:#9598a1}.sidebar-collapsed{grid-template-columns:0 minmax(0,1fr)}.sidebar-collapsed .sidebar{opacity:0;transform:translateX(-12px);visibility:hidden;pointer-events:none}
.nav-tree{list-style:none;padding:0;margin:0}.nav-tree>li{margin:1px 0}.folder-row,.doc-row{display:flex;align-items:center;width:100%;gap:7px;font-size:13px;min-height:30px;padding:5px 10px;border-radius:4px;line-height:1.5;text-align:left;transition:background 140ms ease,color 140ms ease}.folder-row{font-weight:550;color:#41444d;border:0;background:transparent;margin-top:15px;margin-bottom:3px}.folder-row>span{flex:1}.folder-row svg{color:#979ba5;flex-shrink:0;width:12px;height:12px;transition:transform 200ms var(--ease)}.folder-row .expanded{transform:rotate(90deg)}.folder-row:hover,.doc-row:hover{background:#f6f6f8}.doc-row{color:#767a84;position:relative}.doc-row.selected{background:#f0f3fb;color:#435eab;font-weight:550}.nested{margin-left:10px;padding-left:9px;border-left:1px solid #ededf1}.nested .folder-row{font-size:12px;color:#777d89;margin-top:5px}.nested .doc-row{font-size:13px}.nav-tree [data-slot=collapsible-content]{overflow:hidden}.nav-tree [data-slot=collapsible-content][data-state=open]{animation:folder-open 210ms var(--ease)}.nav-tree [data-slot=collapsible-content][data-state=closed]{animation:folder-close 180ms ease-out}
@keyframes folder-open{from{height:0;opacity:.3}to{height:var(--reka-collapsible-content-height);opacity:1}}@keyframes folder-close{from{height:var(--reka-collapsible-content-height);opacity:1}to{height:0;opacity:0}}
main{min-width:0}.breadcrumb-bar{height:45px;max-width:1110px;margin:auto;padding:0 42px;display:flex;align-items:center;gap:8px;font-size:12px;color:#9a9ca5}.crumb-icon{color:#a1a5ad;width:13px;height:13px}.crumb-current{color:#717682;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.reading-layout{max-width:1110px;margin:auto;display:grid;grid-template-columns:minmax(0,740px) 160px;gap:58px;padding:26px 42px 44px}.document-column{min-width:0;animation:article-enter 220ms var(--ease)}@keyframes article-enter{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
h1{font-size:28px;font-weight:620;letter-spacing:-.8px;line-height:1.4;margin:0 0 11px;color:#292c33}.document-description{font-size:14px;line-height:1.85;color:#80858f;margin:0 0 17px}.document-meta{display:flex;gap:12px;align-items:center;color:#9a9da5;font-size:11px;margin:16px 0 23px}.document-meta>span,.document-meta>button{display:flex;align-items:center;gap:5px}.status{font-size:10px;border:1px solid #e9e9ef;border-radius:3px;color:#9196a2;padding:1px 5px;line-height:1.5}.document-meta>button{margin-left:auto;border:0;background:none;color:#8d94a0;font-size:11px;padding:2px 0;transition:color 140ms}.document-meta>button:hover{color:#405caa}.document-meta>button svg{width:12px;height:12px}.article-separator{background:#ededf1;margin-bottom:24px}
.markdown{font-size:14px;line-height:1.9;color:#565d68;overflow-wrap:anywhere}.markdown p{margin:12px 0}.markdown strong{font-weight:580;color:#363d49}.markdown h2{font-size:20px;font-weight:600;letter-spacing:-.3px;line-height:1.6;color:#303743;margin:30px 0 12px;scroll-margin-top:76px}.markdown h3{font-size:15px;font-weight:600;color:#414854;margin:22px 0 8px;scroll-margin-top:76px}.markdown>h2:first-child{margin-top:0}.markdown a{color:#4a64ad;text-decoration:underline;text-decoration-color:#d4dcef;text-underline-offset:3px;transition:color 140ms}.markdown a:hover{color:#243f8b;text-decoration-color:#8398cd}.markdown blockquote{background:#f8f9fc;border-left:2px solid #a7b6dc;border-radius:0 4px 4px 0;padding:10px 15px;margin:20px 0;font-size:13px;color:#79859d}.markdown blockquote p{margin:3px 0}.markdown ul,.markdown ol{padding-left:20px;margin:12px 0}.markdown ul{list-style:disc}.markdown ol{list-style:decimal}.markdown li{padding-left:2px;margin:6px 0}.markdown li::marker{color:#a0a5b0}.markdown hr{border:0;border-top:1px solid #eceef2;margin:25px 0}.markdown :not(pre)>code{font:12px ui-monospace,SFMono-Regular,Menlo,monospace;padding:2px 4px;border:1px solid #eaecf0;background:#f7f7f9;border-radius:3px;color:#59657c}.markdown pre{background:#f8f9fb;border:1px solid #eaecf1;border-radius:6px;padding:32px 16px 15px;overflow:auto;position:relative;line-height:1.75;margin:19px 0;font-size:12px}.markdown pre::before{content:'CODE';font:9px ui-monospace,monospace;color:#a5abb7;position:absolute;left:16px;top:11px;letter-spacing:1px}.markdown pre code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.copy-code{position:absolute;right:10px;top:7px;font-size:10px;color:#939aa7;background:transparent;border:1px solid transparent;padding:1px 6px;border-radius:3px;transition:all 140ms}.copy-code:hover{background:#fff;border-color:#e4e7ee;color:#52698f}.table-wrap{overflow-x:auto;margin:20px 0}.markdown table{width:100%;border-collapse:collapse;font-size:13px}.markdown th,.markdown td{padding:10px 12px;text-align:left;border-bottom:1px solid #eaecf1;min-width:90px}.markdown th{background:#fafafb;font-size:11px;color:#7c8390;font-weight:500}.markdown td:first-child{font-weight:550;color:#526073;white-space:nowrap}.markdown img{max-width:100%;height:auto;border-radius:6px}.markdown input[type=checkbox]{margin-right:6px;accent-color:#617bc1}
.page-navigation{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-top:35px;padding-top:19px;border-top:1px solid #ededf1}.page-navigation a{padding:4px 0;transition:color 140ms}.page-navigation a:hover strong{color:#3e5caa}.page-navigation span{display:flex;align-items:center;gap:6px;font-size:11px;color:#a1a5af;margin-bottom:5px}.page-navigation span svg{width:12px;height:12px}.page-navigation strong{font-size:13px;font-weight:500;color:#636f85;transition:color 140ms}.page-navigation .next-page{text-align:right}.next-page span{justify-content:flex-end}
.toc{padding-top:4px;min-width:0}.toc-sticky{position:sticky;top:84px}.toc-title{font-size:11px;font-weight:550;color:#777d89;margin-bottom:13px}.toc nav{display:flex;flex-direction:column;border-left:1px solid #eceef2;gap:0}.toc nav a{padding:6px 0 6px 13px;line-height:1.55;font-size:11px;color:#949ba7;position:relative;transition:color 160ms}.toc nav a:hover{color:#627298}.toc nav a.active{color:#4e67ab}.toc nav a:before{position:absolute;left:-1px;top:6px;bottom:6px;width:1px;background:#6d85c3;content:'';opacity:0;transition:opacity 180ms}.toc nav a.active:before{opacity:1}.toc nav a.subheading{padding-left:23px}
.mobile-menu{display:none}.mobile-sheet{padding:25px 17px!important;overflow:auto;background:#fff!important;max-width:290px}.mobile-sheet [data-slot=sheet-title]{font-size:14px}.mobile-sheet [data-slot=sheet-description]{font-size:12px;color:#969ba4}.mobile-sheet nav{margin-top:4px}.mobile-sheet[data-state=open]{animation:sheet-enter 250ms var(--ease)}.mobile-sheet[data-state=closed]{animation:sheet-leave 180ms ease-in}.mobile-sheet [data-slot=sheet-close]{font-size:12px}[data-slot=sheet-overlay]{background:rgba(30,34,44,.2);backdrop-filter:blur(2px)}[data-slot=sheet-overlay][data-state=open]{animation:veil-in 180ms ease}[data-slot=sheet-overlay][data-state=closed]{animation:veil-out 180ms ease}@keyframes sheet-enter{from{transform:translateX(-100%);opacity:.75}to{transform:translateX(0);opacity:1}}@keyframes sheet-leave{to{transform:translateX(-100%);opacity:.7}}@keyframes veil-in{from{opacity:0}to{opacity:1}}@keyframes veil-out{to{opacity:0}}
.not-found{max-width:620px;margin:60px auto;padding:28px}.not-found>p{margin:18px 0;color:#818a98;font-size:14px}.not-found>svg{margin-bottom:22px;color:#a2aec2}
@media(max-width:1200px){:root{--sidebar:220px}.reading-layout{gap:34px;padding-left:32px;padding-right:32px;grid-template-columns:minmax(0,1fr) 145px}.breadcrumb-bar{padding:0 32px}}
@media(max-width:1020px){.toc{display:none}.reading-layout{display:block;max-width:790px}.breadcrumb-bar{max-width:790px}}
@media(max-width:760px){:root{--header:48px}.topbar{padding:0 17px;gap:12px}.brand strong{font-size:16px}.brand-mark{width:25px;height:25px}.header-label{font-size:10px}.header-divider{height:13px}.workspace,.sidebar-collapsed{display:block}.sidebar{display:none}.mobile-menu{display:inline-flex;flex-shrink:0;width:26px;height:26px}.mobile-menu svg{width:17px;height:17px}.desktop-expand{display:none}.breadcrumb-bar{height:42px;padding:0 16px;gap:7px;font-size:11px}.crumb-icon{display:none}.reading-layout{padding:20px 21px 32px}h1{font-size:25px}.document-description{font-size:13px;line-height:1.85}.document-meta{gap:9px;font-size:10px;margin:15px 0 20px}.document-meta>button{font-size:10px}.document-meta .status{font-size:9px}.markdown{font-size:14px;line-height:1.9}.markdown h2{font-size:19px;margin-top:28px}.markdown pre{font-size:11px}.markdown blockquote{font-size:12px}.markdown th,.markdown td{padding:9px 10px}.markdown table{font-size:12px}.page-navigation{gap:16px;margin-top:28px}.page-navigation strong{font-size:12px}.mobile-sheet .folder-row,.mobile-sheet .doc-row{min-height:36px;font-size:13px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}

@font-face{font-family:'Space Grotesk';src:url('/fonts/space-grotesk.ttf') format('truetype');font-weight:500;font-style:normal;font-display:swap}
.brand-logo{position:relative;display:block;width:100px;height:24px;overflow:hidden;flex-shrink:0}
.brand-logo img{position:absolute;width:150%;max-width:none;height:auto;left:50%;top:50%;transform:translate(-50%,-49%)}
.header-label{font-family:'Space Grotesk',ui-monospace,SFMono-Regular,monospace;font-size:12px;font-weight:500;letter-spacing:.65px;color:#747c8d}
.sidebar-toggle{width:27px!important;height:27px!important;color:#8a91a0;flex-shrink:0;margin-right:-7px}
.sidebar{padding-top:18px}.sidebar-heading{padding-bottom:7px;min-height:26px}
.folder-row,.doc-row{min-height:25px;font-size:12px;padding:3px 9px;line-height:1.55;border-radius:3px}
.folder-row{margin-top:12px;margin-bottom:2px}.nested .doc-row{font-size:12px}.nested .folder-row{font-size:11px}
.nav-tree>li{margin:0}.nested{padding-left:7px;margin-left:9px}
.workspace{transition:grid-template-columns 280ms var(--ease)}.sidebar{transition:opacity 180ms ease,transform 280ms var(--ease),visibility 280ms}
.sidebar-collapsed .sidebar{transform:translateX(-32px)}
.reading-layout{max-width:1240px;grid-template-columns:minmax(0,740px) 160px;gap:128px;padding-right:40px}
.breadcrumb-bar{max-width:1240px}.welcome-cover{display:block;width:100%;height:auto;aspect-ratio:1378/536;object-fit:contain;background:#090909;border-radius:6px;margin:0 0 26px}
@media(max-width:1200px){.reading-layout{gap:88px;grid-template-columns:minmax(0,1fr) 145px}}
@media(max-width:1020px){.reading-layout,.breadcrumb-bar{max-width:790px}}
@media(max-width:760px){.sidebar-toggle{display:none!important}.brand-logo{width:87px;height:22px}.header-label{font-size:10px;letter-spacing:.35px}.reading-layout{padding-right:21px}.welcome-cover{margin-bottom:22px}.mobile-sheet .folder-row,.mobile-sheet .doc-row{min-height:30px;font-size:12px}}
@media(prefers-reduced-motion:reduce){.workspace,.sidebar{transition:none!important}}

.local-project-button{margin-left:auto;display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#7e8798;font-size:11px;padding:5px 7px;border-radius:4px;white-space:nowrap}.local-project-button:hover{background:#f5f6f8;color:#465775}.sidebar-heading>button{display:grid;place-items:center;background:none;border:0;border-radius:3px;width:20px;height:20px;color:#939aaa}.sidebar-heading>button:hover{background:#f1f3f7}.document-actions{margin-left:auto;display:flex;gap:13px}.document-actions>button{display:flex;align-items:center;gap:5px;background:none;border:0;padding:2px 0;font-size:11px;color:#8a929f}.document-actions>button:hover{color:#445fa4}.document-video{display:block;max-width:100%;border-radius:6px;background:#101216;margin:15px 0}.save-toast{position:fixed;left:50%;bottom:25px;transform:translateX(-50%);z-index:100;display:flex;align-items:center;gap:8px;border:1px solid #e3e8ec;border-radius:7px;padding:10px 16px;background:#fff;box-shadow:0 5px 22px #25304812;font-size:12px;color:#576b65;max-width:90vw}.toast-enter-active,.toast-leave-active{transition:opacity 180ms,translate 180ms}.toast-enter-from,.toast-leave-to{opacity:0;translate:0 5px}
.local-editor-sheet{width:min(1120px,96vw)!important;max-width:none!important;padding:23px 26px 18px!important;gap:0!important;display:flex!important;flex-direction:column;overflow:hidden;background:#fff}.local-editor-sheet[data-state=open]{animation:editor-in 230ms var(--ease)}.local-editor-sheet[data-state=closed]{animation:editor-out 180ms ease-in}@keyframes editor-in{from{transform:translateX(25px);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes editor-out{to{transform:translateX(25px);opacity:0}}.editor-heading{display:flex;align-items:center;gap:16px;padding:0 30px 17px 0;flex-shrink:0}.editor-heading [data-slot=sheet-title]{font-size:16px;font-weight:600}.editor-heading [data-slot=sheet-description]{font-size:11px;color:#989eab;margin-top:5px}.unsaved-badge{font-size:10px;background:#fff9ed;color:#a9863c;padding:3px 6px;border-radius:3px}.editor-connect{max-width:510px;margin:55px auto;line-height:1.9;font-size:13px;color:#7a8393}.editor-connect>svg{color:#7c8cac;margin-bottom:18px}.editor-connect h3{font-size:19px;font-weight:600;color:#394455}.editor-connect p{margin:15px 0}.editor-connect code{font-size:12px;background:#f5f6f8;padding:2px 4px;border-radius:3px}.editor-connect button{margin:12px 0;font-size:12px}.editor-fineprint{display:block;color:#a0a6b0;font-size:11px;margin-top:10px}.editor-warning,.editor-error{font-size:12px;color:#af674b!important;background:#fff6f0;padding:10px 12px;border-radius:5px;line-height:1.7}.editor-error{margin-top:10px;flex-shrink:0}.creation-types{display:flex;gap:6px;padding-bottom:15px}.creation-types button{display:flex;gap:6px;align-items:center;background:#fff;border:1px solid #e8ebf0;border-radius:4px;padding:6px 12px;font-size:12px;color:#929aaa}.creation-types button.active{color:#506daf;border-color:#ccd7ee;background:#f7f9ff}.editor-file-fields{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px}.editor-file-fields label{font-size:11px;color:#9299a7;display:flex;align-items:center;gap:8px;min-width:0}.editor-file-fields input,.editor-file-fields select{background:#fff;color:#505d73;border:1px solid #e2e7ef;border-radius:4px;padding:7px 9px;font:12px inherit;min-width:0;flex:1}.editor-toolbar{display:flex;align-items:center;gap:15px;flex-shrink:0;border:1px solid #e5e8ef;border-bottom:0;border-radius:6px 6px 0 0;padding:9px 12px;background:#fafbfc}.editor-path{color:#939aa8;font-size:11px;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.editor-toolbar>button{display:flex;align-items:center;gap:5px;font-size:11px;color:#6f7c95;border:0;background:none}.editor-view-modes{display:flex;border-left:1px solid #e6e9ef;padding-left:10px;gap:3px}.editor-view-modes button{font-size:11px;background:transparent;border:0;padding:3px 7px;border-radius:3px;color:#a0a6b1}.editor-view-modes button[aria-pressed=true]{background:#edf1f8;color:#5873aa}.editor-panes{display:grid;grid-template-columns:1fr 1fr;flex:1;min-height:220px;overflow:hidden;border:1px solid #e5e8ef;border-radius:0 0 6px 6px}.editor-panes.pane-source,.editor-panes.pane-preview{grid-template-columns:1fr}.editor-panes>textarea{width:100%;height:100%;resize:none;outline:none;border:0;border-right:1px solid #e8ecf2;background:#fcfcfd;color:#535f76;padding:18px 19px;font:12px/1.85 ui-monospace,SFMono-Regular,Menlo,"PingFang SC",monospace;tab-size:2}.editor-preview{padding:20px 24px;overflow:auto;min-width:0}.editor-preview>h2{font-size:22px;font-weight:600;margin-bottom:20px;color:#343e50}.editor-preview .markdown h2{font-size:18px;scroll-margin-top:0}.editor-preview .markdown h3{font-size:14px}.editor-preview .markdown{font-size:13px}.editor-preview .markdown img,.editor-preview .markdown video{max-width:100%}.media-size-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:12px;font-size:11px;color:#969dac}.media-size-tools label{display:flex;align-items:center;gap:5px}.media-size-tools select{width:160px;max-width:30vw;border:1px solid #e4e8ef;padding:4px 6px;border-radius:3px;background:#fff;color:#69758d}.media-size-tools input{width:60px;background:#fff;border:1px solid #e4e8ef;border-radius:3px;padding:4px 5px;color:#69758d}.media-size-tools button{font-size:11px;border:0;background:none;color:#5c75ad;padding:3px 2px}.editor-media-hint{font-size:10px;line-height:1.7;color:#9ca3ae;margin-top:10px;flex-shrink:0}.editor-footer{display:flex;align-items:center;gap:12px;flex-shrink:0;margin-top:16px}.editor-footer>span{font-size:10px;color:#a0a7b2}.editor-reload{border:0;background:none;color:#78869f;font-size:11px}.editor-footer>button:last-child{margin-left:auto;font-size:12px;height:31px;gap:6px}.spin{animation:spin 900ms linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:760px){.header-label{max-width:165px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.topbar{gap:10px}.local-project-button{padding:5px 0}.local-project-button>span{display:none}.document-actions{gap:10px}.document-actions>button{font-size:10px}.local-editor-sheet{width:100vw!important;padding:20px 15px 16px!important}.editor-file-fields{grid-template-columns:1fr;gap:9px}.editor-view-modes{gap:0;padding-left:4px}.editor-toolbar{gap:7px}.editor-toolbar>button>span{display:none}.editor-panes.pane-both{grid-template-columns:1fr;grid-template-rows:1fr 1fr}.editor-panes.pane-both>textarea{border-right:0;border-bottom:1px solid #e5e8ef}.editor-preview{padding:14px}.editor-media-hint{font-size:9px}.editor-footer>span{display:none}.media-size-tools{gap:6px}.media-size-tools select{width:120px}.editor-connect{margin:30px auto}.editor-connect p{font-size:12px}.document-actions>button>svg{width:11px;height:11px}}
@media(prefers-reduced-motion:reduce){.local-editor-sheet,.toast-enter-active,.toast-leave-active{animation:none!important;transition:none!important}}
.editor-workarea{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;border:0;padding:0;margin:0}.editor-workarea[disabled] .editor-panes{opacity:.7}
/* Keep the toggle beside the navigation, accessible even when it is collapsed. */
.sidebar-toggle{position:fixed;z-index:35;left:calc(var(--sidebar) - 14px);top:calc(var(--header) + 15px);margin:0;border:1px solid #e9e9ed;background:#fff;box-shadow:0 1px 3px #18203308;transition:left 280ms var(--ease),background-color 180ms,color 180ms}
.sidebar-collapsed .sidebar-toggle{left:10px}
.sidebar-heading{padding-right:15px}
.brand-doc-label{font-size:12px;font-weight:550;color:#6f7786;white-space:nowrap;margin-left:-7px}
.theme-toggle{width:28px!important;height:28px!important;flex-shrink:0;color:#7e8798;margin-left:-8px}
.theme-toggle svg{animation:theme-icon-in 180ms var(--ease)}
@keyframes theme-icon-in{from{opacity:0;transform:rotate(-25deg) scale(.85)}to{opacity:1;transform:rotate(0) scale(1)}}
@media(max-width:760px){.header-label,.header-divider{display:none}.brand-doc-label{margin-left:0}.theme-toggle{margin-left:0}}
````

### FILE: src/theme.css

````css
:root { color-scheme: light; }
:root[data-theme=dark] {
  color-scheme: dark;
  color: #d1d5dd;
  background: #181a1f;
  --color-background: #181a1f;
  --color-foreground: #d1d5dd;
  --color-primary: #91a9ee;
  --color-primary-foreground: #181a1f;
  --color-secondary: #252830;
  --color-secondary-foreground: #d1d5dd;
  --color-muted: #22252c;
  --color-muted-foreground: #a0a8b8;
  --color-accent: #292e39;
  --color-accent-foreground: #e1e5ef;
  --color-border: #30343e;
  --color-input: #383e4b;
  --color-ring: #91a9ee;
  --color-card: #1e2128;
  --color-card-foreground: #d1d5dd;
  --color-popover: #1e2128;
  --color-popover-foreground: #d1d5dd;
}
[data-theme=dark] ::selection { background: #3b4c75; }
[data-theme=dark] .topbar { background: #181a1ff5; border-color: #2b2f38; }
[data-theme=dark] .brand-logo img { filter: invert(1); mix-blend-mode: screen; }
[data-theme=dark] :is(.sidebar,.sidebar-toggle,.skip-link,.local-editor-sheet,.save-toast) { background: #181a1f; border-color: #30343e; }
[data-theme=dark] .mobile-sheet { background: #181a1f!important; }
[data-theme=dark] :is(.header-divider,.article-separator) { background: #30343e; }
[data-theme=dark] :is(h1,.markdown h2,.markdown h3,.markdown strong,.editor-connect h3,.editor-preview>h2) { color: #e0e4ec; }
[data-theme=dark] :is(.markdown,.folder-row) { color: #b9c1cf; }
[data-theme=dark] :is(.doc-row,.crumb-current,.toc-title,.brand-doc-label,.header-label,.local-project-button,.sidebar-toggle,.theme-toggle,.document-description,.document-actions>button,.editor-connect,.page-navigation strong,.editor-reload) { color: #a2adbf; }
[data-theme=dark] :is(.document-meta,.status,.breadcrumb-bar,.sidebar-heading,.toc nav a,.page-navigation span,.editor-path,.editor-file-fields label,.media-size-tools,.editor-fineprint,.editor-media-hint,.editor-footer>span,.editor-heading [data-slot=sheet-description]) { color: #909caf; }
[data-theme=dark] :is(.nested,.status,.toc nav,.page-navigation,.markdown hr,.markdown td,.markdown th) { border-color: #30343e; }
[data-theme=dark] :is(.folder-row:hover,.doc-row:hover,.local-project-button:hover,.sidebar-heading>button:hover,.sidebar-toggle:hover,.theme-toggle:hover) { background: #262b35; color: #e0e4ec; }
[data-theme=dark] .doc-row.selected { background: #29334a; color: #acc1ff; }
[data-theme=dark] :is(.toc nav a.active,.toc nav a:hover,.document-actions>button:hover,.page-navigation a:hover strong,.media-size-tools button) { color: #a4bbfa; }
[data-theme=dark] .markdown a { color: #a4bbfa; text-decoration-color: #4c5d85; }
[data-theme=dark] .markdown blockquote { background: #202735; border-color: #6176a5; color: #b2bfd8; }
[data-theme=dark] :is(.markdown :not(pre)>code,.editor-connect code) { background: #252a34; border-color: #333c4c; color: #b8c7e4; }
[data-theme=dark] :is(.markdown pre,.markdown th) { background: #20232b; border-color: #303744; color: #bdc7d9; }
[data-theme=dark] .markdown td:first-child { color: #b4c3dc; }
[data-theme=dark] .copy-code:hover { background: #303847; border-color: #46536c; color: #d1ddf3; }
[data-theme=dark] .hljs { background: #20232b; color: #d0d8e8; }
[data-theme=dark] :is(.hljs-keyword,.hljs-selector-tag,.hljs-literal,.hljs-deletion) { color: #f398a4; }
[data-theme=dark] :is(.hljs-string,.hljs-regexp,.hljs-addition,.hljs-attr) { color: #a4d3b1; }
[data-theme=dark] :is(.hljs-title,.hljs-section,.hljs-name) { color: #c6b2ed; }
[data-theme=dark] :is(.hljs-number,.hljs-symbol,.hljs-built_in,.hljs-variable,.hljs-meta) { color: #91bdf1; }
[data-theme=dark] :is(.hljs-comment,.hljs-quote) { color: #909aab; }
[data-theme=dark] :is(.editor-toolbar,.editor-panes>textarea) { background: #1e222a; color: #c4cee0; border-color: #343c4a; }
[data-theme=dark] :is(.editor-panes,.editor-view-modes) { border-color: #343c4a; }
[data-theme=dark] :is(.editor-file-fields input,.editor-file-fields select,.media-size-tools input,.media-size-tools select,.creation-types button) { background: #232832; border-color: #3c4657; color: #c4cee0; }
[data-theme=dark] :is(.creation-types button.active,.editor-view-modes button[aria-pressed=true]) { background: #2d3a56; border-color: #556a96; color: #bed0ff; }
[data-theme=dark] :is(.editor-toolbar>button,.editor-view-modes button) { color: #a4b2c9; }
[data-theme=dark] :is(.editor-warning,.editor-error) { background: #342823; color: #e8b19a!important; }
[data-theme=dark] .unsaved-badge { background: #342f23; color: #dfc28b; }
[data-theme=dark] .save-toast { color: #bbd3c5; }
[data-theme=dark] [data-slot=sheet-overlay] { background: #0008; }
````

### FILE: tsconfig.json

````json
{"compilerOptions":{"target":"ES2022","module":"ESNext","lib":["ES2022","DOM","DOM.Iterable"],"moduleResolution":"Bundler","strict":true,"skipLibCheck":true,"resolveJsonModule":true,"isolatedModules":true,"noEmit":true,"esModuleInterop":true,"types":["vite/client","node"],"baseUrl":".","paths":{"@/*":["src/*"]}},"include":["src/**/*.ts","src/**/*.vue","vite.config.ts"]}
````

### FILE: vite.config.ts

````ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

const contentDirectory = fileURLToPath(new URL('./src/content/', import.meta.url))
const contentModule = fileURLToPath(new URL('./src/lib/content.ts', import.meta.url))
export default defineConfig({
  plugins: [vue(), tailwindcss(), {
    name: 'ai2cc-content-hmr',
    // Route document create/update/delete events through the accepting library
    // module; a removed raw import must not cause a full-page reload mid-edit.
    hotUpdate: { order: 'post', handler({ file }) {
      if (!file.startsWith(contentDirectory)) return
      const modules = [...(this.environment.moduleGraph.getModulesByFile(contentModule) || [])]
      for (const module of modules) this.environment.moduleGraph.invalidateModule(module)
      return modules
    } },
  }],
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
})
````

---

所有文本源码到此结束。请按上文实施步骤直接完成搭建与验证。
