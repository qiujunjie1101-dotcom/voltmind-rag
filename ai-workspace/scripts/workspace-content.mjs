import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, rename, unlink, link, readdir, rmdir } from 'node:fs/promises'
import path from 'node:path'
import { MAX_NAVIGATION_BYTES, parseNavigationOrder } from './navigation-order.mjs'

export const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
const MAX_ASSET_BYTES = 20 * 1024 * 1024
const MAX_ASSETS_BYTES = 40 * 1024 * 1024
const MAX_LIBRARY_BYTES = 64 * 1024 * 1024
const mimeTypes = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', mp4: 'video/mp4', webm: 'video/webm', ogv: 'video/ogg', mov: 'video/quicktime' }
export class ContentError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const fail = (status, message) => { throw new ContentError(status, message) }
const missing = error => error?.code === 'ENOENT'
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino
function nameParts(value, allowRoot = false) {
  if (allowRoot && value === '') return []
  if (typeof value !== 'string' || value.length > 2048) fail(400, '内容路径无效。')
  const parts = value.split('/')
  if (parts.length > 30 || parts.some(part => !part || part !== part.trim() || part.startsWith('.') || /[\\<>:"|?*\x00-\x1f\x7f]/.test(part) || /[. ]$/.test(part) || part.length > 120)) fail(400, '名称不能包含路径跳转、隐藏文件或特殊字符。')
  return parts
}
function objectFields(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) fail(400, '请求包含无效字段。')
}
function decodeAssets(assets) {
  if (!Array.isArray(assets) || assets.length > 100) fail(400, '媒体列表无效，单次最多保存 100 个文件。')
  let total = 0
  const names = new Set()
  return assets.map(asset => {
    objectFields(asset, ['name', 'type', 'data'])
    const extension = typeof asset.name === 'string' && asset.name.match(/^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.(png|jpe?g|webp|gif|avif|mp4|webm|ogv|mov)$/i)?.[1]?.toLowerCase()
    if (!extension || names.has(asset.name.toLowerCase())) fail(400, '媒体文件必须使用不重复的 UUID 文件名和受支持的扩展名。')
    names.add(asset.name.toLowerCase())
    if (typeof asset.type !== 'string' || (asset.type && asset.type.toLowerCase().split(';')[0] !== mimeTypes[extension])) fail(400, '媒体类型与文件扩展名不匹配。')
    if (typeof asset.data !== 'string') fail(400, '媒体内容必须为有效的 Base64。')
    if (asset.data.length > Math.ceil(MAX_ASSET_BYTES / 3) * 4) fail(413, '单个媒体文件不能超过 20 MB。')
    if (asset.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)) fail(400, '媒体内容必须为有效的 Base64。')
    const data = Buffer.from(asset.data, 'base64')
    if (!data.length || data.toString('base64') !== asset.data) fail(400, '媒体文件内容无效。')
    if (data.length > MAX_ASSET_BYTES || (total += data.length) > MAX_ASSETS_BYTES) fail(413, '单个媒体文件不能超过 20 MB，单次媒体总量不能超过 40 MB。')
    return { name: asset.name, data }
  })
}

// The validator comes from the same buildKnowledge() used by the browser.
export async function createContentStore(root, { validateKnowledge }) {
  if (typeof validateKnowledge !== 'function') throw new TypeError('validateKnowledge is required')
  const workspace = await realpath(root)
  const workspaceInfo = await lstat(workspace)
  let pending = Promise.resolve()
  const serialize = operation => {
    const result = pending.then(operation)
    pending = result.catch(() => {})
    return result
  }

  async function directory(relative, create = false) {
    if (await realpath(workspace) !== workspace || !sameFile(workspaceInfo, await lstat(workspace))) fail(409, '空间目录已变化，请重新启动服务并授权。')
    let absolute = workspace, info = workspaceInfo
    for (const segment of relative.split('/').filter(Boolean)) {
      absolute = path.join(absolute, segment)
      if (create) {
        try { await mkdir(absolute) } catch (error) { if (error.code !== 'EEXIST') throw error }
      }
      try { info = await lstat(absolute) } catch (error) { if (missing(error)) fail(404, '内容目录不存在，请重新读取空间。'); throw error }
      if (!info.isDirectory() || info.isSymbolicLink() || await realpath(absolute) !== absolute) fail(409, '内容和媒体目录必须是当前空间内的真实目录，不能使用链接。')
    }
    return { relative, absolute, info }
  }
  async function unchangedDirectory(original) {
    const current = await directory(original.relative)
    if (!sameFile(original.info, current.info)) fail(409, '目录已被其他程序替换，请重新读取。')
  }
  async function readFile(relative, limit = MAX_DOCUMENT_BYTES, sizeError = '文档不能超过 2 MB。') {
    const parent = await directory(path.posix.dirname(relative))
    const absolute = path.join(workspace, relative)
    let info
    try { info = await lstat(absolute) } catch (error) { if (missing(error)) return null; throw error }
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) fail(409, '文档和媒体必须是独立的普通文件，不能使用链接。')
    if (info.size > limit) fail(413, sizeError)
    const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const opened = await handle.stat()
      if (!opened.isFile() || opened.nlink !== 1 || !sameFile(info, opened)) fail(409, '文件已变化，请重新读取。')
      const buffer = Buffer.alloc(Math.min(limit + 1, opened.size + 1))
      let bytes = 0
      while (bytes < buffer.length) {
        const result = await handle.read(buffer, bytes, buffer.length - bytes, bytes)
        if (!result.bytesRead) break
        bytes += result.bytesRead
      }
      const after = await handle.stat()
      if (after.size > limit || bytes > limit) fail(413, sizeError)
      if (after.size !== opened.size || after.mtimeMs !== opened.mtimeMs || bytes !== after.size) fail(409, '读取期间文件发生变化，请重试。')
      await unchangedDirectory(parent)
      const current = await lstat(absolute)
      if (!sameFile(current, opened) || current.nlink !== 1 || current.isSymbolicLink()) fail(409, '文件已变化，请重新读取。')
      return buffer.subarray(0, bytes).toString('utf8')
    } finally { await handle.close() }
  }

  async function readContent() {
    const files = Object.create(null), folders = []
    let bytes = 0, entries = 0
    async function walk(relative = '') {
      const location = await directory(`src/content${relative ? '/' + relative : ''}`)
      for (const entry of await readdir(location.absolute, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        if (++entries > 10000) fail(413, '内容数量过多，请缩小当前空间。')
        const child = relative ? `${relative}/${entry.name}` : entry.name
        nameParts(child)
        if (entry.isSymbolicLink()) fail(409, '内容目录中不能使用符号链接。')
        if (entry.isDirectory()) { folders.push(child); await walk(child) }
        else if (/\.md$/i.test(entry.name)) {
          const raw = await readFile(`src/content/${child}`)
          if (raw === null) fail(409, '读取期间文档已被删除，请重试。')
          bytes += Buffer.byteLength(raw)
          if (bytes > MAX_LIBRARY_BYTES) fail(413, '空间内容总量不能超过 64 MB。')
          files[child] = raw
        }
      }
      await unchangedDirectory(location)
    }
    await walk()
    const navigationRaw = await readNavigation()
    return { files, folders: folders.sort(), navigationRaw }
  }

  const readNavigation = () => readFile('src/content/.navigation.json', MAX_NAVIGATION_BYTES, '排序配置不能超过 256 KiB。')

  function navigation(raw) {
    try { return parseNavigationOrder(raw) }
    catch (error) { fail(400, `排序配置无效：${error.message}`) }
  }

  async function validateNavigationTargets(next, previous) {
    const { files, folders } = await readContent()
    const available = new Set([...Object.keys(files), ...folders])
    const directories = new Set(['', ...folders])
    for (const [parent, names] of Object.entries(next.order)) {
      const oldNames = previous.order[parent] || []
      if (!directories.has(parent)) {
        // An unrelated sort may preserve an obsolete branch after an external
        // delete. It cannot add or change entries beneath that missing branch.
        if (Object.hasOwn(previous.order, parent) && JSON.stringify(oldNames) === JSON.stringify(names)) continue
        fail(409, '排序目标目录已不存在，请刷新目录树后重试。')
      }
      for (const name of names) {
        if (!available.has(parent ? `${parent}/${name}` : name) && !oldNames.includes(name)) fail(409, '排序目标已变化，请刷新目录树后重试。')
      }
    }
  }

  function saveNavigation(body, authorize = () => {}) {
    return serialize(async () => {
      objectFields(body, ['raw', 'expected'])
      if (typeof body.raw !== 'string' || !(body.expected === null || typeof body.expected === 'string')) fail(400, '请提供排序内容和上次读取的原文。')
      if (Buffer.byteLength(body.raw) > MAX_NAVIGATION_BYTES || (body.expected !== null && Buffer.byteLength(body.expected) > MAX_NAVIGATION_BYTES)) fail(413, '排序配置不能超过 256 KiB。')
      const next = navigation(body.raw)
      // A malformed on-disk file can be repaired without treating its invalid
      // entries as permission to introduce missing paths into the new order.
      let previous
      try { previous = parseNavigationOrder(body.expected) } catch { previous = parseNavigationOrder(null) }
      authorize()
      const parent = await directory('src/content')
      const compare = async () => {
        if (await readNavigation() !== body.expected) fail(409, '排序已被其他窗口或程序修改，请刷新目录树后重新排列。')
      }
      await compare()
      await validateNavigationTargets(next, previous)
      const temp = await temporary(parent, body.raw)
      try {
        await validateNavigationTargets(next, previous)
        await compare()
        await unchangedDirectory(parent)
        authorize()
        if (body.expected === null) await publishNew(temp, '.navigation.json')
        else await rename(temp.absolute, path.join(parent.absolute, '.navigation.json'))
        return { raw: body.raw }
      } finally { await cleanCreated(temp) }
    })
  }

  async function validate(files, folders) {
    try { await validateKnowledge(files, folders) }
    catch (error) { fail(400, `文档校验失败：${error.message || '请检查文档格式和 slug。'}`) }
  }
  async function cleanCreated(entry) {
    try {
      await unchangedDirectory(entry.parent)
      const current = await lstat(entry.absolute)
      if (current.isFile() && !current.isSymbolicLink() && sameFile(entry.info, current)) await unlink(entry.absolute)
    } catch { /* Rollback must not delete files another program has replaced. */ }
  }
  async function temporary(parent, data) {
    await unchangedDirectory(parent)
    const absolute = path.join(parent.absolute, `.workspace-content-${randomBytes(16).toString('hex')}.tmp`)
    const handle = await open(absolute, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    const entry = { absolute, parent, info: await handle.stat() }
    try { await handle.writeFile(data); await handle.sync() }
    catch (error) { await handle.close(); await cleanCreated(entry); throw error }
    await handle.close()
    return entry
  }
  async function publishNew(temp, name) {
    await unchangedDirectory(temp.parent)
    const absolute = path.join(temp.parent.absolute, name)
    try { await link(temp.absolute, absolute) }
    catch (error) { if (error.code === 'EEXIST') fail(409, '同名文档或媒体已存在，请重新读取或重新插入媒体。'); throw error }
    const entry = { absolute, parent: temp.parent, info: temp.info }
    try { await unlink(temp.absolute) }
    catch (error) { await cleanCreated(entry); throw error }
    return entry
  }

  function saveDocument(body, authorize = () => {}) {
    return serialize(async () => {
      objectFields(body, ['path', 'raw', 'expected', 'assets'])
      const parts = nameParts(body.path)
      if (!/\.md$/i.test(parts.at(-1)) || typeof body.raw !== 'string' || !(body.expected === null || typeof body.expected === 'string')) fail(400, '请提供 Markdown 文档、当前原文和上次读取的原文。')
      if (Buffer.byteLength(body.raw) > MAX_DOCUMENT_BYTES || (body.expected !== null && Buffer.byteLength(body.expected) > MAX_DOCUMENT_BYTES)) fail(413, '文档不能超过 2 MB。')
      const assets = decodeAssets(body.assets)
      authorize()
      const relative = `src/content/${body.path}`
      const parent = await directory(path.posix.dirname(relative))
      const compare = async () => {
        if (await readFile(relative) !== body.expected) fail(409, '文档已被其他窗口或程序修改，请保留草稿并重新读取后合并。')
      }
      await compare()
      const before = await readContent()
      await validate({ ...before.files, [body.path]: body.raw }, before.folders)
      const created = [], temps = []
      let documentWritten = false
      try {
        if (assets.length) {
          const media = await directory('public/media', true)
          for (const asset of assets) {
            authorize()
            const temp = await temporary(media, asset.data)
            temps.push(temp)
            created.push(await publishNew(temp, asset.name))
          }
        }
        const temp = await temporary(parent, body.raw)
        temps.push(temp)
        await compare()
        const latest = await readContent()
        await validate({ ...latest.files, [body.path]: body.raw }, latest.folders)
        await compare()
        await unchangedDirectory(parent)
        authorize()
        if (body.expected === null) await publishNew(temp, parts.at(-1))
        else await rename(temp.absolute, path.join(parent.absolute, parts.at(-1)))
        documentWritten = true
        return { saved: true }
      } finally {
        for (const temp of temps) await cleanCreated(temp)
        if (!documentWritten) for (const entry of created.reverse()) await cleanCreated(entry)
      }
    })
  }

  function createFolder(body, authorize = () => {}) {
    return serialize(async () => {
      objectFields(body, ['parent', 'name'])
      nameParts(body.parent, true)
      if (nameParts(body.name).length !== 1) fail(400, '目录名称不能包含路径分隔符。')
      authorize()
      const parent = await directory(`src/content${body.parent ? '/' + body.parent : ''}`)
      const relative = `${parent.relative}/${body.name}`
      const absolute = path.join(parent.absolute, body.name)
      try { await mkdir(absolute) }
      catch (error) { if (error.code === 'EEXIST') fail(409, '这个目录已存在，请换一个名称。'); throw error }
      const folder = await directory(relative)
      const temps = []
      try {
        authorize()
        const marker = await temporary(folder, '')
        temps.push(marker)
        await publishNew(marker, '.gitkeep')
        return { created: true }
      } catch (error) {
        for (const temp of temps) await cleanCreated(temp)
        try { await unchangedDirectory(folder); await rmdir(absolute) } catch { /* Preserve any unrelated new files. */ }
        throw error
      }
    })
  }

  return { readContent, saveDocument, createFolder, saveNavigation }
}
