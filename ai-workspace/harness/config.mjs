import registry from './roles.json' with { type: 'json' }
export const roleDefinitions = registry.roles
const nonempty = value => typeof value === 'string' && value.trim().length > 0
function fields(value, allowed, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须为对象`)
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`${label} 包含未知字段 ${key}`)
}
export function validateConfig(config) {
  fields(config, ['$schema', 'version', 'workspace', 'projects', 'roles', 'role'], '配置')
  if (config.$schema !== undefined && typeof config.$schema !== 'string') throw new Error('$schema 必须为字符串')
  if (config.version !== 1) throw new Error('配置 version 必须为 1')
  fields(config.workspace, ['name'], 'workspace')
  if (!nonempty(config.workspace.name)) throw new Error('空间名称不能为空')
  if (!Array.isArray(config.projects)) throw new Error('projects 必须为数组')
  if (config.roles !== undefined && config.role !== undefined) throw new Error('请只保留 roles 字段，不要同时设置 role')
  const roles = config.roles !== undefined ? config.roles : (config.role == null ? [] : [config.role])
  if (!Array.isArray(roles) || roles.some(role => typeof role !== 'string' || !Object.hasOwn(roleDefinitions, role)) || new Set(roles).size !== roles.length) throw new Error('roles 必须为不重复的有效角色数组')
  const ids = new Set(), paths = new Set()
  for (const project of config.projects) {
    fields(project, ['id', 'name', 'path'], 'project')
    if (typeof project.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.id)) throw new Error('项目 id 必须为小写字母、数字和连字符')
    if (ids.has(project.id)) throw new Error(`项目 id 重复：${project.id}`)
    ids.add(project.id)
    if (!nonempty(project.name) || !nonempty(project.path) || project.path.includes('\0')) throw new Error(`项目 ${project.id} 的名称或路径无效`)
    if (paths.has(project.path)) throw new Error(`项目 ${project.id} 与其他项目路径重复`)
    paths.add(project.path)
  }
  return { ...(config.$schema ? { $schema: config.$schema } : {}), version: 1, workspace: { ...config.workspace }, roles: [...roles], projects: config.projects.map(project => ({ ...project })) }
}
