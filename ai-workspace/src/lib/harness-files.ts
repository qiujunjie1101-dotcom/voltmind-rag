import { parse } from 'yaml'
import registry from '../../harness/roles.json' with { type: 'json' }
import agents from '../../AGENTS.md?raw'
import guide from '../../harness/README.md?raw'
import { roleDefinitions } from '../../harness/config.mjs'
export type RoleDefinition = (typeof roleDefinitions)[string]
export interface RoleRegistry { version: number; roles: Record<string, RoleDefinition> }
const skills = import.meta.glob('../../.agents/skills/workspace-*/SKILL.md', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
export const harnessFiles = [
  { path: 'AGENTS.md', label: 'Agent 工作规则', kind: 'markdown', template: agents },
  { path: 'harness/roles.json', label: '角色职责与目录约束', kind: 'roles', template: JSON.stringify(registry, null, 2) + '\n' },
  { path: 'harness/README.md', label: 'Harness 协作说明', kind: 'markdown', template: guide },
  ...Object.entries(roleDefinitions).map(([id, role]) => ({ path: `.agents/skills/${role.skill}/SKILL.md`, label: `${id} · ${role.name}技能`, kind: 'skill', template: skills[`../../.agents/skills/${role.skill}/SKILL.md`] || '' })),
]
export function harnessFile(path: string) {
  const file = harnessFiles.find(file => file.path === path)
  if (!file) throw new Error('此页面只管理 workspace 的工作规则、角色目录和角色技能。')
  return file
}
export function validateRoles(value: unknown): RoleRegistry {
  const data = value as RoleRegistry
  if (!data || data.version !== 1 || !data.roles || Array.isArray(data.roles)) throw new Error('角色配置结构无效。')
  const ids = Object.keys(roleDefinitions)
  if (Object.keys(data).some(key => !['version', 'roles'].includes(key)) || Object.keys(data.roles).length !== ids.length) throw new Error('请保留现有七个角色。')
  for (const id of ids) {
    const role = data.roles[id]
    if (!role || typeof role !== 'object' || Object.keys(role).some(key => !['name', 'skill', 'directories', 'outputs'].includes(key))) throw new Error(`${id} 角色字段无效。`)
    if (typeof role.name !== 'string' || !role.name.trim() || typeof role.outputs !== 'string' || !role.outputs.trim()) throw new Error(`${id} 的名称和职责说明不能为空。`)
    if (role.skill !== roleDefinitions[id]!.skill) throw new Error(`${id} 的技能标识不能改变。`)
    if (!Array.isArray(role.directories) || !role.directories.length || new Set(role.directories).size !== role.directories.length) throw new Error(`${id} 至少需要一个不重复的资源目录。`)
    for (const directory of role.directories) {
      if (typeof directory !== 'string' || !/^(src\/content|public\/media)\/.+/.test(directory) || directory.split('/').some(part => !part || part === '.' || part === '..' || /[\\\x00-\x1f]/.test(part))) throw new Error(`${id} 的目录必须位于 src/content/ 或 public/media/ 下，且不能包含路径跳转。`)
    }
  }
  return data
}
export function validateHarnessFile(path: string, raw: string) {
  const file = harnessFile(path)
  if (!raw.trim()) throw new Error('规则内容不能为空。')
  if (raw.length > 500_000) throw new Error('文件过大，请将详细资料拆分为项目文档。')
  if (file.kind === 'roles') validateRoles(JSON.parse(raw))
  if (file.kind === 'skill') {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
    if (!match) throw new Error('技能缺少 YAML 信息。')
    const meta = parse(match[1]!)
    if (meta?.name !== path.split('/')[2] || typeof meta.description !== 'string' || !meta.description.trim()) throw new Error('技能名称与文件目录必须一致，并保留描述。')
    if (!raw.slice(match[0].length).trim()) throw new Error('技能工作规则不能为空。')
  }
}
