import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, link, readdir, stat, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { resolveConfig, isFileServingAllowed } from 'vite'
import { workspaceConfigServer } from './workspace-server.mjs'

const config = name => JSON.stringify({ version: 1, workspace: { name }, roles: ['PM'], projects: [] })
async function client(root, overrides = {}) {
  let middleware
  await workspaceConfigServer().configureServer({ config: { root }, middlewares: { use(value) { middleware = value } }, ...overrides })
  return async (route, { method = 'GET', body, token, headers = {}, remoteAddress = '127.0.0.1', chunks } = {}) => {
    const raw = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
    const req = Readable.from(chunks || (raw ? [Buffer.from(raw)] : []))
    req.url = route.startsWith('/') ? route : `/__workspace-config/${route}`
    req.method = method
    req.headers = {
      host: '127.0.0.1:5173', 'x-workspace-request': '1',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers,
    }
    req.socket = { remoteAddress }
    const result = { status: null, headers: {}, body: null, passed: false }
    const res = {
      setHeader(key, value) { result.headers[key.toLowerCase()] = value },
      end(text) { result.status = this.statusCode; result.body = JSON.parse(text) },
    }
    await middleware(req, res, () => { result.passed = true })
    return result
  }
}
async function fixture(run) {
  const temp = await mkdtemp(path.join(tmpdir(), 'workspace-server-test-'))
  const root = path.join(temp, 'space')
  await mkdir(path.join(root, 'code'), { recursive: true })
  try { await run({ temp, root, filename: path.join(root, 'code/projects.local.json'), request: await client(root) }) }
  finally { await rm(temp, { recursive: true, force: true }) }
}
async function authorize(request, scope) {
  const info = await request('info')
  const result = await request('authorize', { method: 'POST', body: { approved: true, instanceId: info.body.instanceId, ...(scope ? { scope } : {}) } })
  assert.equal(result.status, 200)
  assert.match(result.body.token, /^[a-f0-9]{64}$/)
  return result.body.token
}

test('discovery reveals workspace identity and capabilities without authorizing file access', () => fixture(async ({ root, filename, request }) => {
  await writeFile(filename, config('Private workspace'))
  const info = await request('info')
  assert.deepEqual(Object.keys(info.body).sort(), ['capabilities', 'instanceId', 'name', 'path'])
  assert.equal(info.body.name, 'space')
  assert.equal(info.body.path, await realpath(root))
  assert.match(info.body.instanceId, /^[a-f0-9]{32}$/)
  assert.deepEqual(info.body.capabilities, ['content', 'navigation', 'deployment'])
  assert.equal(info.headers['cache-control'], 'no-store')
  assert.equal(info.headers['access-control-allow-origin'], undefined)
  assert.equal((await request('settings')).status, 401)
  assert.equal((await request('content')).status, 401)
  assert.equal((await request('navigation', { method: 'PUT', body: { raw: JSON.stringify({ version: 1, order: {} }), expected: null } })).status, 401)
  assert.equal((await request('settings', { method: 'PUT', body: { raw: config('Overwrite'), expected: config('Private workspace') } })).status, 401)
  assert.equal(await readFile(filename, 'utf8'), config('Private workspace'))
  assert.equal((await request('/ordinary-page')).passed, true)
}))

test('binding needs affirmative approval, sessions revoke separately and do not survive another service', () => fixture(async ({ root, request }) => {
  for (const body of [{ approved: false }, {}, { approved: 'true' }, { approved: true, path: '/tmp' }]) {
    assert.equal((await request('authorize', { method: 'POST', body })).status, 400)
  }
  const first = await authorize(request), second = await authorize(request)
  assert.notEqual(first, second)
  assert.deepEqual((await request('settings', { token: first })).body, { raw: null })
  assert.equal((await (await client(root))('settings', { token: first })).status, 401)
  assert.equal((await request('revoke', { method: 'POST', token: first })).status, 200)
  assert.equal((await request('settings', { token: first })).status, 401)
  assert.equal((await request('settings', { token: second })).status, 200)
}))

test('a restarted or replaced service cannot accept approval for the previously displayed space', () => fixture(async ({ root, request }) => {
  const info = (await request('info')).body
  const replacement = await client(root)
  assert.notEqual((await replacement('info')).body.instanceId, info.instanceId)
  assert.equal((await replacement('authorize', { method: 'POST', body: { approved: true, instanceId: info.instanceId } })).status, 409)
  assert.equal((await request('authorize', { method: 'POST', body: { approved: true } })).status, 409)
}))

