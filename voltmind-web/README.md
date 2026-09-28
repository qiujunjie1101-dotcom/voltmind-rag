# voltmind-web

VoltMind 多模态智能知识库的前端工作台。当前为静态页面，**未接入后端**。

## 技术栈

| 项 | 选择 |
| --- | --- |
| 框架 | Vue 3（`<script setup>` + Composition API） |
| 语言 | TypeScript，`strict`，`verbatimModuleSyntax` |
| 构建 | Vite 7 |
| 样式 | Tailwind CSS 4（CSS-first，`@theme` 语义令牌） |
| 组件 | shadcn-vue（`new-york`）· Reka UI · Lucide 图标 |
| 主题 | 类名驱动的深色模式，跟随系统偏好并本地持久化 |

未引入 Vue Router 与 Pinia：当前只有一个工作台外壳，视图切换用组件内状态完成（导航状态放在 `lib/navigation.ts` 的模块级单例里，便于页面内部发起跳转，例如对话页无可用模型时引导到设置页）。需要多级路由或更复杂的跨页状态时再评估。

## 目录结构

```text
voltmind-web/
├── components.json          # shadcn-vue 配置，供 CLI 追加组件
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .env                     # API 地址与超时，不含密钥，需要入库
├── .env.example
├── public/
│   ├── backgrounds/         # 工作台背景图
│   └── brand/               # 品牌图片
└── src/
    ├── main.ts
    ├── App.vue              # 工作台外壳：侧栏 + 顶栏 + 内容区
    ├── assets/index.css     # Tailwind 引入与设计令牌
    ├── api/chat.ts          # 问答接口调用与错误提示
    ├── api/providers.ts     # 模型供应商与可用模型接口
    ├── lib/env.ts           # 读取并校验 Vite 环境变量
    ├── lib/http.ts          # Axios 实例
    ├── lib/api-error.ts     # 请求失败的统一中文提示
    ├── lib/utils.ts         # cn() 类名合并
    ├── lib/navigation.ts    # 导航配置、当前视图状态与跳转
    ├── composables/use-theme.ts
    ├── composables/use-model-catalog.ts  # 供应商与模型目录（模块级单例）
    ├── components/
    │   ├── AppSidebar.vue
    │   ├── ThemeToggle.vue
    │   ├── chat/
    │   │   └── ModelSelect.vue           # 对话页模型选择器（Reka UI Select）
    │   ├── model-service/
    │   │   ├── ModelServiceCard.vue      # 设置页「模型服务」卡片
    │   │   └── ProviderForm.vue          # 供应商表单（含模型列表）
    │   └── ui/              # shadcn-vue 组件
    │       ├── badge/
    │       ├── button/
    │       ├── card/
    │       ├── input/
    │       └── textarea/
    └── views/
        ├── ChatView.vue
        ├── KnowledgeView.vue
        └── SettingsView.vue
```

## 运行

```powershell
cd voltmind-web
npm install
npm run dev        # http://127.0.0.1:5174
```

端口用 5174，避免与 `ai-workspace` 的 5173 冲突。

## 环境变量

后端地址与超时通过 Vite 环境变量注入，**代码里不写死服务地址**。读取与校验集中在 `src/lib/env.ts`，变量缺失或非法时在应用启动阶段直接报错，不会带着错误配置跑到发请求时才失败。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | Python AI 服务地址，末尾可带斜杠（会去掉）。需与后端 `CORS_ALLOW_ORIGINS` 放行的前端来源配对 |
| `VITE_API_TIMEOUT_MS` | 请求超时毫秒数，必须大于后端 `LLM_TIMEOUT_SECONDS`，否则前端先中断，用户看不到后端的超时原因 |

`.env` 不含密钥、需要入库；个人覆盖写 `.env.local`（已被忽略）。**禁止把 DeepSeek API Key 放进前端环境变量**——Vite 注入的变量会明文出现在浏览器产物里。

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发服务 |
| `npm run type-check` | 仅类型检查 |
| `npm run build` | 类型检查 + 生产构建，输出 `dist/` |
| `npm run preview` | 预览构建产物 |

## 品牌资源

`public/brand/` 下三个文件：

| 文件 | 来源 | 用途 |
| --- | --- | --- |
| `voltmind-logo.png` | 原始品牌图，原样保存未做任何修改 | 需要完整标识的场合（页脚、登录页、对外文档） |
| `voltmind-mark.png` | 由原图裁出图形标，近白背景转透明 | 侧栏品牌位，浅色与深色主题通用 |
| `favicon.png` | 由图形标缩放为正方形透明底 | 站点图标 |

原始图有两个特征必须注意：**背景是不透明的近白色**（实测 `252,252,252`，270982 个像素中 0 个透明），并且自带 “AI KNOWLEDGE BASE” 副标题。所以它不适合直接放进深色界面（会是一块白方块），也不适合缩到 24–32px（副标题会糊成噪点）。

