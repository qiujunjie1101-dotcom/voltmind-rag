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
