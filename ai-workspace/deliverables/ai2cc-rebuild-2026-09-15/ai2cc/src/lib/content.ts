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
