import { reactive, shallowRef } from 'vue'
import { validateConfig as validateWorkspaceConfig, roleDefinitions } from '../../harness/config.mjs'
import { harnessFile, validateHarnessFile, validateRoles } from './harness-files'
import { buildKnowledge, mediaSources, parseDocument, replaceKnowledge } from './content'
import { authorizeContentService, revokeContentService, readServiceContent, writeServiceDocument, createServiceFolder, writeServiceNavigation, encodeContentAssets, ContentServiceError, type ContentSession, type ContentSnapshot } from './content-service'
import { MAX_NAVIGATION_BYTES, parseNavigationOrder } from '../../scripts/navigation-order.mjs'

type Directory = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>
  queryPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
  requestPermission?(options: { mode: 'readwrite' }): Promise<PermissionState>
}
declare global { interface Window { showDirectoryPicker?: (options: { mode: 'readwrite'; id: string }) => Promise<Directory> } }
export const localProject = reactive({ connected: false, mode: 'folder' as 'folder' | 'service', connectionId: 0, name: '', rememberedName: '', restoring: false, storageWarning: '', restoreError: '', folders: [] as string[], navigationRaw: null as string | null, busy: false, error: '', supported: typeof window !== 'undefined' && 'showDirectoryPicker' in window })
const root = shallowRef<Directory>()
const rememberedRoot = shallowRef<Directory>()
let serviceSession: ContentSession | undefined
let connectionAttempt = 0
let contentSnapshot: ContentSnapshot | undefined
let pendingNavigationWrite: Promise<void> = Promise.resolve()
const urls = new Map<string, string>()
export const localAsset = (src: string) => urls.get(src) || src
// Excludes management pages synthesized for display: sorting may only persist
// actual children from the last successfully loaded project snapshot.
export function getLocalContentPaths(): string[] {
  return contentSnapshot ? [...new Set([...Object.keys(contentSnapshot.files), ...contentSnapshot.folders])] : []
}
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
  if (localProject.mode !== 'folder' || !root.value || !localProject.connected) throw new Error('请先选择本地项目文件夹。')
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
async function readNavigation(base: Directory): Promise<string | null> {
  const handle = await maybeFile(base, '.navigation.json')
  if (!handle) return null
  const file = await handle.getFile()
  if (file.size > MAX_NAVIGATION_BYTES) throw new Error('导航排序配置不能超过 256 KiB。')
  return file.text()
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
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('无法保存项目记录')) }
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
  return { files, folders, navigationRaw: await readNavigation(base) }
}
async function readNativeProject(selected: Directory) {
  const { files, folders, navigationRaw } = await readTree(await dirAt(selected, 'src/content'))
  // Validate before replacing the working library or revoking its media URLs.
  buildKnowledge(files, folders, undefined, navigationRaw)
  const nextUrls = new Map<string, string>()
  try {
    const publicDir = await dirAt(selected, 'public')
    for (const source of new Set(Object.values(files).flatMap(mediaSources))) {
      if (!source.startsWith('./')) continue
      const assetPath = source.slice(2).split(/[?#]/)[0]!
      try {
        const handle = await fileAt(publicDir, decodeURIComponent(assetPath))
        nextUrls.set(source, URL.createObjectURL(await handle.getFile()))
      } catch { /* Leave missing or remote media references visible in the document. */ }
    }
  } catch { /* A project can contain documents without a public directory. */ }
  return { files, folders, navigationRaw, nextUrls }
}
function installContent({ files, folders, navigationRaw = null }: ContentSnapshot, nextUrls = new Map<string, string>()) {
  // Build and render successfully before releasing any old previews.
  replaceKnowledge(files, folders, source => nextUrls.get(source) || source, navigationRaw)
  const oldUrls = [...urls.values()]
  urls.clear(); nextUrls.forEach((value, key) => urls.set(key, value))
  oldUrls.forEach(url => URL.revokeObjectURL(url))
  localProject.folders = [...folders].sort((a, b) => a.localeCompare(b, 'zh-CN', { numeric: true }))
  localProject.navigationRaw = navigationRaw
  contentSnapshot = { files, folders, navigationRaw }
}
function ensureService(session = serviceSession) {
  if (!session || session !== serviceSession || localProject.mode !== 'service' || !localProject.connected) throw new Error('文档授权已变化，请重新连接项目。')
  return session
}
async function useService<T>(session: ContentSession, operation: () => Promise<T>): Promise<T> {
  ensureService(session)
  try { return await operation() }
  catch (error) {
    if (error instanceof ContentServiceError && error.status === 401 && serviceSession === session) {
      serviceSession = undefined
      localProject.connected = false
      localProject.connectionId++
    }
    throw error
  }
}
export async function reloadLocalProject() {
  const id = localProject.connectionId
  if (localProject.mode === 'service') {
    const session = ensureService()
    const snapshot = await useService(session, () => readServiceContent(session))
    ensureService(session)
    if (id !== localProject.connectionId) throw new Error('连接的项目已变化，请重新读取。')
    buildKnowledge(snapshot.files, snapshot.folders, undefined, snapshot.navigationRaw)
    installContent(snapshot)
    return
  }
  const selected = root.value
  if (!selected || !localProject.connected) throw new Error('请先选择本地项目文件夹。')
  const snapshot = await readNativeProject(selected)
  try {
    if (localProject.mode !== 'folder' || selected !== root.value || id !== localProject.connectionId) throw new Error('连接的项目已变化，请重新读取。')
    installContent(snapshot, snapshot.nextUrls)
  } catch (error) { snapshot.nextUrls.forEach(url => URL.revokeObjectURL(url)); throw error }
}
export async function connectServiceProject() {
  const attempt = ++connectionAttempt
  let candidate: ContentSession | undefined
  try {
    candidate = await authorizeContentService()
    const snapshot = await readServiceContent(candidate)
    buildKnowledge(snapshot.files, snapshot.folders, undefined, snapshot.navigationRaw)
    if (attempt !== connectionAttempt) throw new Error('连接的项目已变化，请重新授权。')
    installContent(snapshot)
    const previous = serviceSession
    serviceSession = candidate
    localProject.mode = 'service'
    localProject.name = candidate.name
    localProject.connectionId++
    localProject.connected = true
    localProject.restoreError = ''; localProject.storageWarning = ''
    if (previous) void revokeContentService(previous).catch(() => {})
  } catch (error) {
    if (candidate) await revokeContentService(candidate).catch(() => {})
    throw error
  }
}
export async function disconnectServiceProject() {
  if (localProject.mode !== 'service') return
  ++connectionAttempt
  const previous = serviceSession
  serviceSession = undefined
  localProject.connected = false
  localProject.connectionId++
  // Leave knowledge and preview URLs available while the editor holds a draft.
  if (previous) await revokeContentService(previous)
}
export async function connectLocalProject() {
  if (!window.showDirectoryPicker) throw new Error('此浏览器不支持直接读写文件夹。请在桌面 Chrome 或 Edge 中打开本地知识库，再选择项目文件夹。')
  let selected: Directory
  try { selected = await window.showDirectoryPicker({ id: 'ai2cc-project', mode: 'readwrite' }) } catch (error) {
    if ((error as DOMException).name === 'SecurityError') throw new Error('当前页面环境限制文件夹访问。请使用桌面 Chrome 或 Edge 打开本地知识库，再选择项目。')
    throw error
  }
  try { await dirAt(selected, 'src/content'); await selected.getFileHandle('package.json') } catch { throw new Error('请选择 workspace 项目根文件夹，其中应包含 package.json 和 src/content。') }
  if (!await permission(selected, true)) throw new Error('未获得文件夹读写权限，请重新选择并允许编辑。')
  await activateProject(selected)
  rememberedRoot.value = selected
  localProject.rememberedName = selected.name
  localProject.storageWarning = ''
  try { await handleStore('put', selected) } catch { localProject.storageWarning = '本次已连接，但浏览器未能记住项目，下次可能需要重新选择文件夹。' }
}
async function activateProject(selected: Directory) {
  const attempt = ++connectionAttempt
  await selected.getFileHandle('package.json')
  const snapshot = await readNativeProject(selected)
  try {
    if (attempt !== connectionAttempt) throw new Error('连接的项目已变化，请重新连接。')
    installContent(snapshot, snapshot.nextUrls)
    const previous = serviceSession
    serviceSession = undefined
    if (root.value !== selected || localProject.mode !== 'folder' || !localProject.connected) { localProject.connectionId++; localHarnessRoles.value = roleDefinitions }
    root.value = selected
    localProject.mode = 'folder'
    localProject.name = selected.name
    localProject.connected = true
    localProject.restoreError = ''
    if (previous) void revokeContentService(previous).catch(() => {})
  } catch (error) { snapshot.nextUrls.forEach(url => URL.revokeObjectURL(url)); throw error }
}
export async function reconnectRememberedProject() {
  const saved = rememberedRoot.value
  if (!saved) throw new Error('没有已记住的项目，请选择项目文件夹。')
  // Request immediately from the button click, before any IndexedDB reads.
  if (!saved.requestPermission || await saved.requestPermission({ mode: 'readwrite' }) !== 'granted') {
    throw new Error('未获得文件夹读写权限，请允许访问，或选择其他项目文件夹。')
  }
  try { await activateProject(saved) } catch {
    throw new Error('无法读取已记住的项目，文件夹可能已移动或内容不可用，请重新选择项目文件夹。')
  }
}
export async function restoreLocalProject() {
  if (!localProject.supported || localProject.restoring || localProject.connected) return
  const attempt = connectionAttempt
  localProject.restoring = true
  try {
    const saved = await handleStore('get')
    if (!saved) return
    rememberedRoot.value = saved
    localProject.rememberedName = saved.name
    if (await permission(saved, false) && !localProject.connected && attempt === connectionAttempt) await activateProject(saved)
  } catch {
    localProject.restoreError = '未能自动恢复项目，请重新连接或选择项目文件夹。'
  } finally { localProject.restoring = false }
}
export async function createLocalFolder(parent: string, name: string) {
  validateName(name); parts(parent)
  if (localProject.mode === 'service') {
    const session = ensureService()
    await useService(session, () => createServiceFolder(session, parent, name))
    if (serviceSession !== session || localProject.mode !== 'service') return '目录已创建到原项目，但当前连接已变化，请重新读取。'
    try { await reloadLocalProject(); return '' } catch (error) { return `目录已创建，但列表刷新失败：${(error as Error).message}` }
  }
  if (!localProject.connected) throw new Error('请重新连接项目并允许编辑。')
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
  parts(path)
  if (!/\.md$/i.test(path)) throw new Error('文档必须使用 .md 后缀。')
  if (localProject.mode === 'service') return saveServiceDocument(path, raw, expectedRaw, assets)
  if (!root.value || !localProject.connected || !await permission(root.value, true)) throw new Error('读写权限已失效，请重新连接项目。')
  const base = await contentRoot()
  const existing = await maybeFile(base, path)
  if (expectedRaw === undefined && existing) throw new Error('同名文档已存在，请修改文件名。')
  if (expectedRaw !== undefined && (!existing || await (await existing.getFile()).text() !== expectedRaw)) throw new Error('文件已被其他编辑器修改。请保留当前草稿，关闭后重新读取文件，再合并修改。')
  const latest = await readTree(base)
  buildKnowledge({ ...latest.files, [path]: raw }, latest.folders, undefined, latest.navigationRaw)
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

async function saveServiceDocument(path: string, raw: string, expectedRaw: string | undefined, assets: PendingAsset[]) {
  const session = ensureService()
  const latest = await useService(session, () => readServiceContent(session))
  ensureService(session)
  const exists = Object.hasOwn(latest.files, path)
  if (expectedRaw === undefined && exists) throw new Error('同名文档已存在，请修改文件名。')
  if (expectedRaw !== undefined && (!exists || latest.files[path] !== expectedRaw)) throw new Error('文件已被其他编辑器修改。请保留当前草稿，重新读取后合并。')
  buildKnowledge({ ...latest.files, [path]: raw }, latest.folders, undefined, latest.navigationRaw)
  const referenced = new Set(mediaSources(raw))
  const pending = assets.filter(asset => referenced.has(asset.source))
  const encoded = await encodeContentAssets(pending)
  ensureService(session)
  await useService(session, () => writeServiceDocument(session, path, raw, expectedRaw ?? null, encoded))
  const id = parseDocument(path, raw).id
  if (serviceSession !== session || localProject.mode !== 'service') return { id, warning: '文件已保存到原项目，但当前连接已变化，请重新读取。' }
  // Own separate URLs: the editor releases its staged URLs after a successful
  // save, even when refreshing the library subsequently fails.
  for (const asset of pending) {
    const old = urls.get(asset.source)
    if (old) URL.revokeObjectURL(old)
    urls.set(asset.source, URL.createObjectURL(asset.file))
  }
  let warning = ''
  try { await reloadLocalProject() } catch (error) { warning = `文件已保存，但列表刷新失败：${(error as Error).message}` }
  return { id, warning }
}

// raw is a complete version-1 .navigation.json document; expected must be the
// exact localProject.navigationRaw captured before editing the order.
export function saveLocalNavigation(raw: string, expected: string | null): Promise<{ warning: string }> {
  const connectionId = localProject.connectionId
  const operation = pendingNavigationWrite.then(async () => {
    parseNavigationOrder(raw)
    if (!localProject.connected || localProject.connectionId !== connectionId) throw new Error('连接的项目已变化，请重新连接后排序。')
    if (localProject.navigationRaw !== expected) throw new Error('导航顺序已变化，请重新读取后排序。')
    if (localProject.mode === 'service') {
      const session = ensureService()
      await useService(session, () => writeServiceNavigation(session, raw, expected))
      if (serviceSession !== session || localProject.connectionId !== connectionId) return { warning: '排序已保存到原项目，但当前连接已变化，请重新读取。' }
    } else {
      const selected = root.value
      const ensureSame = () => {
        if (!selected || selected !== root.value || localProject.mode !== 'folder' || !localProject.connected || localProject.connectionId !== connectionId) throw new Error('连接的项目已变化，请重新连接后排序。')
      }
      ensureSame()
      if (!await permission(selected!, true)) throw new Error('读写权限已失效，请重新连接项目。')
      ensureSame()
      const base = await dirAt(selected!, 'src/content')
      const current = await readNavigation(base)
      ensureSame()
      if (current !== expected) throw new Error('导航顺序已被其他窗口或程序修改，请重新读取后排序。')
      const handle = await base.getFileHandle('.navigation.json', { create: true })
      const original = await handle.getFile()
      try {
        ensureSame()
        if (await original.text() !== (expected ?? '')) throw new Error('保存期间导航顺序发生变化，请重新读取后排序。')
        ensureSame()
        await writeFile(handle, raw)
      } catch (error) {
        // getFileHandle(create:true) creates an empty file before the writable
        // stream exists. Remove only our unchanged empty entry on a failed save.
        if (current === null && original.size === 0) {
          try {
            const latest = await maybeFile(base, '.navigation.json')
            const file = await latest?.getFile()
            if (latest && file?.size === 0 && file.lastModified === original.lastModified && await latest.isSameEntry(handle)) await base.removeEntry('.navigation.json')
          } catch { /* Retain the save error and any concurrently changed file. */ }
        }
        throw error
      }
      if (localProject.connectionId !== connectionId || localProject.mode !== 'folder') return { warning: '排序已保存到原项目，但当前连接已变化，请重新读取。' }
    }
    // Keep the committed order visible even if the following disk refresh fails.
    // Existing media URLs remain owned by the current content snapshot.
    localProject.navigationRaw = raw
    try {
      if (contentSnapshot) {
        const next = { ...contentSnapshot, navigationRaw: raw }
        replaceKnowledge(next.files, next.folders, localAsset, raw)
        contentSnapshot = next
      }
      await reloadLocalProject()
      return { warning: '' }
    }
    catch (error) { return { warning: `排序已保存，但列表刷新失败：${(error as Error).message}` } }
  })
  pendingNavigationWrite = operation.then(() => {}, () => {})
  return operation
}

// Personal settings stay outside the published content tree.
export async function readWorkspaceSettings(): Promise<string | null> {
  if (localProject.mode !== 'folder' || !root.value || !localProject.connected) throw new Error('请先选择本地 workspace 文件夹。')
  try { return await (await fileAt(root.value, 'code/projects.local.json')).getFile().then(file => file.text()) }
  catch (error) { if ((error as DOMException).name === 'NotFoundError') return null; throw error }
}
export async function writeWorkspaceSettings(raw: string, expected: string | null, expectedConnectionId: number) {
  const selected = root.value
  const ensureSameProject = () => { if (localProject.mode !== 'folder' || !localProject.connected || !selected || selected !== root.value || expectedConnectionId !== localProject.connectionId) throw new Error('连接的 workspace 已改变，请重新读取配置后再保存。') }
  ensureSameProject()
  if (!root.value || !localProject.connected || !await permission(root.value, true)) throw new Error('请重新连接 workspace 并允许编辑。')
  const config = validateWorkspaceConfig(JSON.parse(raw))
  const current = await readWorkspaceSettings()
  ensureSameProject()
  if (current !== expected) throw new Error('配置已被其他程序修改，请先复制当前草稿，再重新读取配置。')
  const code = await dirAt(selected!, 'code', true)
  ensureSameProject()
  const serialized = JSON.stringify(config, null, 2) + '\n'
  await writeFile(await code.getFileHandle('projects.local.json', { create: true }), serialized)
  return serialized
}

// Only named team-rule files are writable through the harness editor.
export const localHarnessRoles = shallowRef(roleDefinitions)
export async function readHarnessFile(path: string) {
  harnessFile(path)
  if (localProject.mode !== 'folder' || !root.value || !localProject.connected) throw new Error('请先选择本地 workspace 文件夹。')
  const selected = root.value, connectionId = localProject.connectionId
  let raw: string | null
  try { raw = await (await fileAt(selected, path)).getFile().then(file => file.text()) }
  catch (error) { if ((error as DOMException).name === 'NotFoundError') raw = null; else throw error }
  if (localProject.mode !== 'folder' || !localProject.connected || selected !== root.value || connectionId !== localProject.connectionId) throw new Error('连接的 workspace 已变化，请重新读取。')
  if (path === 'harness/roles.json' && raw) { try { localHarnessRoles.value = validateRoles(JSON.parse(raw)).roles } catch { /* The editor must allow repairing malformed files. */ } }
  return raw
}
export async function writeHarnessFile(path: string, raw: string, expected: string | null, connectionId: number) {
  validateHarnessFile(path, raw)
  const selected = root.value
  const ensureSame = () => { if (localProject.mode !== 'folder' || !localProject.connected || !selected || selected !== root.value || connectionId !== localProject.connectionId) throw new Error('连接的 workspace 已变化，请重新读取后再保存。') }
  ensureSame()
  if (!localProject.connected || !await permission(selected!, true)) throw new Error('请重新连接 workspace 并允许编辑。')
  const current = await readHarnessFile(path)
  ensureSame()
  if (current !== expected) throw new Error('这个文件已被其他编辑器修改。请先下载当前草稿，再重新读取合并。')
  const segments = parts(path), filename = segments.pop()!
  const parent = await dirAt(selected!, segments.join('/'), true)
  ensureSame()
  await writeFile(await parent.getFileHandle(filename, { create: true }), raw)
  if (path === 'harness/roles.json' && selected === root.value) localHarnessRoles.value = validateRoles(JSON.parse(raw)).roles
  return raw
}
