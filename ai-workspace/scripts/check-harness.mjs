import assert from 'node:assert/strict'
import { createServer } from 'vite'
const missing = () => Object.assign(new Error('missing'), { name: 'NotFoundError' })
function directory(name) {
  const entries = new Map()
  return {
    name, kind: 'directory', entries,
    queryPermission: async () => 'granted', requestPermission: async () => 'granted',
    async *values() { yield* entries.values() },
    async getDirectoryHandle(name, { create = false } = {}) {
      if (!entries.has(name)) { if (!create) throw missing(); entries.set(name, directory(name)) }
      return entries.get(name)
    },
    async getFileHandle(name, { create = false } = {}) {
      if (!entries.has(name)) {
        if (!create) throw missing()
        let raw = ''
        entries.set(name, { name, kind: 'file', getFile: async () => ({ text: async () => raw }), createWritable: async () => ({ write: async value => { raw = value }, close: async () => {}, abort: async () => {} }) })
      }
      return entries.get(name)
    },
  }
}
async function project(name) {
  const root = directory(name)
  await root.getFileHandle('package.json', { create: true })
  await (await root.getDirectoryHandle('src', { create: true })).getDirectoryHandle('content', { create: true })
  return root
}
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] } })
const previousWindow = globalThis.window
try {
  let selected = await project('A')
  globalThis.window = { showDirectoryPicker: async () => selected }
  const { harnessFiles, validateHarnessFile, validateRoles } = await server.ssrLoadModule('/src/lib/harness-files.ts')
  for (const file of harnessFiles) validateHarnessFile(file.path, file.template)
  assert.throws(() => validateHarnessFile('src/App.vue', 'overwrite'), /只管理/)
  assert.throws(() => validateHarnessFile('../AGENTS.md', 'overwrite'), /只管理/)
  assert.throws(() => validateHarnessFile('AGENTS.md', ''), /不能为空/)
  assert.throws(() => validateHarnessFile('.agents/skills/workspace-pm/SKILL.md', '---\nname: wrong\ndescription: bad\n---\nbody'), /名称/)
  const roles = JSON.parse(harnessFiles.find(file => file.kind === 'roles').template)
  roles.roles.PM.directories = ['src/content/../App.vue']
  assert.throws(() => validateRoles(roles), /路径跳转/)
  roles.roles.PM.directories = ['src/components']
  assert.throws(() => validateRoles(roles), /目录必须/)
  roles.roles.PM.directories = ['src/content/产品新目录']
  const api = await server.ssrLoadModule('/src/lib/local-workspace.ts')
  await api.connectLocalProject()
  const id = api.localProject.connectionId
  const content = await server.ssrLoadModule('/src/lib/content.ts')
  assert(content.docs.some(doc => doc.id === 'workspace-harness'), '连接没有任何文章的旧工程后，Harness 管理仍应可用')
  assert(content.docs.some(doc => doc.id === 'workspace-settings'), '旧工程应保留配置中心')
  const collision = { '06-空间配置/01-Harness管理.md': '---\nslug: custom-page\n---\nKeep my page' }
  const merged = content.withManagementPages(collision)
  assert.equal(merged['06-空间配置/01-Harness管理.md'], collision['06-空间配置/01-Harness管理.md'])
  assert.equal(content.buildKnowledge(merged).docs.filter(doc => doc.id === 'workspace-harness').length, 1)
  assert.equal(await api.readHarnessFile('AGENTS.md'), null)
  await api.writeHarnessFile('AGENTS.md', '# Team rules\nUse product context.', null, id)
  assert.equal(await api.readHarnessFile('AGENTS.md'), '# Team rules\nUse product context.')
  await assert.rejects(api.writeHarnessFile('AGENTS.md', '# changed', null, id), /其他编辑器/)
  await api.writeHarnessFile('harness/roles.json', JSON.stringify(roles), null, id)
  assert.deepEqual(api.localHarnessRoles.value.PM.directories, ['src/content/产品新目录'])
  const skill = harnessFiles.find(file => file.path.includes('workspace-pm/'))
  await api.writeHarnessFile(skill.path, skill.template, null, id)
  assert.equal(await api.readHarnessFile(skill.path), skill.template)
  // Damaged JSON must remain readable so the page can repair it.
  const handle = await (await selected.getDirectoryHandle('harness')).getFileHandle('roles.json')
  const stream = await handle.createWritable(); await stream.write('{broken'); await stream.close()
  assert.equal(await api.readHarnessFile('harness/roles.json'), '{broken')
  selected = await project('B'); await api.connectLocalProject()
  await assert.rejects(api.writeHarnessFile('AGENTS.md', '# Old draft', null, id), /workspace 已变化/)
  assert.equal(selected.entries.has('AGENTS.md'), false)
  console.log('Harness validated: templates, scope, role forms, skill metadata, file creation, conflicts, live role refresh, damaged-file recovery and project isolation.')
} finally {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
  await server.close()
}
