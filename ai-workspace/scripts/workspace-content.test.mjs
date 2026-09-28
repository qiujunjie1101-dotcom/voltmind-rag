import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { link, lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createContentStore } from './workspace-content.mjs'

const MiB = 1024 * 1024
const document = (slug, body = '## 内容\n') => `---\ntitle: 测试文档\nslug: ${slug}\ndescription: 内容存储测试\ndate: "2026-09-18"\nstatus: 草稿\n---\n${body}`
const asset = (extension = 'png', type = 'image/png', data = Buffer.from('media fixture')) => ({ name: `${randomUUID()}.${extension}`, type, data: data.toString('base64') })
const withMedia = (slug, assets) => document(slug, assets.map(item => `![媒体](./media/${item.name})`).join('\n'))
const status = value => error => { assert.equal(error.status, value, error.message); return true }

function validateKnowledge(files) {
  const slugs = Object.entries(files).map(([filename, raw]) => raw.match(/^slug:\s*(.+)$/m)?.[1] || filename)
  if (new Set(slugs).size !== slugs.length) throw new Error('文档 slug 重复')
}

async function fixture(run, validate = validateKnowledge) {
  const temp = await mkdtemp(path.join(tmpdir(), 'workspace-content-test-'))
  const root = path.join(temp, 'space')
  const content = path.join(root, 'src/content')
  const media = path.join(root, 'public/media')
  await mkdir(content, { recursive: true })
  await mkdir(media, { recursive: true })
  try {
    await run({ temp, root, content, media, store: await createContentStore(root, { validateKnowledge: validate }) })
  } finally { await rm(temp, { recursive: true, force: true }) }
}

async function absent(filename) { await assert.rejects(lstat(filename), { code: 'ENOENT' }) }

test('readContent returns nested Markdown and empty folders without hidden or non-Markdown files', () => fixture(async ({ content, store }) => {
  await mkdir(path.join(content, '产品/空目录'), { recursive: true })
  await mkdir(path.join(content, '.private'))
  const raw = document('intro')
  await writeFile(path.join(content, '产品/介绍.md'), raw)
  await writeFile(path.join(content, '产品/空目录/.gitkeep'), '')
  await writeFile(path.join(content, '产品/notes.txt'), 'not a document')
  await writeFile(path.join(content, '.private/secret.md'), 'hidden')
  await writeFile(path.join(content, '.draft.md'), 'hidden')
  const snapshot = await store.readContent()
  assert.deepEqual({ ...snapshot.files }, { '产品/介绍.md': raw })
  assert.deepEqual([...snapshot.folders].sort(), ['产品', '产品/空目录'])
}))

test('save creates and updates a document only when its expected content matches', () => fixture(async ({ content, store }) => {
  const first = document('first'), updated = document('first', '## 更新\n')
  const filename = path.join(content, '文档.md')
  await store.saveDocument({ path: '文档.md', raw: first, expected: null, assets: [] })
  assert.equal(await readFile(filename, 'utf8'), first)
  await assert.rejects(store.saveDocument({ path: '文档.md', raw: updated, expected: null, assets: [] }), status(409))
  await store.saveDocument({ path: '文档.md', raw: updated, expected: first, assets: [] })
  assert.equal(await readFile(filename, 'utf8'), updated)
  await assert.rejects(store.saveDocument({ path: '不存在.md', raw: first, expected: first, assets: [] }), status(409))
  await absent(path.join(content, '不存在.md'))
  assert.deepEqual(await readdir(content), ['文档.md'])
}))

test('external edits and simultaneous saves cannot silently overwrite newer content', () => fixture(async ({ content, store }) => {
  const filename = path.join(content, '文档.md')
  const before = document('before'), external = document('external')
  await writeFile(filename, external)
  await assert.rejects(store.saveDocument({ path: '文档.md', raw: document('mine'), expected: before, assets: [] }), status(409))
  assert.equal(await readFile(filename, 'utf8'), external)
  const results = await Promise.allSettled(['one', 'two'].map(slug => store.saveDocument({ path: '文档.md', raw: document(slug), expected: external, assets: [] })))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
  assert.ok([document('one'), document('two')].includes(await readFile(filename, 'utf8')))
}))

