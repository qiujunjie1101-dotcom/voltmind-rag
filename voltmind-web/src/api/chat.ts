import { describeApiFailure } from '@/lib/api-error'
import { http } from '@/lib/http'

/** 与后端契约一致，见 workspace《AI 服务接口契约》。 */
export const CHAT_PATH = '/api/v1/chat'
export const QUESTION_MAX_LENGTH = 2000

interface ChatResponse {
  answer: string
}

/** 本次请求使用的模型：两个 ID 都来自「设置 → 模型服务」里已保存的条目。 */
export interface ChatModelSelection {
  providerId: string
  modelId: string
}

/** 面向用户的请求失败信息，message 可直接展示在界面上。 */
export class ChatRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatRequestError'
  }
}

/**
 * 发送单轮问题，返回模型回答。失败时抛出 ChatRequestError。
 *
 * 不传 selection 时由后端使用环境变量里的默认模型；
 * 请求体里只有条目 ID，模型与地址由后端从已保存配置里解析。
 */
export async function sendQuestion(
  question: string,
  selection?: ChatModelSelection | null,
): Promise<string> {
  const payload: { question: string; provider_id?: string; model_id?: string } = { question }
  if (selection) {
    payload.provider_id = selection.providerId
    payload.model_id = selection.modelId
  }

  try {
    const { data } = await http.post<ChatResponse>(CHAT_PATH, payload)
    return data.answer
  } catch (error) {
    throw new ChatRequestError(describeApiFailure(error, CHAT_PATH))
  }
}
