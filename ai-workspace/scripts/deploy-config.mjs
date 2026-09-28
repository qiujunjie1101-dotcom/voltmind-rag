import { isIP } from 'node:net'
import { createHash, randomBytes } from 'node:crypto'
export class DeploymentError extends Error { constructor(status, message) { super(message); this.status = status } }
export const failDeployment = (status, message) => { throw new DeploymentError(status, message) }
export const defaultDeployment = () => ({ version: 1, deploymentId: randomBytes(16).toString('hex'), host: '', port: 22, username: '', auth: 'password', privateKeyPath: '', remoteDir: '/var/www/ai-workspace', publicUrl: '', mode: 'existing', httpPort: 8080, hostKey: null })
export function validateTarget(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) failDeployment(400, '请填写服务器地址和 SSH 端口。')
  const { host, port } = value
  if (typeof host !== 'string' || host.length > 253 || !(isIP(host) || /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)) || host.includes('..')) failDeployment(400, '服务器地址应为 IP 或域名，不包含协议、路径或空格。')
  if (!Number.isInteger(port) || port < 1 || port > 65535) failDeployment(400, 'SSH 端口应在 1–65535 之间。')
  return { host, port }
}
export function fingerprint(type, key) {
  if (!['ssh-ed25519','ecdsa-sha2-nistp256','ssh-rsa'].includes(type) || typeof key !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(key) || key.length > 4096) failDeployment(400, '主机公钥格式不正确。')
  const bytes = Buffer.from(key, 'base64')
  if (bytes.length < 12 || bytes.readUInt32BE(0) !== Buffer.byteLength(type) || bytes.subarray(4,4+Buffer.byteLength(type)).toString() !== type) failDeployment(400, '主机公钥类型不匹配。')
  return 'SHA256:' + createHash('sha256').update(bytes).digest('base64').replace(/=+$/, '')
}
export function validateDeployment(value, requireKey = true) {
  const fields = Object.keys(defaultDeployment())
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !fields.includes(key))) failDeployment(400, '部署配置包含无效字段。密码不能写入配置文件。')
  validateTarget(value)
  if (value.version !== 1 || !/^[a-f0-9]{32}$/.test(value.deploymentId || '')) failDeployment(400, '部署配置版本或项目标识无效。')
  if (typeof value.username !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_.-]{0,63}$/.test(value.username)) failDeployment(400, '请填写有效的 SSH 登录用户名。')
  if (!['password','key'].includes(value.auth) || !['existing','nginx'].includes(value.mode)) failDeployment(400, '登录方式或部署模式无效。')
  if (typeof value.privateKeyPath !== 'string' || value.privateKeyPath.length > 2048 || /[\r\n\0]/.test(value.privateKeyPath) || (value.privateKeyPath && !/^(\/|~\/)/.test(value.privateKeyPath))) failDeployment(400, '密钥路径应为本机绝对路径，或留空使用 SSH agent。')
  const dir = value.remoteDir
  if (typeof dir !== 'string' || dir.length > 200 || !/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)+$/.test(dir) || dir.split('/').some(p => p === '.' || p === '..') || /^\/(etc|usr|bin|sbin|dev|proc|sys|boot)(\/|$)/.test(dir)) failDeployment(400, '部署目录应为专用的 Linux 绝对路径，例如 /var/www/ai-workspace。')
  if (!Number.isInteger(value.httpPort) || value.httpPort < 1 || value.httpPort > 65535) failDeployment(400, '网站端口应在 1–65535 之间。')
  let url
  try { url = new URL(value.publicUrl) } catch { failDeployment(400, '请填写完整的访问地址，例如 http://服务器IP:8080/。') }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !url.pathname.endsWith('/')) failDeployment(400, '访问地址必须以 / 结尾，不含账号、密码、查询参数或锚点。')
  if (value.mode === 'nginx' && (url.pathname !== '/' || Number(url.port || (url.protocol === 'https:' ? 443 : 80)) !== value.httpPort || url.protocol !== 'http:')) failDeployment(400, '自动初始化模式的访问地址应为 http://主机:网站端口/；HTTPS 请使用已有网站服务模式。')
  if (value.hostKey !== null) {
    const key = value.hostKey
    if (!key || typeof key !== 'object' || Object.keys(key).some(k => !['type','key','fingerprint','host','port'].includes(k)) || key.host !== value.host || key.port !== value.port || fingerprint(key.type,key.key) !== key.fingerprint) failDeployment(400, '请重新获取并确认当前主机指纹。')
  } else if (requireKey) failDeployment(400, '连接前请获取并确认主机指纹。')
  return Object.fromEntries(fields.map(key => [key, value[key]]))
}
export const shellQuote = value => "'" + String(value).replace(/'/g, "'\\''") + "'"
