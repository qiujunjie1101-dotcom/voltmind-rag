/**
 * 运行时配置。
 *
 * 服务地址与超时全部来自 Vite 环境变量（见 .env），代码中不出现硬编码的服务地址。
 * 变量缺失或非法时在模块加载阶段直接抛错：这是一次性配置错误，
 * 早失败比带着错误配置跑到发请求时再暴露更容易定位。
 */

function readRequired(name: string, raw: string | undefined): string {
  const value = raw?.trim()
  if (!value) {
    throw new Error(
      `缺少环境变量 ${name}。请复制 voltmind-web/.env.example 为 .env 后重启开发服务。`,
    )
  }
  return value
}

function readPositiveNumber(name: string, raw: string | undefined): number {
  const value = readRequired(name, raw)
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`环境变量 ${name} 需要是正数，当前值为 ${JSON.stringify(value)}`)
  }
  return parsed
}

/** 后端服务地址，去掉末尾斜杠，避免与请求路径拼出双斜杠。 */
export const apiBaseUrl = readRequired(
  'VITE_API_BASE_URL',
  import.meta.env.VITE_API_BASE_URL,
).replace(/\/+$/, '')

/** 请求超时毫秒数。 */
export const apiTimeoutMs = readPositiveNumber(
  'VITE_API_TIMEOUT_MS',
  import.meta.env.VITE_API_TIMEOUT_MS,
)

/** Java 业务服务地址，与 Python AI 服务保持独立。 */
export const businessApiBaseUrl = readRequired(
  'VITE_BUSINESS_API_BASE_URL',
  import.meta.env.VITE_BUSINESS_API_BASE_URL,
).replace(/\/+$/, '')

/** Java 业务请求超时毫秒数。 */
export const businessApiTimeoutMs = readPositiveNumber(
  'VITE_BUSINESS_API_TIMEOUT_MS',
  import.meta.env.VITE_BUSINESS_API_TIMEOUT_MS,
)