test('reject nonlocal clients, foreign Host, cross Origin, cross-site metadata and preflight', () => fixture(async ({ request }) => {
  const cases = [
    { remoteAddress: '192.168.1.2' }, { remoteAddress: '::ffff:192.168.1.2' },
    { headers: { host: 'attacker.example:5173' } }, { headers: { host: '127.0.0.1@attacker.example' } },
    { headers: { host: '127.0.0.1:5173/extra' } },
    { headers: { origin: 'https://attacker.example' } }, { headers: { origin: 'http://127.0.0.1:5174' } },
    { headers: { origin: 'null' } }, { headers: { 'sec-fetch-site': 'cross-site' } },
    { headers: { 'sec-fetch-site': 'same-site' } }, { headers: { 'x-workspace-request': undefined } },
    { method: 'OPTIONS', headers: { origin: 'http://127.0.0.1:5173' } },
  ]
  for (const options of cases) {
    const response = await request('info', options)
    assert.equal(response.status, 403, JSON.stringify(options))
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.equal(response.headers['access-control-allow-origin'], undefined)
  }
  assert.equal((await request('info', { headers: { origin: 'http://127.0.0.1:5173', 'sec-fetch-site': 'same-origin' } })).status, 200)
  assert.equal((await request('info', { remoteAddress: '::ffff:127.0.0.1' })).status, 200)
  assert.equal((await request('info', { remoteAddress: '::1', headers: { host: '[::1]:5173', origin: 'http://[::1]:5173' } })).status, 200)
}))

test('authorized save creates only the fixed file, preserves raw text and detects external edits', () => fixture(async ({ root, filename, request }) => {
  const token = await authorize(request)
  const raw = `${config('First')}\n`
  const save = await request('settings', { method: 'PUT', token, body: { raw, expected: null } })
  assert.equal(save.status, 200)
  assert.deepEqual(save.body, { raw })
  assert.equal(await readFile(filename, 'utf8'), raw)
  assert.equal((await stat(filename)).mode & 0o777, 0o600)
  assert.deepEqual(await readdir(path.join(root, 'code')), ['projects.local.json'])
  await writeFile(filename, config('External edit'))
  assert.equal((await request('settings', { method: 'PUT', token, body: { raw: config('My edit'), expected: raw } })).status, 409)
  assert.equal(await readFile(filename, 'utf8'), config('External edit'))
  assert.equal((await request('settings', { method: 'PUT', token, body: { raw, expected: config('External edit'), path: '../AGENTS.md' } })).status, 400)
  assert.equal((await request('settings/../../AGENTS.md', { method: 'PUT', token, body: { raw, expected: null } })).status, 404)
}))

test('simultaneous saves with the same expected content cannot overwrite each other', () => fixture(async ({ filename, request }) => {
  const token = await authorize(request)
  const results = await Promise.all(['First', 'Second'].map(name => request('settings', { method: 'PUT', token, body: { raw: config(name), expected: null } })))
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409])
  assert.equal(await readFile(filename, 'utf8'), results.find(result => result.status === 200).body.raw)
}))

test('invalid JSON, invalid settings and wrong content type never replace a valid file', () => fixture(async ({ filename, request }) => {
  const token = await authorize(request), before = config('Original')
  await writeFile(filename, before)
  for (const raw of ['{', JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, workspace: { name: '' }, projects: [] }), JSON.stringify({ version: 1, workspace: { name: 'Test' }, roles: ['UNKNOWN'], projects: [] })]) {
    assert.equal((await request('settings', { method: 'PUT', token, body: { raw, expected: before } })).status, 400)
  }
  assert.equal((await request('settings', { method: 'PUT', token, body: '{' })).status, 400)
  assert.equal((await request('settings', { method: 'PUT', token, body: { raw: before } })).status, 400)
  assert.equal((await request('settings', { method: 'PUT', token, body: { raw: before, expected: before }, headers: { 'content-type': 'text/plain' } })).status, 415)
  assert.equal(await readFile(filename, 'utf8'), before)
}))

test('body and file size limits reject oversized content without a write', () => fixture(async ({ filename, request }) => {
  const token = await authorize(request), before = config('Original')
  await writeFile(filename, before)
  assert.equal((await request('settings', { method: 'PUT', token, body: { raw: config('x'.repeat(256 * 1024)), expected: before } })).status, 413)
  assert.equal((await request('settings', { method: 'PUT', token, headers: { 'content-type': 'application/json' }, chunks: [Buffer.alloc(2 * 1024 * 1024), Buffer.from('a')] })).status, 413)
  assert.equal(await readFile(filename, 'utf8'), before)
  await writeFile(filename, 'x'.repeat(256 * 1024 + 1))
  assert.equal((await request('settings', { token })).status, 413)
}))

