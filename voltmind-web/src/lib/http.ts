import axios from 'axios'

import { apiBaseUrl, apiTimeoutMs } from '@/lib/env'

/**
 * 全局 HTTP 客户端。
 *
 * 超时比后端模型调用超时（默认 30 秒）更长，让超时提示由后端给出：
 * 前端抢先后端中断的话，用户只能看到"前端超时"，看不到真实原因。
 */
export const http = axios.create({
  baseURL: apiBaseUrl,
  timeout: apiTimeoutMs,
  headers: { 'Content-Type': 'application/json' },
})