test('invalid document paths and malformed save payloads are rejected without writes', () => fixture(async ({ content, store }) => {
  const raw = document('invalid')
  for (const filename of ['../escape.md', '/escape.md', 'a/../../escape.md', 'a\\escape.md', 'a//escape.md', './escape.md', 'a/./escape.md', 'a/../escape.md', '.private/secret.md', 'notes.txt', 'bad\0.md', '']) {
    await assert.rejects(store.saveDocument({ path: filename, raw, expected: null, assets: [] }), status(400), filename)
  }
  for (const body of [
    { path: 'test.md', raw, assets: [] },
    { path: 'test.md', raw: 42, expected: null, assets: [] },
    { path: 'test.md', raw, expected: false, assets: [] },
    { path: 'test.md', raw, expected: null, assets: {} },
    { path: 'test.md', raw, expected: null, assets: [], other: 'value' },
  ]) await assert.rejects(store.saveDocument(body), status(400))
  assert.deepEqual(await readdir(content), [])
}))

test('document limits apply to UTF-8 bytes, expected content, and disk reads', () => fixture(async ({ content, store }) => {
  const raw = '汉'.repeat(Math.floor(2 * MiB / 3) + 1)
  await assert.rejects(store.saveDocument({ path: 'big.md', raw, expected: null, assets: [] }), status(413))
  await assert.rejects(store.saveDocument({ path: 'big.md', raw: document('small'), expected: raw, assets: [] }), status(413))
  await absent(path.join(content, 'big.md'))
  await writeFile(path.join(content, 'big.md'), raw)
  await assert.rejects(store.readContent(), status(413))
}))

test('symlinked src, content, and nested parent directories cannot redirect reads or writes', async () => {
  for (const target of ['src', 'src/content', 'src/content/nested']) await fixture(async ({ temp, root, content, store }) => {
    const outside = path.join(temp, 'outside')
    await mkdir(outside)
    const raw = document('outside')
    await writeFile(path.join(outside, 'outside.md'), raw)
    const entry = path.join(root, target)
    await rm(entry, { recursive: true, force: true })
    await symlink(outside, entry, 'dir')
    const filename = target.endsWith('nested') ? 'nested/outside.md' : 'outside.md'
    await assert.rejects(store.readContent(), status(409), target)
    await assert.rejects(store.saveDocument({ path: filename, raw: document('changed'), expected: raw, assets: [] }), status(409), target)
    assert.equal(await readFile(path.join(outside, 'outside.md'), 'utf8'), raw)
    if (target.endsWith('nested')) assert.deepEqual(await readdir(content), ['nested'])
  })
})

test('Markdown symlinks, hardlinks, and directory targets are rejected without altering their targets', async () => {
  for (const kind of ['symlink', 'hardlink', 'directory']) await fixture(async ({ temp, content, store }) => {
    const outside = path.join(temp, 'outside.md'), filename = path.join(content, 'target.md'), raw = document('outside')
    await writeFile(outside, raw)
    if (kind === 'symlink') await symlink(outside, filename)
    else if (kind === 'hardlink') await link(outside, filename)
    else await mkdir(filename)
    await assert.rejects(store.saveDocument({ path: 'target.md', raw: document('replacement'), expected: raw, assets: [] }), status(409), kind)
    if (kind !== 'directory') await assert.rejects(store.readContent(), status(409), kind)
    assert.equal(await readFile(outside, 'utf8'), raw)
  })
})

test('referenced media is saved byte-for-byte with the document', () => fixture(async ({ content, media, store }) => {
  const formats = [['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp'], ['gif', 'image/gif'], ['avif', 'image/avif'], ['mp4', 'video/mp4'], ['webm', 'video/webm'], ['ogv', 'video/ogg'], ['mov', 'video/quicktime']]
  const assets = formats.map(([extension, type]) => asset(extension, type))
  const raw = withMedia('media', assets)
  await store.saveDocument({ path: 'media.md', raw, expected: null, assets })
  assert.equal(await readFile(path.join(content, 'media.md'), 'utf8'), raw)
  for (const item of assets) assert.deepEqual(await readFile(path.join(media, item.name)), Buffer.from(item.data, 'base64'))
}))

test('files without browser MIME metadata retain the supported filename format', () => fixture(async ({ media, store }) => {
  const item = asset('png', '')
  await store.saveDocument({ path: 'media.md', raw: withMedia('media', [item]), expected: null, assets: [item] })
  assert.deepEqual(await readFile(path.join(media, item.name)), Buffer.from(item.data, 'base64'))
}))