test('reject symlinked directories, file symlinks, hardlinks and non-file targets', () => fixture(async ({ temp, root, filename, request }) => {
  const token = await authorize(request)
  const outside = path.join(temp, 'outside')
  await mkdir(outside)
  const target = path.join(outside, 'projects.local.json')
  await writeFile(target, config('Outside'))
  const check = async () => {
    assert.equal((await request('settings', { token })).status, 409)
    assert.equal((await request('settings', { method: 'PUT', token, body: { raw: config('Changed'), expected: config('Outside') } })).status, 409)
    assert.equal(await readFile(target, 'utf8'), config('Outside'))
  }
  await rm(path.join(root, 'code'), { recursive: true })
  await symlink(outside, path.join(root, 'code'), 'dir')
  await check()
  await rm(path.join(root, 'code'))
  await mkdir(path.join(root, 'code'))
  await symlink(target, filename)
  await check()
  await rm(filename)
  await link(target, filename)
  await check()
  await rm(filename)
  await mkdir(filename)
  await check()
}))

test('first save initializes a missing code directory', () => fixture(async ({ root, filename, request }) => {
  await rm(path.join(root, 'code'), { recursive: true })
  const token = await authorize(request)
  assert.deepEqual((await request('settings', { token })).body, { raw: null })
  assert.equal((await request('settings', { method: 'PUT', token, body: { raw: config('New'), expected: null } })).status, 200)
  assert.equal(await readFile(filename, 'utf8'), config('New'))
}))

test('Vite build excludes the dev-only plugin; preview has no service hook', async () => {
  const plugin = workspaceConfigServer()
  const build = await resolveConfig({ configFile: false, plugins: [plugin] }, 'build')
  assert.equal(build.plugins.some(entry => entry.name === plugin.name), false)
  assert.equal(plugin.configurePreviewServer, undefined)
})

test('Vite cannot serve personal configuration directly, retaining default and user deny patterns', async () => {
  const root = process.cwd()
  const resolved = await resolveConfig({ configFile: false, root, plugins: [workspaceConfigServer()], server: { fs: { strict: false, deny: ['**/custom-private.txt'] } } }, 'serve')
  for (const file of ['code/projects.local.json', 'code/deploy.local.json', 'code/.deploy.local.123.tmp', '.env', '.env.local', 'server.pem', '.git/config', 'custom-private.txt']) {
    assert.equal(isFileServingAllowed(resolved, path.join(root, file)), false, file)
  }
  assert.equal(isFileServingAllowed(resolved, path.join(root, 'code/projects.example.json')), true)
  for (const query of ['', '?raw', '?import', '?url']) {
    for (const name of ['projects.local.json', 'deploy.local.json']) assert.equal(isFileServingAllowed(resolved, `/@fs/${path.join(root, 'code', name)}${query}`), false)
  }
  assert.ok(resolved.server.watch.ignored.includes('**/code/projects.local.json'))
  assert.ok(resolved.server.watch.ignored.includes('**/code/.projects.local.*.tmp'))
  assert.ok(resolved.server.watch.ignored.includes('**/code/deploy.local.json'))
})

test('deployment has independent authorization and never implicitly starts jobs', () => fixture(async ({ request, root }) => {
  for (const route of ['deployment/config', 'deployment/jobs', 'deployment/host-key']) assert.equal((await request(route)).status, 401)
  const settings = await authorize(request), content = await authorize(request, 'content'), deploy = await authorize(request, 'deploy')
  for (const token of [settings, content]) for (const route of ['deployment/config', 'deployment/jobs', 'deployment/host-key']) assert.equal((await request(route, { token })).status, 403)
  for (const route of ['settings', 'content']) assert.equal((await request(route, { token: deploy })).status, 403)
  const config = await request('deployment/config', { token: deploy })
  assert.equal(config.status, 200); assert.equal(config.body.raw, null); assert.equal(config.body.config.hostKey, null)
  assert.deepEqual((await request('deployment/jobs', { token: deploy })).body, { job: null })
  assert.deepEqual(await readdir(path.join(root, 'code')), [])
  assert.equal((await request('deployment/jobs', { token: deploy, method: 'POST', body: { action: 'publish', password: '', expected: null } })).status, 409)
  await request('revoke', { token: deploy, method: 'POST' })
  assert.equal((await request('deployment/config', { token: deploy })).status, 401)
  assert.equal((await request('settings', { token: settings })).status, 200)
}))

