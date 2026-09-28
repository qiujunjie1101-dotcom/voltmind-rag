import axios from 'axios'

import { apiBaseUrl, apiTimeoutMs } from '@/lib/env'

/**
 * 把请求失败翻译成可直接展示的中文提示。
 *
 * 各业务 API 层共用：后端业务异常统一返回 `{"detail": "..."}`，优先直接展示；
 * 超时、连不上、422 校验失败等分别给出可执行的提示。
 *
 * @param error 捕获到的异常
 * @param path 请求路径，仅用于 404 时提示具体接口
 */
export function describeApiFailure(error: unknown, path: string): string {
  if (!axios.isAxiosError(error)) {
    return '发生未知错误，请重试'
  }

  // 超时：axios 一般给 ECONNABORTED，部分环境走 ETIMEDOUT
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return `请求超时（超过 ${Math.round(apiTimeoutMs / 1000)} 秒），请稍后重试`
  }

  const response = error.response
  if (!response) {
    // 后端未启动、端口写错或被防火墙拦截时都落到这里
    return `无法连接服务 ${apiBaseUrl}，请确认 Python AI 服务已启动`
  }

  const detail = readDetail(response.data)
  if (detail) {
    return `服务返回 ${response.status}：${detail}`
  }

  // 校验失败时 FastAPI 的 detail 是数组，不做逐条展开，给出统一提示
  if (response.status === 422) {
    return '提交内容不合法（422），请检查后重试'
  }
  if (response.status === 404) {
    return `接口不存在（404）：${apiBaseUrl}${path}`
  }
  return `服务返回异常状态 ${response.status}，请稍后重试`
}

function readDetail(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null
  const detail = (data as { detail?: unknown }).detail
  return typeof detail === 'string' && detail.trim() ? detail.trim() : null
}