test('media UUID, extension, MIME, and canonical base64 are validated before writing', () => fixture(async ({ content, media, store }) => {
  const valid = asset()
  const invalidAssets = [
    { ...valid, name: 'plain-name.png' },
    { ...valid, name: `../${valid.name}` },
    { ...valid, name: `${randomUUID()}.svg`, type: 'image/svg+xml' },
    { ...valid, type: 'text/html' },
    { ...valid, type: 'image/jpeg' },
    { ...valid, data: '%%%invalid%%%' },
    { ...valid, data: 'a' },
    { ...valid, data: 'aA==\n' },
    { ...valid, data: 'aB==' },
    { ...valid, data: '' },
    { ...valid, data: 123 },
    { ...valid, extra: 'unexpected' },
  ]
  for (const item of invalidAssets) await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('media', [item]), expected: null, assets: [item] }), status(400))
  await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('media', [valid]), expected: null, assets: [valid, valid] }), status(400))
  assert.deepEqual(await readdir(content), [])
  assert.deepEqual(await readdir(media), [])
}))

test('individual and combined media limits reject oversized uploads before persistence', () => fixture(async ({ content, media, store }) => {
  const large = asset('png', 'image/png', Buffer.alloc(20 * MiB + 1))
  await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('media', [large]), expected: null, assets: [large] }), status(413))
  const data = Buffer.alloc(14 * MiB).toString('base64')
  const assets = Array.from({ length: 3 }, () => ({ name: `${randomUUID()}.png`, type: 'image/png', data }))
  await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('media', assets), expected: null, assets }), status(413))
  assert.deepEqual(await readdir(content), [])
  assert.deepEqual(await readdir(media), [])
}))

test('media exactly at the individual and total limits remains saveable', () => fixture(async ({ content, media, store }) => {
  const data = Buffer.alloc(20 * MiB).toString('base64')
  const assets = Array.from({ length: 2 }, () => ({ name: `${randomUUID()}.png`, type: 'image/png', data }))
  const raw = withMedia('media-limits', assets)
  await store.saveDocument({ path: 'media.md', raw, expected: null, assets })
  assert.equal(await readFile(path.join(content, 'media.md'), 'utf8'), raw)
  for (const item of assets) assert.equal((await lstat(path.join(media, item.name))).size, 20 * MiB)
}))

test('media filename collisions roll back new assets while preserving existing files and document', () => fixture(async ({ content, media, store }) => {
  const created = asset(), collision = asset(), original = Buffer.from('existing media'), before = document('before')
  await writeFile(path.join(media, collision.name), original)
  await writeFile(path.join(content, 'media.md'), before)
  await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('after', [created, collision]), expected: before, assets: [created, collision] }), status(409))
  assert.deepEqual(await readdir(media), [collision.name])
  assert.deepEqual(await readFile(path.join(media, collision.name)), original)
  assert.equal(await readFile(path.join(content, 'media.md'), 'utf8'), before)
  assert.deepEqual(await readdir(content), ['media.md'])
}))

test('symlinked public or media directories cannot redirect asset writes', async () => {
  for (const directory of ['public', 'public/media']) await fixture(async ({ temp, root, content, store }) => {
    const outside = path.join(temp, 'outside')
    await mkdir(outside)
    const destination = path.join(root, directory)
    await rm(destination, { recursive: true })
    await symlink(outside, destination, 'dir')
    const item = asset()
    await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('media', [item]), expected: null, assets: [item] }), status(409))
    assert.deepEqual(await readdir(outside), [])
    assert.deepEqual(await readdir(content), [])
  })
})

test('existing linked media is never overwritten or removed on failure', async () => {
  for (const kind of ['symlink', 'hardlink']) await fixture(async ({ temp, content, media, store }) => {
    const item = asset(), outside = path.join(temp, 'outside.png'), original = Buffer.from('external media')
    await writeFile(outside, original)
    if (kind === 'symlink') await symlink(outside, path.join(media, item.name))
    else await link(outside, path.join(media, item.name))
    await assert.rejects(store.saveDocument({ path: 'media.md', raw: withMedia('media', [item]), expected: null, assets: [item] }), status(409))
    assert.deepEqual(await readFile(outside), original)
    assert.deepEqual(await readdir(media), [item.name])
    assert.deepEqual(await readdir(content), [])
  })
})

