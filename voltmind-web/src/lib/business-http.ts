import axios, { type AxiosRequestConfig } from 'axios'

import { businessApiBaseUrl, businessApiTimeoutMs } from '@/lib/env'

export interface ApiResponse<T> {
  code: string
  message: string
  data: T
}

export class BusinessRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'BusinessRequestError'
  }
}

export const businessHttp = axios.create({
  baseURL: businessApiBaseUrl,
  timeout: businessApiTimeoutMs,
})

export async function requestBusiness<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await businessHttp.request<ApiResponse<T>>(config)
    const payload = response.data

    if (!isApiResponse(payload)) {
      throw new BusinessRequestError('业务服务返回了无法识别的数据格式', 'INVALID_RESPONSE', response.status)
    }
    if (payload.code !== 'OK') {
      throw new BusinessRequestError(
        describeBusinessCode(payload.code, payload.message),
        payload.code,
        response.status,
      )
    }
    return payload.data
  } catch (error) {
    if (error instanceof BusinessRequestError) throw error
    if (!axios.isAxiosError(error)) {
      throw new BusinessRequestError('发生未知错误，请重试', 'UNKNOWN_ERROR')
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new BusinessRequestError(
        `请求超时（超过 ${Math.round(businessApiTimeoutMs / 1000)} 秒），请稍后重试`,
        'REQUEST_TIMEOUT',
      )
    }

    if (!error.response) {
      throw new BusinessRequestError(
        `无法连接 Java 业务服务 ${businessApiBaseUrl}，请确认服务已启动`,
        'NETWORK_ERROR',
      )
    }

    const payload = error.response.data
    if (isApiResponse(payload)) {
      throw new BusinessRequestError(
        describeBusinessCode(payload.code, payload.message),
        payload.code,
        error.response.status,
      )
    }

    throw new BusinessRequestError(
      `业务服务返回异常状态 ${error.response.status}，请稍后重试`,
      'HTTP_ERROR',
      error.response.status,
    )
  }
}

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ApiResponse<unknown>>
  return typeof candidate.code === 'string' && typeof candidate.message === 'string' && 'data' in candidate
}

function describeBusinessCode(code: string, fallback: string): string {
  const messages: Record<string, string> = {
    INVALID_ARGUMENT: '提交内容不合法，请检查后重试',
    KNOWLEDGE_BASE_NAME_DUPLICATE: '已存在同名知识库，请使用其他名称',
    KNOWLEDGE_BASE_NOT_FOUND: '知识库不存在或已被删除',
    DOCUMENT_NOT_FOUND: '文档不存在或已被删除',
    EMPTY_FILE: '不能上传空文件',
    FILE_TOO_LARGE: '文件超过服务端配置的大小限制',
    UNSUPPORTED_FILE_TYPE: '仅支持 PDF、DOCX、Markdown 和 TXT 文件',
    INVALID_FILE_NAME: '文件名不安全，请修改后重试',
    FILE_STORAGE_ERROR: '文件存储失败，请稍后重试',
    INTERNAL_ERROR: '业务服务发生内部错误，请稍后重试',
  }
  return messages[code] ?? (fallback || '业务请求失败')
}
