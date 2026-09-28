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