图形标的提取用连通域分析完成：原图里图形标由两块大面积色块叠成，像素量远大于任何字母，据此可以稳定地把图形标和文字分开；随后按亮度把近白背景转为透明。**注意图形标与文字的横坐标有重叠**，"VoltMind" 的 V 会落进图形标的裁剪矩形内，因此必须按连通域标签做掩膜，不能只做矩形裁切。

需要更换品牌时：替换 `voltmind-logo.png`，再按同样方式重新生成另两个文件。两个衍生文件是一次性处理产物，生成脚本未纳入仓库。

## 设计令牌

颜色、圆角等语义令牌集中定义在 `src/assets/index.css`，用 `oklch()` 书写，浅色在 `:root`、深色在 `.dark`。新增颜色时需同时补两处并加入 `@theme inline` 映射，才能生成对应工具类。

## 模型服务管理

设置页的「模型服务」卡片管理供应商，数据来自后端，**前端不保存任何密钥**：

| 能力 | 说明 |
| --- | --- |
| 供应商 | 新增、编辑、删除；内置供应商（环境变量提供）只读展示 |
| 模型 | 每个供应商可配多个模型，自定义模型 ID 与显示名称 |
| 密钥展示 | 只显示「密钥已配置 / 未配置密钥」与脱敏串（前 3 后 4），编辑时留空表示不修改 |
| 删除 | 两步确认，不使用浏览器原生 `confirm` |
| 对话页选择器 | 位于输入框工具行左侧，按供应商分组展示已保存的模型，切换后请求带上对应的两个 ID |

两条约束值得记住：

- **API Key 只在提交请求体里出现一次**，不写 `localStorage`、不进 URL、不回显；契约里也没有任何返回明文的字段。
- **模型选择在内存里**：目录每次进入对话页都会刷新，选中项只要仍在可用列表里就会被保留；被删掉时才回退到后端默认模型或列表首项。不持久化是为了避免选中一个后端已删除的模型。

选择器为什么不用原生 `<select>`：原生控件的下拉面板由操作系统绘制，CSS 无法定制，做不出与工作台一致的样式。改用 `components/chat/ModelSelect.vue`，基于已在依赖里的 Reka UI 的 Select 原语（分组、键盘导航与 ARIA 由它负责），代价是产物多打包约 84 kB（gzip 约 27 kB）。

## 工作台背景

工作台整体铺一张背景图（`public/backgrounds/snow-winter.jpeg`），实现放在 `App.vue` 的两层固定层里：

```text
固定层 z-0：背景图（bg-cover / bg-center，pointer-events-none）
固定层 z-0：遮罩（bg-background/70，深色 bg-background/72，不虚化）
内容       z-10：侧栏 + 顶栏 + 视图
```

两条原则：

- **遮罩只淡化、不虚化**：照片保持清晰，可读性靠遮罩浓度保证。调参改遮罩透明度即可（更清楚用 `/60`，更淡用 `/80`），不要动图片本身。
- **内容永远在背景之上**：背景与遮罩都在 `z-0` 且不接收指针事件，内容整体在 `z-10`；侧栏用半透明让背景连续透出，卡片（`bg-card`）保持不透明，保证长文本可读。

换背景图只要替换文件（保持文件名）或改 `App.vue` 里的 `background-image` 路径。图片按原图入库（当前约 313 KB），没有做压缩或响应式裁剪。

## 与后端联调

后端为 `ai-service/`（FastAPI），接口契约见 workspace 的《AI 服务接口契约》。对话页已接入真实接口，链路为：

```text
ChatView → src/api/chat.ts → src/lib/http.ts（Axios）→ POST /api/v1/chat
SettingsView → ModelServiceCard → src/api/providers.ts → /api/v1/providers、/api/v1/models
```

启动顺序：

```powershell
# 终端 A：Python AI 服务
cd ../ai-service
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload

# 终端 B：前端
npm run dev
```

跨域由后端 `CORS_ALLOW_ORIGINS` 放行，默认已包含本工程的 5174（dev）与 4173（preview）。若不想依赖 CORS，可在 `vite.config.ts` 启用已留出的 `/api` 代理改为同源请求。

失败提示都留在对话流里（不弹窗），便于对照上下文：

| 情况 | 界面提示 |
| --- | --- |
| 成功 | 展示模型返回的 `answer` |
| 超时 | 提示超时秒数，来自 `VITE_API_TIMEOUT_MS` |
| 连不上后端 | 提示服务地址，并提示确认 Python AI 服务已启动 |
| 后端返回错误状态 | 展示 `服务返回 <状态码>：<detail>` |

**API Key 只由后端持有**（内置 DeepSeek 与自定义供应商都一样）：前端不读取、不保存、不转发该密钥，只显示脱敏状态；后端对自定义供应商的密钥做加密落盘。
