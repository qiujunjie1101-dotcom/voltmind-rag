import { constants } from 'node:fs'
import { copyFile, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
import { roleDefinitions as roles, validateConfig } from '../harness/config.mjs'
export { validateConfig } from '../harness/config.mjs'
export function resolveProjectPath(value, workspaceRoot = root, userHome = homedir()) {
  if (value === '~') return userHome
  if (/^~[\\/]/.test(value)) return path.resolve(userHome, value.slice(2))
  return path.resolve(workspaceRoot, value)
}
export async function checkPaths(config, workspaceRoot = root) {
  validateConfig(config)
  const canonicalRoot = await realpath(workspaceRoot)
  const seen = new Set()
  for (const project of config.projects) {
    let target
    try {
      target = await realpath(resolveProjectPath(project.path, workspaceRoot))
      if (!(await stat(target)).isDirectory()) throw new Error('不是目录')
    } catch { throw new Error(`项目 ${project.id} 的路径不存在、不可访问或不是目录，请检查本地配置`)}
    const relative = path.relative(canonicalRoot, target)
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error(`项目 ${project.id} 位于 workspace 内部，请引用独立的业务工程目录`)
    }
    if (seen.has(target)) throw new Error(`项目 ${project.id} 与其他项目指向同一目录`)
    seen.add(target)
  }
}
export async function initConfig(workspaceRoot = root) {
  try {
    await copyFile(path.join(workspaceRoot, 'code/projects.example.json'), path.join(workspaceRoot, 'code/projects.local.json'), constants.COPYFILE_EXCL)
    return true
  } catch (error) { if (error.code === 'EEXIST') return false; throw error }
}
export async function selectRole(value, workspaceRoot = root) {
  const selected = [...new Set((Array.isArray(value) ? value : [value]).flatMap(item => (item || '').toUpperCase().split(',')).filter(Boolean))]
  if (!selected.length || selected.some(role => !Object.hasOwn(roles, role))) throw new Error('请选择一个或多个角色：' + Object.keys(roles).join(', '))
  await initConfig(workspaceRoot)
  const configPath = path.join(workspaceRoot, 'code/projects.local.json')
  const config = validateConfig(JSON.parse(await readFile(configPath, 'utf8')))
  config.roles = selected
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n')
  return selected
}
async function main(command) {
  if (command === 'role') {
    const selected = await selectRole(process.argv.slice(3))
    console.log(`已选择 ${selected.join('、')}，可维护各角色目录的并集。`)
    return
  }
  if (command === 'init') {
    console.log(await initConfig() ? '已创建 code/projects.local.json，请填写本地业务项目路径。' : '本地配置已存在，保留原内容。')
    return
  }
  if (!['check', 'check-template'].includes(command)) throw new Error('用法：node scripts/workspace.mjs init|check|check-template|role <角色...>')
  const template = command === 'check-template'
  let config
  try { config = JSON.parse(await readFile(path.join(root, `code/projects.${template ? 'example' : 'local'}.json`), 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT' && !template) throw new Error('缺少本地配置，请先运行 npm run workspace:init')
    throw new Error('配置文件无法读取或 JSON 格式无效')
  }
  validateConfig(config)
  if (!template) await checkPaths(config)
  console.log(`${template ? '模板结构' : '本地项目配置'}检查通过，共 ${config.projects.length} 个代码引用。${!config.projects.length ? '尚未关联业务工程。' : ''}`)
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2]).catch(error => { console.error(error.message); process.exitCode = 1 })
}