test('async knowledge validation sees all files and prevents duplicate slug or invalid document writes', () => {
  let observed
  return fixture(async ({ content, media, store }) => {
    await mkdir(path.join(content, '空目录'))
    const before = document('same'), item = asset()
    await writeFile(path.join(content, 'existing.md'), before)
    await assert.rejects(store.saveDocument({ path: 'new.md', raw: withMedia('same', [item]), expected: null, assets: [item] }), status(400))
    assert.deepEqual(Object.keys(observed.files).sort(), ['existing.md', 'new.md'])
    assert.ok(observed.folders.includes('空目录'))
    assert.equal(await readFile(path.join(content, 'existing.md'), 'utf8'), before)
    await absent(path.join(content, 'new.md'))
    assert.deepEqual(await readdir(media), [])
  }, async (files, folders) => {
    await Promise.resolve()
    observed = { files, folders }
    validateKnowledge(files)
  })
})

test('an external write during async validation wins over the pending save', () => {
  let filename
  const external = document('external')
  return fixture(async ({ content, media, store }) => {
    filename = path.join(content, 'document.md')
    const before = document('before'), item = asset()
    await writeFile(filename, before)
    await assert.rejects(store.saveDocument({ path: 'document.md', raw: withMedia('mine', [item]), expected: before, assets: [item] }), status(409))
    assert.equal(await readFile(filename, 'utf8'), external)
    assert.deepEqual(await readdir(media), [])
    assert.deepEqual(await readdir(content), ['document.md'])
  }, async () => { await writeFile(filename, external) })
})

test('createFolder creates its marker and refuses existing or unsafe destinations', () => fixture(async ({ content, store }) => {
  await store.createFolder({ parent: '', name: '产品' })
  await store.createFolder({ parent: '产品', name: '空目录' })
  assert.equal(await readFile(path.join(content, '产品/.gitkeep'), 'utf8'), '')
  assert.equal(await readFile(path.join(content, '产品/空目录/.gitkeep'), 'utf8'), '')
  await assert.rejects(store.createFolder({ parent: '产品', name: '空目录' }), status(409))
  for (const body of [{ parent: '../', name: 'escape' }, { parent: '', name: '../escape' }, { parent: '', name: '.hidden' }, { parent: '', name: '' }, { parent: '', name: '目录', unexpected: true }]) {
    await assert.rejects(store.createFolder(body), status(400))
  }
  const snapshot = await store.readContent()
  assert.deepEqual(Object.keys(snapshot.files), [])
  assert.deepEqual([...snapshot.folders].sort(), ['产品', '产品/空目录'])
}))

