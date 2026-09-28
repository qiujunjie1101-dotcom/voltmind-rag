import { workspaceService } from './workspace-service'

export interface ContentSnapshot { files: Record<string, string>; folders: string[]; navigationRaw: string | null }
export interface ContentSession { token: string; name: string; instanceId: string }
export interface ContentAsset { name: string; type: string; data: string }
export class ContentServiceError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}
const endpoint = `${import.meta.env.BASE_URL}__workspace-config`
export const navigationServiceUnavailable = '当前本地服务尚未加载目录排序功能。请重启项目的开发服务（npm run dev），再重新检测服务并授权保存。'

async function request<T>(route: string, session?: ContentSession, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${endpoint}/${route}`, {
    method, cache: 'no-store', credentials: 'omit',
    headers: {
      'X-Workspace-Request': '1',
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(route === 'document' || route === 'content' ? 60000 : 10000),
  })
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new ContentServiceError('本地文档服务不可用，请确认已运行 npm run dev。', response.status)
  }
  const data = await response.json()
  if (!response.ok) throw new ContentServiceError(route === 'navigation' && response.status === 404 ? navigationServiceUnavailable : data.error || '本地文档服务请求失败，请重试。', response.status)
  return data as T
}

// The caller must show the discovered identity and obtain confirmation first.
export async function authorizeContentService(): Promise<ContentSession> {
  const info = workspaceService.info
  if (!import.meta.env.DEV || !info?.instanceId) throw new Error('空间信息已失效，请重新打开授权面板。')
  const { token } = await request<{ token: string }>('authorize', undefined, 'POST', { approved: true, instanceId: info.instanceId, scope: 'content' })
  return { token, name: info.name, instanceId: info.instanceId }
}
export function revokeContentService(session: ContentSession) { return request('revoke', session, 'POST') }
export function readServiceContent(session: ContentSession) { return request<ContentSnapshot>('content', session) }
export function writeServiceDocument(session: ContentSession, path: string, raw: string, expected: string | null, assets: ContentAsset[]) {
  return request<{ saved: true }>('document', session, 'PUT', { path, raw, expected, assets })
}
export function createServiceFolder(session: ContentSession, parent: string, name: string) {
  return request<{ created: true }>('folder', session, 'POST', { parent, name })
}
export function writeServiceNavigation(session: ContentSession, raw: string, expected: string | null) {
  return request<{ raw: string }>('navigation', session, 'PUT', { raw, expected })
}

export async function encodeContentAssets(assets: Array<{ source: string; file: File }>): Promise<ContentAsset[]> {
  if (assets.length > 100) throw new Error('单次最多保存 100 个媒体文件。')
  let total = 0
  for (const asset of assets) {
    if (!asset.file.size) throw new Error('媒体文件不能为空。')
    if (asset.file.size > 20 * 1024 * 1024) throw new Error('单个媒体文件不能超过 20 MB。')
    total += asset.file.size
  }
  if (total > 40 * 1024 * 1024) throw new Error('单次媒体总量不能超过 40 MB。')
  const encoded: ContentAsset[] = []
  for (const asset of assets) {
    const name = asset.source.slice('./media/'.length)
    if (!asset.source.startsWith('./media/') || name.includes('/')) throw new Error('媒体路径无效，请重新插入媒体。')
    const bytes = new Uint8Array(await asset.file.arrayBuffer())
    // Bound argument count even for large videos; encode one complete binary
    // string so chunk boundaries cannot introduce Base64 padding in the middle.
    const chunks: string[] = []
    for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
    encoded.push({ name, type: asset.file.type, data: btoa(chunks.join('')) })
  }
  return encoded
}
