export interface WorkspaceConfig {
  $schema?: string
  version: 1
  workspace: { name: string }
  roles: string[]
  projects: { id: string; name: string; path: string }[]
}
export const roleDefinitions: Record<string, { name: string; skill: string; directories: string[]; outputs: string }>
export function validateConfig(config: unknown): WorkspaceConfig