test('createFolder refuses a symlinked parent and concurrent duplicate creation', () => fixture(async ({ temp, content, store }) => {
  const outside = path.join(temp, 'outside')
  await mkdir(outside)
  await symlink(outside, path.join(content, 'linked'), 'dir')
  await assert.rejects(store.createFolder({ parent: 'linked', name: 'escape' }), status(409))
  assert.deepEqual(await readdir(outside), [])
  await rm(path.join(content, 'linked'))
  const results = await Promise.allSettled([store.createFolder({ parent: '', name: '目录' }), store.createFolder({ parent: '', name: '目录' })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
  assert.deepEqual(await readdir(path.join(content, '目录')), ['.gitkeep'])
}))

test('failed authorization cannot write documents, media, or folders', () => fixture(async ({ content, media, store }) => {
  const rejected = () => { const error = new Error('授权已失效'); error.status = 401; throw error }
  const item = asset()
  await assert.rejects(store.saveDocument({ path: 'doc.md', raw: withMedia('doc', [item]), expected: null, assets: [item] }, rejected), status(401))
  await assert.rejects(store.createFolder({ parent: '', name: '目录' }, rejected), status(401))
  assert.deepEqual(await readdir(content), [])
  assert.deepEqual(await readdir(media), [])
}))

test('authorization revoked while validation is pending prevents persistence', () => {
  let authorized = true
  return fixture(async ({ content, media, store }) => {
    const item = asset()
    const check = () => { if (!authorized) { const error = new Error('授权已撤销'); error.status = 401; throw error } }
    await assert.rejects(store.saveDocument({ path: 'doc.md', raw: withMedia('doc', [item]), expected: null, assets: [item] }, check), status(401))
    assert.deepEqual(await readdir(content), [])
    assert.deepEqual(await readdir(media), [])
  }, async () => { await Promise.resolve(); authorized = false })
})

test('revocation during folder creation removes only the new empty directory', () => fixture(async ({ content, store }) => {
  let checks = 0
  const check = () => {
    if (++checks === 2) { const error = new Error('授权已撤销'); error.status = 401; throw error }
  }
  await assert.rejects(store.createFolder({ parent: '', name: '未完成目录' }, check), status(401))
  assert.deepEqual(await readdir(content), [])
}))

test('folder rollback preserves a file another program creates in that new directory', () => fixture(async ({ content, store }) => {
  let checks = 0
  const filename = path.join(content, '共享目录/external.md'), raw = document('external')
  const check = () => {
    if (++checks === 2) {
      writeFileSync(filename, raw)
      const error = new Error('授权已撤销'); error.status = 401; throw error
    }
  }
  await assert.rejects(store.createFolder({ parent: '', name: '共享目录' }, check), status(401))
  assert.equal(await readFile(filename, 'utf8'), raw)
  assert.deepEqual(await readdir(path.join(content, '共享目录')), ['external.md'])
}))

const navigation = order => JSON.stringify({ version: 1, order })

test('readContent exposes absent navigation metadata separately from documents', () => fixture(async ({ content, store }) => {
  const raw = document('intro')
  await writeFile(path.join(content, 'intro.md'), raw)
  const snapshot = await store.readContent()
  assert.equal(snapshot.navigationRaw, null)
  assert.deepEqual({ ...snapshot.files }, { 'intro.md': raw })
  await absent(path.join(content, '.navigation.json'))
}))

test('navigation saves root and nested orders without changing document contents', () => fixture(async ({ content, store }) => {
  await mkdir(path.join(content, '产品/空目录'), { recursive: true })
  const first = document('first'), nested = document('nested')
  await writeFile(path.join(content, 'first.md'), first)
  await writeFile(path.join(content, '产品/nested.md'), nested)
  const raw = navigation({ '': ['产品', 'first.md'], 产品: ['空目录', 'nested.md'], '产品/空目录': [] })
  assert.deepEqual(await store.saveNavigation({ raw, expected: null }), { raw })
  assert.equal(await readFile(path.join(content, '.navigation.json'), 'utf8'), raw)
  const snapshot = await store.readContent()
  assert.equal(snapshot.navigationRaw, raw)
  assert.deepEqual({ ...snapshot.files }, { 'first.md': first, '产品/nested.md': nested })
  assert.deepEqual((await readdir(content)).sort(), ['.navigation.json', 'first.md', '产品'])
}))

test('new documents and folders preserve previously saved navigation metadata', () => fixture(async ({ content, store }) => {
  const first = document('first')
  await writeFile(path.join(content, 'first.md'), first)
  const raw = navigation({ '': ['first.md'] })
  await store.saveNavigation({ raw, expected: null })
  await store.saveDocument({ path: 'second.md', raw: document('second'), expected: null, assets: [] })
  await store.createFolder({ parent: '', name: '新增目录' })
  const snapshot = await store.readContent()
  assert.equal(snapshot.navigationRaw, raw)
  assert.equal(snapshot.files['first.md'], first)
  assert.equal(snapshot.files['second.md'], document('second'))
  assert.ok(snapshot.folders.includes('新增目录'))
  assert.equal(await readFile(path.join(content, '.navigation.json'), 'utf8'), raw)
}))

test('navigation updates require the last read original and preserve external changes', () => fixture(async ({ content, store }) => {
  await writeFile(path.join(content, 'a.md'), document('a'))
  await writeFile(path.join(content, 'b.md'), document('b'))
  const first = navigation({ '': ['a.md', 'b.md'] }), updated = navigation({ '': ['b.md', 'a.md'] })
  await store.saveNavigation({ raw: first, expected: null })
  await assert.rejects(store.saveNavigation({ raw: updated, expected: null }), status(409))
  await store.saveNavigation({ raw: updated, expected: first })
  const filename = path.join(content, '.navigation.json'), external = navigation({ '': ['a.md'] })
  await writeFile(filename, external)
  await assert.rejects(store.saveNavigation({ raw: first, expected: updated }), status(409))
  assert.equal(await readFile(filename, 'utf8'), external)
  await rm(filename)
  await assert.rejects(store.saveNavigation({ raw: first, expected: external }), status(409))
  await absent(filename)
}))

test('concurrent navigation saves accept exactly one writer with the same expectation', () => fixture(async ({ content, store }) => {
  await writeFile(path.join(content, 'a.md'), document('a'))
  await writeFile(path.join(content, 'b.md'), document('b'))
  const candidates = [navigation({ '': ['a.md', 'b.md'] }), navigation({ '': ['b.md', 'a.md'] })]
  const results = await Promise.allSettled(candidates.map(raw => store.saveNavigation({ raw, expected: null })))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409)
  const saved = results.find(result => result.status === 'fulfilled').value.raw
  assert.equal(await readFile(path.join(content, '.navigation.json'), 'utf8'), saved)
  assert.ok(candidates.includes(saved))
  assert.deepEqual((await readdir(content)).sort(), ['.navigation.json', 'a.md', 'b.md'])
}))

test('malformed navigation data and request fields never replace valid metadata', () => fixture(async ({ content, store }) => {
  const before = navigation({})
  await store.saveNavigation({ raw: before, expected: null })
  const invalid = ['{', 'null', '[]', '{}', JSON.stringify({ version: 2, order: {} }), JSON.stringify({ version: 1, order: [] }), JSON.stringify({ version: 1, order: {}, extra: true }), navigation({ '': 'file.md' }), navigation({ '': [null] })]
  for (const raw of invalid) await assert.rejects(store.saveNavigation({ raw, expected: before }), status(400), raw)
  for (const body of [{ raw: before }, { raw: 12, expected: before }, { raw: before, expected: false }, { raw: before, expected: before, path: '../elsewhere.json' }]) {
    await assert.rejects(store.saveNavigation(body), status(400))
  }
  assert.equal(await readFile(path.join(content, '.navigation.json'), 'utf8'), before)
  assert.deepEqual(await readdir(content), ['.navigation.json'])
}))

test('navigation refuses unsafe names and distinguishes tree conflicts from invalid input', () => fixture(async ({ content, store }) => {
  await mkdir(path.join(content, 'folder'))
  await writeFile(path.join(content, 'root.md'), document('root'))
  await writeFile(path.join(content, 'folder/child.md'), document('child'))
  await writeFile(path.join(content, 'notes.txt'), 'non-Markdown')
  const orders = [
    { '../outside': [] }, { '/outside': [] }, { 'folder/..': [] }, { '.private': [] },
    { '': ['../outside.md'] }, { '': ['/outside.md'] }, { '': ['.navigation.json'] },
    { '': ['root.md', 'root.md'] }, { '': ['folder/child.md'] },
    JSON.parse('{"__proto__":[]}'), { constructor: [] }, { prototype: [] },
    { '': ['__proto__'] }, { '': ['constructor'] }, { '': ['prototype'] },
  ]
  for (const order of orders) await assert.rejects(store.saveNavigation({ raw: navigation(order), expected: null }), status(400), JSON.stringify(order))
  const conflicts = [{ '': ['missing.md'] }, { missing: [] }, { folder: ['root.md'] }, { 'root.md': [] }, { '': ['notes.txt'] }, { '': ['workspace-settings'] }]
  for (const order of conflicts) await assert.rejects(store.saveNavigation({ raw: navigation(order), expected: null }), status(409), JSON.stringify(order))
  await absent(path.join(content, '.navigation.json'))
  assert.equal(await readFile(path.join(content, 'root.md'), 'utf8'), document('root'))
  assert.equal(await readFile(path.join(content, 'folder/child.md'), 'utf8'), document('child'))
  assert.equal(await readFile(path.join(content, 'notes.txt'), 'utf8'), 'non-Markdown')
}))

test('existing stale navigation entries can be preserved but new missing entries conflict', () => fixture(async ({ content, store }) => {
  const raw = navigation({ '': ['deleted.md', 'removed-folder', 'current.md'], 'removed-folder': ['old.md'] })
  await writeFile(path.join(content, '.navigation.json'), raw)
  await writeFile(path.join(content, 'current.md'), document('current'))
  const snapshot = await store.readContent()
  assert.equal(snapshot.navigationRaw, raw)
  assert.deepEqual(Object.keys(snapshot.files), ['current.md'])
  await store.saveNavigation({ raw, expected: raw })
  assert.equal(await readFile(path.join(content, '.navigation.json'), 'utf8'), raw)
  for (const order of [
    { '': ['deleted.md', 'removed-folder', 'current.md', 'new-missing.md'], 'removed-folder': ['old.md'] },
    { '': ['deleted.md', 'removed-folder', 'current.md'], 'removed-folder': ['different.md'] },
    { '': ['deleted.md', 'removed-folder', 'current.md'], 'removed-folder': ['old.md', 'new-missing.md'] },
    { '': ['deleted.md', 'removed-folder', 'current.md'], 'removed-folder': [] },
    { '': ['deleted.md', 'removed-folder', 'current.md'], 'another-missing-parent': [] },
  ]) await assert.rejects(store.saveNavigation({ raw: navigation(order), expected: raw }), status(409), JSON.stringify(order))
  const reordered = navigation({ '': ['current.md', 'deleted.md', 'removed-folder'], 'removed-folder': ['old.md'] })
  await store.saveNavigation({ raw: reordered, expected: raw })
  const cleaned = navigation({ '': ['current.md'] })
  await store.saveNavigation({ raw: cleaned, expected: reordered })
  assert.equal((await store.readContent()).navigationRaw, cleaned)
}))

test('navigation metadata byte limits protect writes, expected originals, and reads', () => fixture(async ({ content, store }) => {
  const limit = 256 * 1024, filename = path.join(content, '.navigation.json'), minimal = navigation({})
  const exact = minimal + ' '.repeat(limit - Buffer.byteLength(minimal))
  await store.saveNavigation({ raw: exact, expected: null })
  assert.equal((await store.readContent()).navigationRaw, exact)
  const oversized = exact + ' ', multibyte = minimal + '汉'.repeat(Math.floor(limit / 3))
  for (const raw of [oversized, multibyte]) await assert.rejects(store.saveNavigation({ raw, expected: exact }), status(413))
  await assert.rejects(store.saveNavigation({ raw: minimal, expected: oversized }), status(413))
  assert.equal(await readFile(filename, 'utf8'), exact)
  await writeFile(filename, oversized)
  await assert.rejects(store.readContent(), status(413))
}))

test('navigation symlinks, hardlinks, and directory targets cannot be read or replaced', async () => {
  for (const kind of ['symlink', 'hardlink', 'directory']) await fixture(async ({ temp, content, store }) => {
    const outside = path.join(temp, 'outside.json'), filename = path.join(content, '.navigation.json'), raw = navigation({})
    await writeFile(outside, raw)
    if (kind === 'symlink') await symlink(outside, filename)
    else if (kind === 'hardlink') await link(outside, filename)
    else await mkdir(filename)
    await assert.rejects(store.readContent(), status(409), kind)
    await assert.rejects(store.saveNavigation({ raw, expected: raw }), status(409), kind)
    assert.equal(await readFile(outside, 'utf8'), raw)
    assert.deepEqual(await readdir(content), ['.navigation.json'])
  })
})

test('navigation parent symlinks cannot redirect metadata reads or writes', async () => {
  for (const target of ['src', 'src/content']) await fixture(async ({ temp, root, store }) => {
    const outside = path.join(temp, 'outside'), raw = navigation({})
    await mkdir(outside)
    await writeFile(path.join(outside, '.navigation.json'), raw)
    const entry = path.join(root, target)
    await rm(entry, { recursive: true })
    await symlink(outside, entry, 'dir')
    await assert.rejects(store.readContent(), status(409), target)
    await assert.rejects(store.saveNavigation({ raw, expected: raw }), status(409), target)
    assert.equal(await readFile(path.join(outside, '.navigation.json'), 'utf8'), raw)
    assert.deepEqual(await readdir(outside), ['.navigation.json'])
  })
})

test('failed and revoked navigation authorizations preserve metadata and unrelated files', async () => {
  for (const revokeAt of [1, 2]) await fixture(async ({ content, store }) => {
    const raw = navigation({}), filename = path.join(content, '.navigation.json'), unrelated = document('unrelated')
    await writeFile(filename, raw)
    await writeFile(path.join(content, 'unrelated.md'), unrelated)
    let checks = 0
    const check = () => {
      if (++checks === revokeAt) { const error = new Error('授权已撤销'); error.status = 401; throw error }
    }
    await assert.rejects(store.saveNavigation({ raw: navigation({ '': ['unrelated.md'] }), expected: raw }, check), status(401))
    assert.equal(await readFile(filename, 'utf8'), raw)
    assert.equal(await readFile(path.join(content, 'unrelated.md'), 'utf8'), unrelated)
    assert.deepEqual((await readdir(content)).sort(), ['.navigation.json', 'unrelated.md'])
  })
})
