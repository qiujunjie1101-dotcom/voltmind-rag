import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, rename, unlink } from 'node:fs/promises'
import { isIP } from 'node:net'
import path from 'node:path'
import { validateConfig } from '../harness/config.mjs'
import { ContentError, createContentStore } from './workspace-content.mjs'
import { DeploymentError, createDeploymentManager } from './workspace-deploy.mjs'

const BASE = '/__workspace-config'
const MAX_CONFIG_BYTES = 256 * 1024
const MAX_BODY_BYTES = 2 * 1024 * 1024
const generatedMedia = /[/\\]public[/\\]media[/\\][a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}\.(png|jpe?g|webp|gif|avif|mp4|webm|ogv|mov)$/i
class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status }
}
const fail = (status, message) => { throw new RequestError(status, message) }
const missing = error => error?.code === 'ENOENT'
const sameFile = (first, second) => first.dev === second.dev && first.ino === second.ino

function isLoopback(address) {
  const value = address?.replace(/^::ffff:/i, '')
  return value === '::1' || (isIP(value || '') === 4 && value.startsWith('127.'))
}

function guardRequest(req) {
  if (!isLoopback(req.socket.remoteAddress)) fail(403, '配置服务仅允许本机访问。')
  const host = req.headers.host
  if (!host || /[\s/@\\?#]/.test(host)) fail(403, '无效的本机服务地址。')
  let origin
  try { origin = new URL(`${req.socket.encrypted ? 'https' : 'http'}://${host}`) }
  catch { fail(403, '无效的本机服务地址。') }
  const hostname = origin.hostname.replace(/^\[|\]$/g, '')
  if (hostname !== 'localhost' && !isLoopback(hostname)) fail(403, '配置服务仅允许本机地址。')
  if (req.headers.origin && req.headers.origin !== origin.origin) fail(403, '不允许跨来源访问本地配置。')
  if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) fail(403, '不允许跨站访问本地配置。')
  if (req.method === 'OPTIONS' || req.headers['x-workspace-request'] !== '1') fail(403, '请从当前空间配置页面发起请求。')
}

async function readBody(req, maxBytes = MAX_BODY_BYTES) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) fail(415, '请求必须使用 JSON 格式。')
  if (Number(req.headers['content-length']) > maxBytes) fail(413, '请求内容过大。')
  let bytes = 0
  const chunks = []
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > maxBytes) fail(413, '请求内容过大。')
    chunks.push(buffer)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '请求必须为 JSON 对象。')
    return body
  } catch (error) {
    if (error instanceof RequestError) throw error
    fail(400, '请求 JSON 无法解析。')
  }
}

