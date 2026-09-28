import { reactive } from 'vue'

interface WorkspaceInfo { name: string; path: string; instanceId: string; capabilities?: string[] }
export const workspaceService = reactive({
  checking: false,
  info: null as WorkspaceInfo | null,
  error: '',
  connected: false,
  connectionId: 0,
})
let token = ''
const endpoint = `${import.meta.env.BASE_URL}__workspace-config`

async function request<T>(route: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${endpoint}/${route}`, {
    method,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      'X-Workspace-Request': '1',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  })
  if (response.status === 401) clearAuthorization()
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('本地配置服务不可用，请确认已运行 npm run dev。')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '本地配置服务请求失败，请重试。')
  return data as T
}

export async function discoverWorkspaceService() {
  if (!import.meta.env.DEV || workspaceService.checking) return
  workspaceService.checking = true; workspaceService.error = ''
  try { workspaceService.info = await request<WorkspaceInfo>('info') }
  catch { workspaceService.info = null; workspaceService.error = '未连接到本地配置服务，请确认开发服务正在运行后重试。' }
  finally { workspaceService.checking = false }
}

// Called only after the user confirms the workspace and the limited write scope.
export async function authorizeWorkspaceService() {
  const instanceId = workspaceService.info?.instanceId
  if (!instanceId) throw new Error('空间信息已失效，请重新打开授权面板。')
  const result = await request<{ token: string }>('authorize', 'POST', { approved: true, instanceId })
  token = result.token
  workspaceService.connected = true
  workspaceService.connectionId++
}

function clearAuthorization() {
  token = ''
  workspaceService.connected = false
  workspaceService.connectionId++
}

export async function revokeWorkspaceService() {
  try { if (token) await request('revoke', 'POST') }
  finally { clearAuthorization() }
}

export async function readServiceSettings() {
  if (!workspaceService.connected) throw new Error('请先授权绑定当前空间。')
  return (await request<{ raw: string | null }>('settings')).raw
}

export async function writeServiceSettings(raw: string, expected: string | null, connectionId: number) {
  if (!workspaceService.connected || workspaceService.connectionId !== connectionId) throw new Error('空间授权已变化，请重新绑定后保存。')
  return (await request<{ raw: string }>('settings', 'PUT', { raw, expected })).raw
}
