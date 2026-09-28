import { readOnly } from './runtime'
import { managementPages } from './management-pages'
import { reactive } from 'vue'
import MarkdownIt from 'markdown-it'
import anchor from 'markdown-it-anchor'
import hljs from 'highlight.js/lib/common'
import { parse } from 'yaml'
import { parseNavigationOrder } from '../../scripts/navigation-order.mjs'

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
function compareContentPaths(a: string, b: string) {
  // Numeric prefixes define order; raw names break locale-equivalent ties.
  return a.localeCompare(b, 'zh-CN', { numeric: true }) || (a < b ? -1 : a > b ? 1 : 0)
}
export function buildKnowledge(files: Record<string, string>, folders: string[] = [], resolveAsset?: AssetResolver, navigationRaw: string | null = null) {
  const { order } = parseNavigationOrder(navigationRaw)
  const items = Object.entries(files).sort(([a], [b]) => compareContentPaths(a, b)).map(([path, raw]) => parseDocument(path, raw))
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
  for (const path of folders) folderNode(path)
  for (const doc of items) {
    folderNode(doc.path.split('/').slice(0, -1).join('/')).push({ key: doc.id, title: doc.title, doc })
    doc.html = renderDocument(doc, items, resolveAsset)
  }
  // Static builds supply only .gitkeep folders; local connections supply every
  // directory. Sort the merged tree so those inputs produce the same order.
  const orderedDocs: Doc[] = []
  function sortNodes(nodes: NavNode[], parent = '') {
    const sourcePath = (node: NavNode) => node.doc?.path || node.key.slice(1)
    const positions = new Map((order[parent] || []).map((name, index) => [name, index]))
    const position = (node: NavNode) => positions.get(sourcePath(node).split('/').at(-1)!) ?? Number.MAX_SAFE_INTEGER
    nodes.sort((a, b) => position(a) - position(b) || compareContentPaths(sourcePath(a), sourcePath(b)))
    for (const node of nodes) {
      if (node.children) sortNodes(node.children, sourcePath(node))
      else if (node.doc) orderedDocs.push(node.doc)
    }
  }
  sortNodes(tree)
  return { docs: orderedDocs, navigation: tree }
}
export function withManagementPages(files: Record<string, string>) {
  const result = { ...files }
  if (readOnly) {
    for (const [path, raw] of Object.entries(result)) if (['workspace-settings', 'workspace-harness'].includes(parseDocument(path, raw).id)) delete result[path]
    return result
  }
  const ids = new Set(Object.entries(files).map(([path, raw]) => parseDocument(path, raw).id))
  for (const page of managementPages) {
    if (ids.has(page.id)) continue
    let path = page.path
    let suffix = 0
    while (Object.hasOwn(result, path)) path = `06-空间配置/${page.id}-${++suffix}.md`
    result[path] = page.raw
  }
  return result
}
export function collectContentPaths(files: Record<string, string>, folders: string[] = []): Set<string> {
  const paths = new Set<string>()
  for (const entry of [...Object.keys(files), ...folders]) {
    let path = entry
    while (path) {
      paths.add(path)
      path = path.slice(0, Math.max(0, path.lastIndexOf('/')))
    }
  }
  return paths
}
export function isSortableNode(node: NavNode, paths: ReadonlySet<string> = realContentPaths): boolean {
  if (node.doc && ['workspace-settings', 'workspace-harness'].includes(node.doc.id)) return false
  return paths.has(node.doc?.path || node.key.slice(1))
}
export function filterSortableNodes(nodes: NavNode[], paths: ReadonlySet<string> = realContentPaths): NavNode[] {
  return nodes.filter(node => isSortableNode(node, paths))
}
const rawFiles = import.meta.glob('../content/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const markers = import.meta.glob('../content/**/.gitkeep', { query: '?raw', import: 'default', eager: true })
const navigationFiles = import.meta.glob('../content/.navigation.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
export const bundledFiles = Object.fromEntries(Object.entries(rawFiles).map(([path, raw]) => [path.replace('../content/', ''), raw]))
export const bundledFolders = Object.keys(markers).map(path => path.replace('../content/', '').replace(/\/.gitkeep$/, ''))
export const bundledNavigationRaw = navigationFiles['../content/.navigation.json'] ?? null
const initial = buildKnowledge(withManagementPages(bundledFiles), bundledFolders, undefined, bundledNavigationRaw)
const state: { docs: Doc[]; navigation: NavNode[]; local: boolean; navigationMetadata?: { raw: string | null }; realContentPaths?: Set<string> } = import.meta.hot?.data.knowledge || { docs: reactive<Doc[]>(initial.docs), navigation: reactive<NavNode[]>(initial.navigation), local: false }
export const docs = state.docs
export const navigation = state.navigation
export const navigationMetadata = state.navigationMetadata ||= reactive({ raw: bundledNavigationRaw })
export const realContentPaths = state.realContentPaths ||= reactive(collectContentPaths(bundledFiles, bundledFolders))
function updateRealContentPaths(files: Record<string, string>, folders: string[]) {
  const next = collectContentPaths(files, folders)
  realContentPaths.clear()
  next.forEach(path => realContentPaths.add(path))
}
export function replaceKnowledge(files: Record<string, string>, folders: string[] = [], resolveAsset?: AssetResolver, navigationRaw: string | null = null) {
  const next = buildKnowledge(withManagementPages(files), folders, resolveAsset, navigationRaw)
  state.local = true
  updateRealContentPaths(files, folders)
  docs.splice(0, docs.length, ...next.docs)
  navigation.splice(0, navigation.length, ...next.navigation)
  navigationMetadata.raw = navigationRaw
}
if (import.meta.hot) {
  import.meta.hot.dispose(data => { data.knowledge = state })
  import.meta.hot.accept(next => {
    if (!next || state.local) return
    const updated = buildKnowledge(withManagementPages(next.bundledFiles), next.bundledFolders, undefined, next.bundledNavigationRaw)
    updateRealContentPaths(next.bundledFiles, next.bundledFolders)
    docs.splice(0, docs.length, ...updated.docs)
    navigation.splice(0, navigation.length, ...updated.navigation)
    navigationMetadata.raw = next.bundledNavigationRaw
  })
}