function respond(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function createMiddleware(root, validateKnowledge) {
  const workspaceRoot = await realpath(root)
  const workspaceInfo = await lstat(workspaceRoot)
  const directory = path.join(workspaceRoot, 'code')
  const filename = path.join(directory, 'projects.local.json')
  const instanceId = randomBytes(16).toString('hex')
  const tokens = new Map()
  const content = await createContentStore(workspaceRoot, { validateKnowledge })
  const deployment = await createDeploymentManager(workspaceRoot)
  let pendingWrite = Promise.resolve()

  async function inspectDirectory(create = false) {
    // Never follow a replaced workspace root or a symlinked code directory.
    if (await realpath(workspaceRoot) !== workspaceRoot || !sameFile(workspaceInfo, await lstat(workspaceRoot))) fail(409, '空间目录已变化，请重新启动本地服务。')
    if (create) {
      try { await mkdir(directory) } catch (error) { if (error.code !== 'EEXIST') throw error }
    }
    let info
    try { info = await lstat(directory) } catch (error) { if (missing(error)) return null; throw error }
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) fail(409, 'code 必须是当前空间内的真实目录。')
    return info
  }

  async function readSettings() {
    const directoryInfo = await inspectDirectory()
    if (!directoryInfo) return null
    let info
    try { info = await lstat(filename) } catch (error) { if (missing(error)) return null; throw error }
    if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1) fail(409, '本地配置必须为独立的普通文件，不能使用链接。')
    if (info.size > MAX_CONFIG_BYTES) fail(413, '本地配置文件过大。')
    const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW)
    try {
      const opened = await handle.stat()
      if (!opened.isFile() || opened.nlink !== 1 || !sameFile(info, opened)) fail(409, '本地配置已变化，请重新读取。')
      // A bounded read also protects against files growing after stat().
      const buffer = Buffer.alloc(MAX_CONFIG_BYTES + 1)
      let bytes = 0
      while (bytes < buffer.length) {
        const result = await handle.read(buffer, bytes, buffer.length - bytes, bytes)
        if (!result.bytesRead) break
        bytes += result.bytesRead
      }
      if (bytes > MAX_CONFIG_BYTES) fail(413, '本地配置文件过大。')
      const after = await inspectDirectory()
      if (!after || !sameFile(directoryInfo, after)) fail(409, '配置目录已变化，请重新读取。')
      return buffer.subarray(0, bytes).toString('utf8')
    } finally { await handle.close() }
  }

  async function saveSettings(raw, expected, token) {
    if (!tokens.has(token)) fail(401, '空间授权已失效，请重新授权绑定。')
    if (await readSettings() !== expected) fail(409, '本地配置已被其他窗口或程序修改，请重新读取后保存。')
    const directoryInfo = await inspectDirectory(true)
    const temporary = path.join(directory, `.projects.local.${randomBytes(16).toString('hex')}.tmp`)
    let created = false
    try {
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
      created = true
      try { await handle.writeFile(raw, 'utf8'); await handle.sync() } finally { await handle.close() }
      const after = await inspectDirectory()
      if (!after || !sameFile(directoryInfo, after)) fail(409, '配置目录已变化，请重新读取。')
      if (await readSettings() !== expected) fail(409, '本地配置已被其他窗口或程序修改，请重新读取后保存。')
      if (!tokens.has(token)) fail(401, '空间授权已失效，请重新授权绑定。')
      await rename(temporary, filename)
      created = false
      return { raw }
    } finally {
      if (created) {
        // Only remove our temporary file if its original directory still exists.
        const current = await inspectDirectory().catch(() => null)
        if (current && sameFile(directoryInfo, current)) await unlink(temporary).catch(() => {})
      }
    }
  }

  return async (req, res, next) => {
    const route = (req.url || '').split('?')[0]
    if (route !== BASE && !route.startsWith(`${BASE}/`)) return next()
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    try {
      guardRequest(req)
      if (route === `${BASE}/info` && req.method === 'GET') return respond(res, 200, { name: path.basename(workspaceRoot), path: workspaceRoot, instanceId, capabilities: ['content', 'navigation', 'deployment'] })
      if (route === `${BASE}/authorize` && req.method === 'POST') {
        const body = await readBody(req)
        if (body.approved !== true || (body.scope !== undefined && !['content', 'deploy'].includes(body.scope)) || Object.keys(body).some(key => !['approved', 'instanceId', 'scope'].includes(key))) fail(400, '请先确认授权绑定此空间。')
        if (body.instanceId !== instanceId) fail(409, '本地服务或空间已变化，请重新打开授权窗口并确认。')
        const token = randomBytes(32).toString('hex')
        tokens.set(token, body.scope || 'settings')
        return respond(res, 200, { token })
      }
      const token = req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/)?.[1]
      if (!token || !tokens.has(token)) fail(401, '请先授权绑定当前空间。')
      if (route === `${BASE}/revoke` && req.method === 'POST') {
        tokens.delete(token)
        return respond(res, 200, { revoked: true })
      }
      const requireScope = scope => {
        if (!tokens.has(token)) fail(401, '空间授权已失效，请重新授权绑定。')
        if (tokens.get(token) !== scope) fail(403, '当前授权不包含此操作，请为对应功能单独授权。')
      }
      if (route.startsWith(`${BASE}/deployment/`)) {
        requireScope('deploy')
        if (route === `${BASE}/deployment/config` && req.method === 'GET') return respond(res, 200, await deployment.load())
        if (route === `${BASE}/deployment/config` && req.method === 'PUT') return respond(res, 200, await deployment.save(await readBody(req, 128 * 1024), () => requireScope('deploy')))
        if (route === `${BASE}/deployment/host-key` && req.method === 'POST') return respond(res, 200, { keys: await deployment.scan(await readBody(req, 4096)) })
        if (route === `${BASE}/deployment/jobs` && req.method === 'GET') return respond(res, 200, { job: deployment.status() })
        if (route === `${BASE}/deployment/jobs` && req.method === 'POST') return respond(res, 202, { job: await deployment.start(await readBody(req, 128 * 1024), () => requireScope('deploy')) })
      }
      if (route === `${BASE}/content` && req.method === 'GET') {
        requireScope('content')
        const result = await content.readContent()
        requireScope('content')
        return respond(res, 200, result)
      }
      if (route === `${BASE}/document` && req.method === 'PUT') {
        requireScope('content')
        const body = await readBody(req, 64 * 1024 * 1024)
        return respond(res, 200, await content.saveDocument(body, () => requireScope('content')))
      }
      if (route === `${BASE}/folder` && req.method === 'POST') {
        requireScope('content')
        return respond(res, 200, await content.createFolder(await readBody(req), () => requireScope('content')))
      }
      if (route === `${BASE}/navigation` && req.method === 'PUT') {
        requireScope('content')
        return respond(res, 200, await content.saveNavigation(await readBody(req), () => requireScope('content')))
      }
      if (route === `${BASE}/settings`) requireScope('settings')
      if (route === `${BASE}/settings` && req.method === 'GET') return respond(res, 200, { raw: await readSettings() })
      if (route === `${BASE}/settings` && req.method === 'PUT') {
        const body = await readBody(req)
        if (typeof body.raw !== 'string' || !(body.expected === null || typeof body.expected === 'string') || Object.keys(body).some(key => !['raw', 'expected'].includes(key))) fail(400, '保存请求必须包含配置内容和上次读取的原文。')
        if (Buffer.byteLength(body.raw) > MAX_CONFIG_BYTES || (body.expected !== null && Buffer.byteLength(body.expected) > MAX_CONFIG_BYTES)) fail(413, '本地配置文件过大。')
        try { validateConfig(JSON.parse(body.raw)) } catch (error) { fail(400, `配置格式无效：${error.message}`) }
        const operation = pendingWrite.then(() => saveSettings(body.raw, body.expected, token))
        pendingWrite = operation.catch(() => {})
        return respond(res, 200, await operation)
      }
      fail(404, '配置服务没有此接口。')
    } catch (error) {
      if (error instanceof RequestError || error instanceof ContentError || error instanceof DeploymentError) respond(res, error.status, { error: error.message })
      else respond(res, 500, { error: '无法访问本地文件，请检查文件权限后重试。' })
    }
  }
}

