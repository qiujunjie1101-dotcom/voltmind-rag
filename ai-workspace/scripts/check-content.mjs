import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { parseNavigationOrder, serializeNavigationOrder, MAX_NAVIGATION_BYTES } from './navigation-order.mjs'
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } })
try {
  const content = await server.ssrLoadModule('/src/lib/content.ts')
  const { docs, resolveMarkdownLink, parseDocument, renderDocument, buildKnowledge, withManagementPages, collectContentPaths, isSortableNode, filterSortableNodes } = content
  const { sortableSiblingsAt, resolveNavigationMove, planNavigationOrder } = await server.ssrLoadModule('/src/lib/navigation-sort.ts')
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
  // Parser fixtures must not depend on the template project's sample articles.
  const writing = parseDocument('guides/writing.md', '---\nslug: fixture-writing\n---\n## Markdown 排版示例\n')
  const welcome = parseDocument('intro/welcome.md', '---\nslug: fixture-welcome\n---\n## 欢迎\n')
  const vision = parseDocument('product/vision.md', '---\nslug: fixture-vision\n---\n## 愿景\n')
  const fixtures = [writing, welcome, vision]
  assert.equal(resolveMarkdownLink('#markdown-%E6%8E%92%E7%89%88%E7%A4%BA%E4%BE%8B', writing, fixtures).heading, 'markdown-排版示例')
  assert.equal(resolveMarkdownLink('../product/vision.md', welcome, fixtures).doc?.id, 'fixture-vision')
  const nested = buildKnowledge({ '产品/需求/场景.md': '## 场景' }).navigation
  assert(nested.some(n => n.children?.some(child => child.children)), '应支持多层目录')

  // Static builds list only .gitkeep directories; authorized local reads list
  // every directory. Both must yield the same visible order at every depth.
  const navigationPath = node => node.doc?.path ?? node.key.slice(1)
  const navigationShape = nodes => nodes.map(node => ({
    path: navigationPath(node),
    kind: node.children ? 'folder' : 'document',
    children: node.children ? navigationShape(node.children) : [],
  }))
  const orderFiles = {
    '03-技术空间/02-技术记录.md': '## 技术记录',
    '01-产品空间/03-交付.md': '## 交付',
    '00-开始阅读/01-项目介绍.md': '## 项目介绍',
    '01-产品空间/01-需求.md': '## 需求',
    '01-产品空间/02-需求探索/01-场景.md': '## 场景',
    '02-设计空间/01-视觉原则.md': '## 视觉原则',
    '01-产品空间/04-评审/02-记录.md': '## 记录',
  }
  const staticFolders = ['02-设计空间/设计稿']
  const localFolders = ['03-技术空间', '01-产品空间/04-评审', '02-设计空间/设计稿', '00-开始阅读', '02-设计空间', '01-产品空间', '01-产品空间/02-需求探索']
  const staticNavigation = buildKnowledge(orderFiles, staticFolders).navigation
  const localNavigation = buildKnowledge(orderFiles, localFolders).navigation
  assert.deepEqual(navigationShape(staticNavigation), navigationShape(localNavigation), '静态空目录标记与本地完整目录列表必须生成相同顺序的导航树')
  assert.deepEqual(staticNavigation.map(navigationPath), ['00-开始阅读', '01-产品空间', '02-设计空间', '03-技术空间'], '空间应按原始数字前缀排序，空目录不能提前其所属空间')
  assert.deepEqual(staticNavigation.find(node => navigationPath(node) === '01-产品空间').children.map(navigationPath), [
    '01-产品空间/01-需求.md', '01-产品空间/02-需求探索', '01-产品空间/03-交付.md', '01-产品空间/04-评审',
  ], '同目录的文档与子目录应按数字前缀混排，不能强制目录在前')
  assert.deepEqual(buildKnowledge(orderFiles, localFolders).docs.map(doc => doc.path), [
    '00-开始阅读/01-项目介绍.md', '01-产品空间/01-需求.md', '01-产品空间/02-需求探索/01-场景.md',
    '01-产品空间/03-交付.md', '01-产品空间/04-评审/02-记录.md', '02-设计空间/01-视觉原则.md', '03-技术空间/02-技术记录.md',
  ], '上一篇与下一篇应遵循最终菜单顺序，跳过空目录')

  const expectedNavigation = navigationShape(staticNavigation)
  const fileEntries = Object.entries(orderFiles)
  const shuffledFiles = Object.fromEntries([...fileEntries.slice(3), ...fileEntries.slice(0, 3)].reverse())
  const renamedTitles = Object.fromEntries(fileEntries.map(([path], index) => [path, `---\ntitle: 标题${100 - index}\n---\n## 正文`]))
  for (const files of [orderFiles, shuffledFiles, renamedTitles]) {
    for (const folders of [staticFolders, [...localFolders].reverse()]) {
      for (let read = 0; read < 2; read++) assert.deepEqual(navigationShape(buildKnowledge(files, folders).navigation), expectedNavigation, '输入顺序、显示标题和重复读取不能改变路径排序')
    }
  }
  const collectPaths = nodes => nodes.flatMap(node => [node.path, ...collectPaths(node.children)])
  const existingPaths = new Set(collectPaths(expectedNavigation))
  const existingOnly = nodes => nodes.filter(node => existingPaths.has(node.path)).map(node => ({ ...node, children: existingOnly(node.children) }))
  const addedEmptyFolders = ['01-产品空间/02-需求探索/00-补充空目录', '01-产品空间/02-新空目录', '02-设计空间/00-新草稿', ...localFolders]
  assert.deepEqual(existingOnly(navigationShape(buildKnowledge(shuffledFiles, addedEmptyFolders).navigation)), expectedNavigation, '新增空目录不能改变既有文档和目录的相对顺序')

  const manualOrder = { version: 1, order: {
    '01-产品空间': ['04-评审', '03-交付.md', '01-需求.md', '02-需求探索'],
    '': ['03-技术空间', '01-产品空间', '00-开始阅读', '02-设计空间'],
  } }
  const navigationRaw = serializeNavigationOrder(manualOrder)
  const manualTree = buildKnowledge(orderFiles, staticFolders, undefined, navigationRaw).navigation
  assert.deepEqual(manualTree.map(navigationPath), ['03-技术空间', '01-产品空间', '00-开始阅读', '02-设计空间'], '根目录应使用持久化手动顺序')
  assert.deepEqual(manualTree.find(node => navigationPath(node) === '01-产品空间').children.map(navigationPath), [
    '01-产品空间/04-评审', '01-产品空间/03-交付.md', '01-产品空间/01-需求.md', '01-产品空间/02-需求探索',
  ], '同级文档与目录应共同遵循手动顺序')
  assert.deepEqual(navigationShape(buildKnowledge(shuffledFiles, localFolders, undefined, navigationRaw).navigation), navigationShape(manualTree), '静态构建、本地读取及磁盘枚举变化必须保留同一手动顺序')
  assert.deepEqual(navigationShape(buildKnowledge(orderFiles, staticFolders, undefined, serializeNavigationOrder(parseNavigationOrder(navigationRaw))).navigation), navigationShape(manualTree), '排序配置序列化和刷新后不能改变顺序')
  const withNewDoc = buildKnowledge({ ...orderFiles, '01-产品空间/00-新资料.md': '## 新资料' }, localFolders, undefined, navigationRaw)
  assert.deepEqual(withNewDoc.navigation.find(node => navigationPath(node) === '01-产品空间').children.map(navigationPath), [
    '01-产品空间/04-评审', '01-产品空间/03-交付.md', '01-产品空间/01-需求.md', '01-产品空间/02-需求探索', '01-产品空间/00-新资料.md',
  ], '新资料应追加在既有手动顺序后，不能因数字前缀提前或重排既有项')
  const partialRaw = serializeNavigationOrder({ version: 1, order: { '01-产品空间': ['已删除.md', '03-交付.md'] } })
  assert.deepEqual(buildKnowledge(orderFiles, localFolders, undefined, partialRaw).navigation.find(node => navigationPath(node) === '01-产品空间').children.map(navigationPath), [
    '01-产品空间/03-交付.md', '01-产品空间/01-需求.md', '01-产品空间/02-需求探索', '01-产品空间/04-评审',
  ], '已列出的有效项应优先，失效项忽略，未列出的项沿用数字自然排序')
  assert.deepEqual(navigationShape(buildKnowledge(orderFiles, localFolders, undefined, null).navigation), expectedNavigation, '不存在排序文件时应保留原数字排序')
  assert.equal(Object.getPrototypeOf(parseNavigationOrder(null).order), null, '排序映射不能继承原型属性')
  assert.equal(serializeNavigationOrder(parseNavigationOrder(navigationRaw)), navigationRaw, '序列化应稳定')
  for (const value of [
    { version: 2, order: {} }, { version: 1, order: [] }, { version: 1, order: {}, extra: true },
    { version: 1, order: { '../escape': [] } }, { version: 1, order: { '.hidden': [] } },
    { version: 1, order: { 'a//b': [] } }, { version: 1, order: { '': ['child/path'] } },
    { version: 1, order: { '': ['same.md', 'same.md'] } }, { version: 1, order: { '': ['constructor'] } },
    { version: 1, order: { '': ['.navigation.json'] } }, { version: 1, order: { '': ['x'.repeat(121)] } },
  ]) assert.throws(() => parseNavigationOrder(JSON.stringify(value)), /导航排序配置无效/)
  assert.throws(() => parseNavigationOrder('{"version":1,"order":{"__proto__":[]}}'), /导航排序配置无效/)
  assert.throws(() => parseNavigationOrder('x'.repeat(MAX_NAVIGATION_BYTES + 1)), /256 KiB/)
  assert.throws(() => parseNavigationOrder('中'.repeat(90000)), /256 KiB/, '大小限制应按 UTF-8 字节计量')

  const physicalFiles = { '01-资料/01-介绍.md': '## 介绍', '05-普通目录/文章.md': '## 普通资料', '07-真实目录/文章.md': '## 真实资料' }
  const physicalPaths = collectContentPaths(physicalFiles, ['08-空目录/子目录'])
  const syntheticTree = buildKnowledge(withManagementPages(physicalFiles), ['08-空目录/子目录']).navigation
  const virtualDirectory = syntheticTree.find(node => navigationPath(node) === '06-空间配置')
  assert(virtualDirectory?.children?.length, '无管理资料的空间仍应合成管理入口')
  assert(!physicalPaths.has('06-空间配置'), '合成管理目录不能计入真实文件路径')
  assert(physicalPaths.has('01-资料') && physicalPaths.has('08-空目录'), '静态文件及空目录的祖先属于真实目录')
  assert(!isSortableNode(virtualDirectory, physicalPaths), '合成目录不能作为拖拽源或目标')
  assert(virtualDirectory.children.every(node => !isSortableNode(node, physicalPaths)), '合成管理文档不可排序')
  assert.deepEqual(filterSortableNodes(syntheticTree, physicalPaths).map(navigationPath), ['01-资料', '05-普通目录', '07-真实目录', '08-空目录'], '排序菜单索引必须过滤合成管理目录')
  assert.deepEqual(resolveNavigationMove(syntheticTree, '05-普通目录', 'move-down', physicalPaths), { source: '05-普通目录', target: '07-真实目录', position: 'after' }, '下移必须跳过虚拟目录')
  assert.equal(resolveNavigationMove(syntheticTree, '08-空目录', 'move-down', physicalPaths), null, '末个真实节点的下移应禁用')
  assert.throws(() => planNavigationOrder(syntheticTree, { source: '05-普通目录', target: '06-空间配置', position: 'after' }, null, physicalPaths), /内置配置页不参与排序/)
  const filteredOrder = parseNavigationOrder(planNavigationOrder(syntheticTree, { source: '05-普通目录', target: '07-真实目录', position: 'after' }, null, physicalPaths))
  assert.deepEqual(filteredOrder.order[''], ['01-资料', '07-真实目录', '05-普通目录', '08-空目录'], '保存顺序不得包含虚拟管理目录')
  const reloadedTree = buildKnowledge(withManagementPages(physicalFiles), ['08-空目录/子目录'], undefined, serializeNavigationOrder({ version: 1, order: { '': ['05-普通目录', '01-资料', '07-真实目录', '08-空目录'] } })).navigation
  assert.equal(resolveNavigationMove(reloadedTree, '05-普通目录', 'move-down', physicalPaths).target, '01-资料', '授权读取改变顺序后，上下移目标应按当前真实同级顺序重新计算')
  const existingManagement = {
    '管理/01-普通.md': '## 普通一',
    '管理/02-配置.md': '---\nslug: workspace-settings\n---\n## 配置',
    '管理/03-普通.md': '## 普通二',
  }
  const existingManagementPaths = collectContentPaths(existingManagement)
  const managementTree = buildKnowledge(withManagementPages(existingManagement)).navigation
  assert.deepEqual(sortableSiblingsAt(managementTree, '管理', existingManagementPaths).map(navigationPath), ['管理/01-普通.md', '管理/03-普通.md'], '真实管理文档仍应禁拖且不能作为菜单排序目标')
  assert.equal(resolveNavigationMove(managementTree, '管理/01-普通.md', 'move-down', existingManagementPaths).target, '管理/03-普通.md')
  assert.throws(() => resolveNavigationMove(managementTree, '管理/02-配置.md', 'move-up', existingManagementPaths), /内置配置页不参与排序/)
  content.replaceKnowledge(physicalFiles)
  assert(!content.realContentPaths.has('06-空间配置') && !isSortableNode(virtualDirectory), '本地替换资料后应同步真实路径状态')
  content.replaceKnowledge({ ...physicalFiles, '06-空间配置/真实资料.md': '## 真实资料' })
  assert(isSortableNode(virtualDirectory), '同一路径包含真实文件后，目录可以排序')
  content.replaceKnowledge(physicalFiles)
  assert(!isSortableNode(virtualDirectory), '重新读取后不能残留上一资料库的真实路径')
  content.replaceKnowledge(content.bundledFiles, content.bundledFolders, undefined, content.bundledNavigationRaw)

  // Numeric collation treats leading zeroes as equal. Equivalent Unicode
  // spellings also need a raw-path tie-breaker, never the input insertion order.
  const numericPaths = ['10-alpha.md', '2-Alpha.md', '2-alpha.md', '02-alpha.md', '2-É.md', '2-É.md']
  const expectedNumericPaths = ['02-alpha.md', '2-alpha.md', '2-Alpha.md', '2-É.md', '2-É.md', '10-alpha.md']
  for (const paths of [numericPaths, [...numericPaths].reverse(), [...numericPaths.slice(2), ...numericPaths.slice(0, 2)]]) {
    const files = Object.fromEntries(paths.map(path => [path, '## 数字排序']))
    assert.deepEqual(buildKnowledge(files).navigation.map(navigationPath), expectedNumericPaths, '数字 2 应先于 10，大小写保持自然排序，前导零与等价字形按原始路径确定顺序')
  }
  for (const folders of [['10-group', '2-group', '02-group'], ['02-group', '2-group', '10-group']]) {
    assert.deepEqual(buildKnowledge({}, folders).navigation.map(navigationPath), ['02-group', '2-group', '10-group'], '纯空目录也应使用数字自然排序和原始路径兜底')
  }
  for (const [language, source] of [['json', '{"role":"PM"}'], ['yaml', 'name: workspace-pm'], ['bash', 'echo "workspace"']]) {
    const sample = parseDocument('config.md', '```' + language + '\n' + source + '\n```')
    assert(renderDocument(sample, [sample]).includes('hljs-'), `${language} 配置示例应语法高亮`)
  }
  const mediaDoc = parseDocument('media.md', '![图片](./media/test.png "width=320")\n\n![视频](./media/test.webm "width=640 height=360")\n\n<script>alert(1)</script>')
  const mediaHtml = renderDocument(mediaDoc, [mediaDoc])
  assert(mediaHtml.includes('width:320px;'), '图片宽度应保留')
  assert(mediaHtml.includes('<video') && mediaHtml.includes('controls') && mediaHtml.includes('height:360px;'), '视频应带控制栏并保留尺寸')
  assert(!mediaHtml.includes('<script>'), '媒体语法不能开启原始 HTML 执行')
  const sized = parseDocument('invalid-size.md', '![图片](./media/test.png "width=1;position:fixed height=999999")')
  assert(!renderDocument(sized, [sized]).includes('position:fixed'), '媒体尺寸不能注入 CSS')
  assert(buildKnowledge({}, ['目录/空子目录']).navigation[0].children[0].children, '空目录也应进入文档树')
  console.log(`已验证 ${docs.length} 篇文档：唯一链接、目录层级、导航稳定排序、内部链接、中文标题与安全渲染。`)
} finally { await server.close() }
