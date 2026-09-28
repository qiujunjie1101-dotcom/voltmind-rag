import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { validateConfig, resolveProjectPath, checkPaths, initConfig, selectRole } from './workspace.mjs'
const config = projects => ({ version: 1, workspace: { name: 'Test' }, role: 'PM', projects })
async function fixture(run) {
  const temp = await mkdtemp(path.join(tmpdir(), 'workspace-test-'))
  try {
    await mkdir(path.join(temp, 'space/code'), { recursive: true })
    await mkdir(path.join(temp, 'business'))
    await run(temp, path.join(temp, 'space'))
  } finally { await rm(temp, { recursive: true, force: true }) }
}
test('empty project list supports design-only workspace', () => {
  assert.equal(validateConfig(config([])).projects.length, 0)
  assert.throws(() => validateConfig({ ...config([]), role: 'UNKNOWN' }), /role/)
})
test('reject malformed config, blank fields, duplicate IDs and unknown commands', () => {
  for (const invalid of [null, [], {}, {...config([]),version:2}, {...config([]),workspace:{name:' '}}, {...config([]),command:'run'}, config([{id:'web',name:' ',path:'../web'}]), config([{id:'Web',name:'Web',path:'../web'}]), config([{id:'web',name:'Web',path:'../web'},{id:'web',name:'Other',path:'../other'}])]) {
    assert.throws(() => validateConfig(invalid))
  }
})
test('relative and home paths resolve independently of command cwd', () => {
  assert.equal(resolveProjectPath('../business','/tmp/space','/tmp/user'),'/tmp/business')
  assert.equal(resolveProjectPath('~/business','/tmp/space','/tmp/user'),'/tmp/user/business')
})
test('init never overwrites personal paths or selected role', async () => fixture(async (_temp,root) => {
  await writeFile(path.join(root,'code/projects.example.json'), JSON.stringify(config([])))
  assert.equal(await initConfig(root), true)
  const personal = JSON.stringify(config([{id:'web',name:'Web',path:'../business'}]))
  await writeFile(path.join(root,'code/projects.local.json'), personal)
  assert.equal(await initConfig(root), false)
  assert.equal(await readFile(path.join(root,'code/projects.local.json'),'utf8'), personal)
}))
test('accept external project, reject missing directory and regular file', async () => fixture(async (temp,root) => {
  await checkPaths(config([{id:'web',name:'Web',path:'../business'}]),root)
  await assert.rejects(checkPaths(config([{id:'web',name:'Web',path:'../missing'}]),root),/路径/)
  await writeFile(path.join(temp,'file'),'text')
  await assert.rejects(checkPaths(config([{id:'web',name:'Web',path:'../file'}]),root),/路径/)
}))
test('reject workspace and nested source references', async () => fixture(async (_temp,root) => {
  for (const target of ['.', 'code']) {
    await assert.rejects(checkPaths(config([{id:'web',name:'Web',path:target}]),root),/workspace 内部/)
  }
}))
test('canonical paths prevent symlink escape and duplicate references', async () => fixture(async (temp,root) => {
  await symlink(root, path.join(temp,'alias-space'),'dir')
  await assert.rejects(checkPaths(config([{id:'web',name:'Web',path:'../alias-space'}]),root),/workspace 内部/)
  await symlink(path.join(temp,'business'),path.join(temp,'alias-business'),'dir')
  await assert.rejects(checkPaths(config([{id:'web',name:'Web',path:'../business'},{id:'api',name:'API',path:'../alias-business'}]),root),/同一目录/)
}))

test('role selection preserves project references and rejects unknown role without writes', async () => fixture(async (_temp,root) => {
  const initial = config([{id:'web',name:'Web',path:'../business'}])
  await writeFile(path.join(root,'code/projects.example.json'), JSON.stringify(initial))
  await selectRole('fe',root)
  const configPath = path.join(root,'code/projects.local.json')
  const saved = JSON.parse(await readFile(configPath,'utf8'))
  assert.deepEqual(saved.roles,['FE']); assert.equal(saved.role,undefined)
  assert.deepEqual(saved.projects,initial.projects)
  const before = await readFile(configPath,'utf8')
  await assert.rejects(selectRole('unknown',root))
  assert.equal(await readFile(configPath,'utf8'),before)
}))

test('multiple roles persist together and legacy single role normalizes', async () => fixture(async (_temp,root) => {
  await writeFile(path.join(root,'code/projects.example.json'),JSON.stringify(config([])))
  await selectRole(['pm','qa'],root)
  const saved=JSON.parse(await readFile(path.join(root,'code/projects.local.json'),'utf8'))
  assert.deepEqual(saved.roles,['PM','QA'])
  assert.deepEqual(validateConfig(config([])).roles,['PM'])
  assert.throws(()=>validateConfig({...config([]),roles:['PM','QA']}))
  const multi={...config([]),role:undefined,roles:['PM','QA']}
  assert.deepEqual(validateConfig(multi).roles,['PM','QA'])
  assert.throws(()=>validateConfig({...multi,roles:['QA','QA']}))
  assert.throws(()=>validateConfig({...multi,roles:null}))
}))
