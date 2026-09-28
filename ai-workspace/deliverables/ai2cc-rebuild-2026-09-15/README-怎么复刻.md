# 复刻当前 AI2CC

推荐用 Prompt + 模板包。Prompt 已包含完整文本源码和详细设计/功能规格；ZIP 提供字节一致的原始图片、字体、锁文件和项目快照。只凭自然语言描述，不能保证模型重写出完全一样的代码和素材。

## 交给其他 Agent

1. 附上 `AI2CC-exact-template.zip`。
2. 将 `AI2CC-完整复刻Prompt.md` 的全文复制到对话框，也可将它作为附件并明确要求执行。
3. 初始内容无需改时直接运行；需要不同内容时补充“只替换 src/content 中的 Markdown，其他实现与素材保持一致”。

可直接复制以下短指令（与两份附件一起发）：

> 请执行附件《AI2CC-完整复刻Prompt.md》，使用 AI2CC-exact-template.zip 恢复并运行知识库。先校验模板、安装锁定依赖、构建、检查内容并启动预览，再对照截图验证浅深色、桌面和移动端。保留所有布局、颜色、图标、Markdown 渲染、本地目录/文档/媒体编辑功能和源码结构。只允许替换初始 Markdown 内容。请直接完成，不重新设计，不自动发布线上。

## 自己直接启动

解压 ZIP，进入 ai2cc 目录，按 REPRODUCE.md 执行即可，不需要 AI 重新生成。

## 包含内容

- AI2CC-完整复刻Prompt.md：详细规格、实际文本源码、版本和原素材校验值。
- AI2CC-exact-template.zip：可运行模板，保留当前所有实现和 12 篇样例文档。
- references/：1440 桌面浅/深色与收起状态、1200 桌面、390 移动端浅/深色截图，以及实际布局 JSON。
- SHA256SUMS.txt：Prompt 和 ZIP 的文件摘要。
- ai2cc/：ZIP 的未压缩副本，方便本地查看和检查。

## 精确程度

源码、原图、字体和锁文件在模板中保持字节一致。相同系统、浏览器、视口、DPR 和内容下可以按基准截图核对。改初始内容会改变换行和页面高度；跨系统中文字体及抗锯齿可能略有差异。

文件清单以本次工作区快照为准，包含未提交的最新 UI 修改。模板不携带原站的托管项目身份、Git 历史或本机环境文件。

已生成 SHA-256 校验器。对新模板可执行 `node scripts/verify-template.mjs`；换文案后可执行 `node scripts/verify-template.mjs --implementation-only`。

## Skill 是否必要

单次复刻不需要再安装 Skill。反复给不同人或不同 Agent 使用时，可把同一份 Prompt 作为 Skill 的工作流程，把 ZIP 作为它的模板资源。精准度仍然来自基准源码与资源，不来自文件叫 Prompt 还是 Skill。

实测：已独立安装、构建、内容检查通过，六组原站/模板截图 PNG 字节一致。详细记录见 `references/VALIDATION.md`。
