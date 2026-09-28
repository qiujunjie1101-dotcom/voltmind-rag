<script setup lang="ts">
import { Plus, Trash2, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import {
  MAX_MODELS_PER_PROVIDER,
  PROVIDER_NAME_MAX_LENGTH,
  type Provider,
  type ProviderInput,
} from '@/api/providers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * 供应商新增/编辑表单。
 *
 * 只负责收集与校验，保存请求交给父组件；
 * API Key 只在提交时随请求体发一次，不写 localStorage、不写 URL。
 */

interface ModelDraft {
  key: number
  model: string
  name: string
}

const props = defineProps<{
  /** null 表示新增 */
  provider: Provider | null
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{
  submit: [input: ProviderInput]
  cancel: []
}>()

const isEditing = computed(() => props.provider !== null)

let nextRowKey = 1
function emptyRow(): ModelDraft {
  return { key: nextRowKey++, model: '', name: '' }
}

const name = ref('')
const baseUrl = ref('')
const apiKey = ref('')
const rows = ref<ModelDraft[]>([emptyRow()])
const localError = ref<string | null>(null)

function reset(provider: Provider | null) {
  name.value = provider?.name ?? ''
  baseUrl.value = provider?.base_url ?? ''
  apiKey.value = ''
  rows.value =
    provider && provider.models.length > 0
      ? provider.models.map((model) => ({
          key: nextRowKey++,
          model: model.model,
          name: model.name,
        }))
      : [emptyRow()]
  localError.value = null
}

watch(() => props.provider, reset, { immediate: true })

const canAddRow = computed(() => rows.value.length < MAX_MODELS_PER_PROVIDER)

function addRow() {
  if (!canAddRow.value) return
  rows.value.push(emptyRow())
}

function removeRow(key: number) {
  // 至少保留一行，避免出现没有任何输入的空白表单
  if (rows.value.length <= 1) {
    rows.value = [emptyRow()]
    return
  }
  rows.value = rows.value.filter((row) => row.key !== key)
}

/** 收集有效模型行：模型 ID 为空的整行忽略。 */
function collectModels(): ProviderInput['models'] {
  return rows.value
    .map((row) => ({ model: row.model.trim(), name: row.name.trim() }))
    .filter((row) => row.model.length > 0)
    .map((row) => (row.name ? { model: row.model, name: row.name } : { model: row.model }))
}

function validate(): string | null {
  if (!name.value.trim()) return '请填写供应商名称'
  if (!baseUrl.value.trim()) return '请填写 API Base URL'
  if (!isEditing.value && !apiKey.value.trim()) return '请填写 API Key'

  const models = collectModels()
  if (models.length === 0) return '请至少添加一个模型'

  const seen = new Set<string>()
  for (const model of models) {
    const key = model.model.toLowerCase()
    if (seen.has(key)) return `模型 ID「${model.model}」重复，请只保留一条`
    seen.add(key)
  }
  return null
}

function submit() {
  const problem = validate()
  if (problem) {
    localError.value = problem
    return
  }

  localError.value = null
  const input: ProviderInput = {
    name: name.value.trim(),
    base_url: baseUrl.value.trim(),
    models: collectModels(),
  }
  // 编辑时留空代表沿用已保存的密钥，不提交空字符串
  const key = apiKey.value.trim()
  if (key) input.api_key = key

  emit('submit', input)
}
</script>

<template>
  <form
    class="border-border bg-muted/30 space-y-4 rounded-lg border p-4"
    @submit.prevent="submit"
  >
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="text-sm font-medium">{{ isEditing ? '编辑供应商' : '新增供应商' }}</p>
        <p class="text-muted-foreground mt-0.5 text-xs">
          初期支持 OpenAI 兼容接口。Base URL 需公网可达，指向内网会被服务端拒绝。
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="关闭表单"
        :disabled="submitting"
        @click="emit('cancel')"
      >
        <X />
      </Button>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <div class="space-y-1.5">
        <label for="provider-name" class="text-xs font-medium">供应商名称</label>
        <Input
          id="provider-name"
          v-model="name"
          :maxlength="PROVIDER_NAME_MAX_LENGTH"
          placeholder="例如：我的中转站"
          autocomplete="off"
        />
      </div>

      <div class="space-y-1.5">
        <label for="provider-base-url" class="text-xs font-medium">API Base URL</label>
        <Input
          id="provider-base-url"
          v-model="baseUrl"
          placeholder="https://api.example.com/v1"
          autocomplete="off"
          spellcheck="false"
        />
      </div>
    </div>

    <div class="space-y-1.5">
      <label for="provider-api-key" class="text-xs font-medium">API Key</label>
      <Input
        id="provider-api-key"
        v-model="apiKey"
        type="password"
        autocomplete="new-password"
        :placeholder="isEditing ? '留空表示不修改已保存的密钥' : '粘贴该供应商的 API Key'"
      />
      <p class="text-muted-foreground text-[11px]">
        密钥只提交给后端并加密保存，前端不写入 localStorage，也不会回显。
      </p>
    </div>

    <div class="space-y-2">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-medium">模型列表</p>
        <Button type="button" variant="outline" size="sm" :disabled="!canAddRow" @click="addRow">
          <Plus />
          添加模型
        </Button>
      </div>

      <div v-for="row in rows" :key="row.key" class="flex items-center gap-2">
        <Input
          v-model="row.model"
          placeholder="模型 ID，如 gpt-4o-mini"
          autocomplete="off"
          spellcheck="false"
          aria-label="模型 ID"
        />
        <Input
          v-model="row.name"
          placeholder="显示名称，留空用模型 ID"
          autocomplete="off"
          aria-label="模型显示名称"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="删除该模型"
          @click="removeRow(row.key)"
        >
          <Trash2 />
        </Button>
      </div>
      <p class="text-muted-foreground text-[11px]">
        最多 {{ MAX_MODELS_PER_PROVIDER }} 个模型；模型 ID 会原样发给上游，需与供应商文档一致。
      </p>
    </div>

    <p
      v-if="localError || error"
      class="border-destructive/35 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-xs"
    >
      {{ localError ?? error }}
    </p>

    <div class="flex items-center justify-end gap-2">
      <Button type="button" variant="ghost" size="sm" :disabled="submitting" @click="emit('cancel')">
        取消
      </Button>
      <Button type="submit" size="sm" :disabled="submitting">
        {{ submitting ? '保存中…' : '保存' }}
      </Button>
    </div>
  </form>
</template>
