import { computed, ref } from 'vue'

import type { ChatModelSelection } from '@/api/chat'
import {
  ProviderRequestError,
  createProvider,
  deleteProvider,
  listModelOptions,
  listProviders,
  updateProvider,
  type ModelOption,
  type Provider,
  type ProviderInput,
} from '@/api/providers'

/**
 * 模块级单例：设置页与对话页共享同一份模型服务配置。
 *
 * 选择结果只放在内存里，不写 localStorage —— 模型 ID 本身不敏感，
 * 但把服务端已删除的条目持久化下来会带来「选中了一个不存在的模型」的错觉，
 * 每次加载都按后端返回的可用列表重新定位更稳。
 *
 * 密钥全程不在前端出现：这里只有后端给的「是否已配置」与脱敏串。
 */

const providers = ref<Provider[]>([])
const models = ref<ModelOption[]>([])
const isLoading = ref(false)
const error = ref<string | null>(null)
const selectedProviderId = ref<string | null>(null)
const selectedModelId = ref<string | null>(null)

/** 选项的唯一键：供应商 ID 与模型条目 ID 一起才唯一。 */
export function modelKey(option: { provider_id: string; model_id: string }): string {
  return `${option.provider_id}::${option.model_id}`
}

export const isLoadingCatalog = computed(() => isLoading.value)
export const catalogError = computed(() => error.value)
export const providerList = computed(() => providers.value)
export const modelOptions = computed(() => models.value)
export const hasModels = computed(() => models.value.length > 0)

export const selectedKey = computed(() =>
  selectedProviderId.value && selectedModelId.value
    ? `${selectedProviderId.value}::${selectedModelId.value}`
    : '',
)

export const selectedModel = computed(
  () => models.value.find((option) => modelKey(option) === selectedKey.value) ?? null,
)

/** 当前选择的模型参数，未就绪时为 null（此时由后端用环境变量默认模型）。 */
export const currentSelection = computed<ChatModelSelection | null>(() => {
  if (!selectedProviderId.value || !selectedModelId.value) return null
  return { providerId: selectedProviderId.value, modelId: selectedModelId.value }
})

function applyKey(key: string) {
  const separator = key.indexOf('::')
  if (separator <= 0) return
  selectedProviderId.value = key.slice(0, separator)
  selectedModelId.value = key.slice(separator + 2)
}

function clearSelection() {
  selectedProviderId.value = null
  selectedModelId.value = null
}

/** 切换模型；键不在可用列表里则忽略，避免前后端选择不一致。 */
export function selectModelByKey(key: string) {
  if (!models.value.some((option) => modelKey(option) === key)) return
  applyKey(key)
}

/**
 * 加载供应商列表与可用模型。
 *
 * 选择会被重新定位：**先保留用户已经选好的模型**（只要它还在可用列表里），
 * 其次才用后端给的默认模型，最后退到列表第一项。
 * 顺序不能反：每次进入对话页都会刷新目录，若默认模型优先，
 * 用户在设置页改完再回来就会被悄悄换回默认模型。
 */
export async function refreshCatalog(): Promise<void> {
  isLoading.value = true
  error.value = null
  try {
    const [providerItems, optionList] = await Promise.all([listProviders(), listModelOptions()])
    providers.value = providerItems
    models.value = optionList.models
    ensureSelection(optionList.default_provider_id, optionList.default_model_id)
  } catch (caught) {
    providers.value = []
    models.value = []
    clearSelection()
    error.value = caught instanceof ProviderRequestError ? caught.message : '加载模型服务配置失败'
  } finally {
    isLoading.value = false
  }
}

function ensureSelection(preferredProviderId: string | null, preferredModelId: string | null) {
  if (models.value.length === 0) {
    clearSelection()
    return
  }

  const available = new Set(models.value.map(modelKey))
  // 1. 用户已选且仍可用：保持不动
  if (selectedKey.value && available.has(selectedKey.value)) {
    return
  }
  // 2. 后端默认模型
  const preferred =
    preferredProviderId && preferredModelId ? `${preferredProviderId}::${preferredModelId}` : ''
  if (preferred && available.has(preferred)) {
    applyKey(preferred)
    return
  }
  // 3. 列表第一项
  const first = models.value[0]
  if (first) applyKey(modelKey(first))
}

/** 新增或编辑供应商，成功后刷新目录；失败原样抛出，由表单展示错误。 */
export async function saveProvider(
  providerId: string | null,
  input: ProviderInput,
): Promise<void> {
  if (providerId) {
    await updateProvider(providerId, input)
  } else {
    await createProvider(input)
  }
  await refreshCatalog()
}

/** 删除供应商，成功后刷新目录；失败原样抛出，由调用方展示错误。 */
export async function removeProvider(providerId: string): Promise<void> {
  await deleteProvider(providerId)
  await refreshCatalog()
}
