import { describeApiFailure } from '@/lib/api-error'
import { http } from '@/lib/http'

/** 与后端契约一致，见 workspace《AI 服务接口契约》。 */
export const PROVIDERS_PATH = '/api/v1/providers'
export const MODELS_PATH = '/api/v1/models'

export const PROVIDER_NAME_MAX_LENGTH = 40
export const MAX_MODELS_PER_PROVIDER = 50

/** 供应商下的模型。id 是后端生成的条目 ID，对话请求回传它。 */
export interface ProviderModel {
  id: string
  /** 上游模型 ID，例如 gpt-4o-mini */
  model: string
  /** 展示名称 */
  name: string
}

/** 提交给后端的模型条目；name 省略时后端用 model 兜底。 */
export interface ProviderModelInput {
  model: string
  name?: string
}

export interface Provider {
  id: string
  name: string
  base_url: string
  protocol: string
  /** 后端是否已保存可用密钥；前端只拿得到这个状态与脱敏串 */
  api_key_configured: boolean
  api_key_masked: string | null
  models: ProviderModel[]
  created_at: string
  updated_at: string
  /** 环境变量提供的内置供应商，不可编辑或删除 */
  is_builtin: boolean
}

export interface ProviderInput {
  name: string
  base_url: string
  /** 新增时必填；编辑时省略表示沿用已保存的密钥 */
  api_key?: string
  models: ProviderModelInput[]
}

/** 对话页模型选择器的选项。 */
export interface ModelOption {
  provider_id: string
  provider_name: string
  model_id: string
  model: string
  name: string
  is_default: boolean
}

export interface ModelOptionList {
  models: ModelOption[]
  default_provider_id: string | null
  default_model_id: string | null
}

interface ProviderListResponse {
  providers: Provider[]
}

/** 面向用户的请求失败信息，message 可直接展示在界面上。 */
export class ProviderRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderRequestError'
  }
}

/** 统一的失败包装：所有供应商接口失败都抛 ProviderRequestError。 */
async function request<T>(path: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action()
  } catch (error) {
    throw new ProviderRequestError(describeApiFailure(error, path))
  }
}

export async function listProviders(): Promise<Provider[]> {
  return request(PROVIDERS_PATH, async () => {
    const { data } = await http.get<ProviderListResponse>(PROVIDERS_PATH)
    return data.providers
  })
}

export async function createProvider(input: ProviderInput): Promise<Provider> {
  return request(PROVIDERS_PATH, async () => {
    const { data } = await http.post<Provider>(PROVIDERS_PATH, input)
    return data
  })
}

export async function updateProvider(id: string, input: ProviderInput): Promise<Provider> {
  const path = `${PROVIDERS_PATH}/${encodeURIComponent(id)}`
  return request(path, async () => {
    const { data } = await http.put<Provider>(path, input)
    return data
  })
}

export async function deleteProvider(id: string): Promise<void> {
  const path = `${PROVIDERS_PATH}/${encodeURIComponent(id)}`
  return request(path, async () => {
    await http.delete(path)
  })
}

export async function listModelOptions(): Promise<ModelOptionList> {
  return request(MODELS_PATH, async () => {
    const { data } = await http.get<ModelOptionList>(MODELS_PATH)
    return data
  })
}
