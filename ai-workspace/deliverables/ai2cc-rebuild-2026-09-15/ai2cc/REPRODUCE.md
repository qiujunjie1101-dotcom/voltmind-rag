# AI2CC 精确模板

这是 2026-09-15 当前工作区的源码快照，包含最新的目录边缘折叠按钮、Logo 右侧“文档”标签、浅深色切换和更宽的本页目录间距。它包含未提交的界面修改，因此以文件校验清单为准，不能只通过 Git 的基础提交重建。

## 启动

```sh
node scripts/verify-template.mjs
npm ci
npm run build
npm run check:content
npm run dev
```

使用 Node.js 22.12+。保留 package-lock.json，不升级依赖。默认本地地址是 http://127.0.0.1:5173/，端口被占用时以 Vite 输出为准。开发服务器只负责提供前端模块和 HMR；项目内没有文件上传或写盘 HTTP API。

## 一致性

所有原项目文本源码、样例 Markdown、图片、字体和依赖锁文件保留。原站托管标识、Git 历史、环境文件、node_modules、构建产物和工作区临时文件不在模板中。

先用原样例内容与 references 的截图比较，再替换 src/content。修改后可用 `node scripts/verify-template.mjs --implementation-only` 检查核心代码与素材是否保持原样；它跳过样例 Markdown 和原项目 README，其他受清单追踪的文件仍须一致。校验器验证清单里的文件，不禁止你另加 Markdown 或媒体。

SHA-256 清单用于检测内容差异，不是发布者的数字签名。截图基准为 macOS Chrome、DPR=1；使用不同系统的中文字体或浏览器，字体栅格化可能有差异。

本地编辑需支持 File System Access API 的浏览器和用户选择目录授权。内置浏览器不支持时仍可阅读，不能无授权直接写原项目。完整限制见原项目 README 与站内本地编辑文档。

references/computed-layout.json 给出各视口下真实计算的尺寸和颜色。页面内容高度依赖文本，替换内容后不需要保持同一高度。截图须等字体、图片和入场动画完成。

把 ZIP 和外部的 AI2CC-完整复刻Prompt.md 一起交给 Agent 即可使用。它会优先复用本包源码，Prompt 的内嵌源码作为补充参考。