// configureServer is only used by Vite development; neither build nor preview
// registers this middleware or places local configuration in static assets.
export function workspaceConfigServer() {
  return {
    name: 'workspace-local-config',
    apply: 'serve',
    config() {
      // Supplying fs.deny replaces Vite's defaults, so retain those defaults.
      // Otherwise its ordinary file server could bypass our authorization.
      return { server: {
        fs: { strict: true, deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/projects.local.json', '**/deploy.local.json', '**/.deploy.local.*.tmp'] },
        watch: { ignored: [
          '**/code/projects.local.json', '**/code/.projects.local.*.tmp', '**/.workspace-content-*.tmp',
          '**/code/deploy.local.json', '**/code/.deploy.local.*.tmp',
        ] },
      } }
    },
    // Keep public-file watcher events so Vite can serve newly saved media.
    // Only suppress their HMR propagation, which can otherwise discard drafts.
    hotUpdate: { order: 'post', handler({ file }) { if (generatedMedia.test(file)) return [] } },
    async configureServer(server) {
      server.middlewares.use(await createMiddleware(server.config.root, async (files, folders) => {
        if (typeof server.ssrLoadModule !== 'function') throw new Error('文档校验服务不可用，请重新启动开发服务。')
        const { buildKnowledge } = await server.ssrLoadModule('/src/lib/content.ts')
        buildKnowledge(files, folders)
      }))
    },
  }
}