test('content and settings authorizations have separate scopes and revocation', () => fixture(async ({ root }) => {
  await mkdir(path.join(root, 'src/content'), { recursive: true })
  const request = await client(root)
  const settingsToken = await authorize(request)
  const contentToken = await authorize(request, 'content')
  for (const route of ['content', 'document', 'folder', 'navigation']) {
    assert.equal((await request(route, { token: settingsToken, method: route === 'content' ? 'GET' : route === 'folder' ? 'POST' : 'PUT', body: route === 'content' ? undefined : {} })).status, 403)
  }
  assert.equal((await request('settings', { token: contentToken })).status, 403)
  assert.equal((await request('settings', { token: contentToken, method: 'PUT', body: {} })).status, 403)
  assert.deepEqual((await request('content', { token: contentToken })).body, { files: {}, folders: [], navigationRaw: null })
  assert.equal((await request('revoke', { token: contentToken, method: 'POST' })).status, 200)
  assert.equal((await request('content', { token: contentToken })).status, 401)
  assert.equal((await request('settings', { token: settingsToken })).status, 200)
}))

test('document route invokes the shared knowledge validator and rejects invalid content before writing', () => fixture(async ({ root }) => {
  await mkdir(path.join(root, 'src/content'), { recursive: true })
  let validations = 0
  const request = await client(root, { async ssrLoadModule(module) {
    assert.equal(module, '/src/lib/content.ts')
    return { buildKnowledge(files) {
      validations++
      if (Object.values(files).includes('invalid')) throw new Error('duplicate slug')
    } }
  } })
  const token = await authorize(request, 'content')
  assert.equal((await request('document', { token, method: 'PUT', body: { path: 'note.md', raw: 'invalid', expected: null, assets: [] } })).status, 400)
  assert.deepEqual(await readdir(path.join(root, 'src/content')), [])
  assert.equal((await request('document', { token, method: 'PUT', body: { path: 'note.md', raw: '## Test', expected: null, assets: [] } })).status, 200)
  assert.equal(await readFile(path.join(root, 'src/content/note.md'), 'utf8'), '## Test')
  assert.ok(validations >= 2)
  assert.equal((await request('folder', { token, method: 'POST', body: { parent: '', name: 'New folder' } })).status, 200)
  assert.equal(await readFile(path.join(root, 'src/content/New folder/.gitkeep'), 'utf8'), '')
  assert.equal((await request('document', { token, method: 'PUT', body: {}, headers: { 'content-length': String(64 * 1024 * 1024 + 1) } })).status, 413)
}))

test('new media keeps Vite file discovery while its HMR cannot discard editor drafts', () => {
  const plugin = workspaceConfigServer()
  const media = '/workspace/public/media/12345678-1234-4234-8234-123456789abc.png'
  assert.deepEqual(plugin.hotUpdate.handler({ file: media }), [])
  assert.equal(plugin.hotUpdate.handler({ file: '/workspace/src/content/notes.md' }), undefined)
  assert.equal(plugin.hotUpdate.handler({ file: '/workspace/public/logo.png' }), undefined)
  assert.equal(plugin.config().server.watch.ignored.some(pattern => pattern.includes('public')), false)
})

test('navigation uses content authorization, persists on disk and rejects stale writes', () => fixture(async ({ root }) => {
  const content = path.join(root, 'src/content')
  await mkdir(content, { recursive: true })
  await writeFile(path.join(content, 'one.md'), '## One')
  await writeFile(path.join(content, 'two.md'), '## Two')
  const request = await client(root)
  const token = await authorize(request, 'content')
  const raw = JSON.stringify({ version: 1, order: { '': ['two.md', 'one.md'] } })
  assert.deepEqual((await request('navigation', { token, method: 'PUT', body: { raw, expected: null } })).body, { raw })
  assert.equal(await readFile(path.join(content, '.navigation.json'), 'utf8'), raw)
  assert.equal((await request('content', { token })).body.navigationRaw, raw)
  assert.equal((await request('navigation', { token, method: 'PUT', body: { raw, expected: null } })).status, 409)
  assert.equal((await request('navigation', { token, method: 'PUT', body: { raw: '{', expected: raw } })).status, 400)
  await request('revoke', { token, method: 'POST' })
  assert.equal((await request('navigation', { token, method: 'PUT', body: { raw, expected: raw } })).status, 401)
}))
