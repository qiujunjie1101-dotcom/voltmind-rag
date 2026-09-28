<script setup lang="ts">
import { KeyRound, Pencil, Plus, RefreshCw, ShieldCheck, Trash2 } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import { ProviderRequestError, type Provider, type ProviderInput } from '@/api/providers'
import ProviderForm from '@/components/model-service/ProviderForm.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  catalogError,
  isLoadingCatalog,
  providerList,
  refreshCatalog,
  removeProvider,
  saveProvider,
} from '@/composables/use-model-catalog'

/**
 * 「设置 → 模型服务」：供应商列表与增删改。
 *
 * 后端不下发明文密钥，这里展示的是「是否已配置」与脱敏串，
 * 编辑时留空表示不修改已保存的密钥。
 */

const creating = ref(false)
const editingProvider = ref<Provider | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const rowError = ref<string | null>(null)
// 删除是不可逆操作，用两步确认替代浏览器原生 confirm
const pendingDeleteId = ref<string | null>(null)

const isFormOpen = () => creating.value || editingProvider.value !== null

onMounted(() => {
  void refreshCatalog()
})

function openCreate() {
  editingProvider.value = null
  creating.value = true
  formError.value = null
  rowError.value = null
}

function openEdit(provider: Provider) {
  creating.value = false
  editingProvider.value = provider
  formError.value = null
  rowError.value = null
}

function closeForm() {
  creating.value = false
  editingProvider.value = null
  formError.value = null
}

async function handleSubmit(input: ProviderInput) {
  submitting.value = true
  formError.value = null
  try {
    await saveProvider(editingProvider.value?.id ?? null, input)
    closeForm()
  } catch (error) {
    formError.value = describe(error, '保存失败，请重试')
  } finally {
    submitting.value = false
  }
}

async function confirmDelete(provider: Provider) {
  pendingDeleteId.value = null
  rowError.value = null
  try {
    await removeProvider(provider.id)
    if (editingProvider.value?.id === provider.id) closeForm()
  } catch (error) {
    rowError.value = describe(error, '删除失败，请重试')
  }
}

function describe(error: unknown, fallback: string): string {
  return error instanceof ProviderRequestError ? error.message : fallback
}
</script>

<template>
  <Card>
    <CardHeader class="flex-row items-start justify-between gap-3">
      <div class="min-w-0">
        <CardTitle>模型服务</CardTitle>
        <CardDescription class="mt-1">
          配置 OpenAI 兼容的模型服务，对话页的模型选择器会动态展示这里配置的模型。
        </CardDescription>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          :disabled="isLoadingCatalog"
          title="重新读取服务端配置"
          @click="refreshCatalog"
        >
          <RefreshCw :class="isLoadingCatalog ? 'animate-spin' : undefined" />
          刷新
        </Button>
        <Button size="sm" :disabled="isFormOpen()" @click="openCreate">
          <Plus />
          新增供应商
        </Button>
      </div>
    </CardHeader>

    <CardContent class="space-y-3">
      <div
        v-if="catalogError"
        class="border-destructive/35 bg-destructive/8 flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
      >
        <p class="text-destructive text-xs">{{ catalogError }}</p>
        <Button variant="outline" size="sm" @click="refreshCatalog">重试</Button>
      </div>

      <ProviderForm
        v-if="isFormOpen()"
        :provider="editingProvider"
        :submitting="submitting"
        :error="formError"
        @submit="handleSubmit"
        @cancel="closeForm"
      />

      <p v-if="isLoadingCatalog && providerList.length === 0" class="text-muted-foreground text-xs">
        正在加载模型服务配置…
      </p>

      <ul v-else class="space-y-2">
        <li
          v-for="provider in providerList"
          :key="provider.id"
          class="border-border rounded-lg border p-3"
        >
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="truncate text-sm font-medium">{{ provider.name }}</span>
                <Badge v-if="provider.is_builtin" variant="outline">内置</Badge>
                <Badge :variant="provider.api_key_configured ? 'success' : 'muted'">
                  <ShieldCheck v-if="provider.api_key_configured" />
                  {{ provider.api_key_configured ? '密钥已配置' : '未配置密钥' }}
                </Badge>
              </div>

              <p
                class="text-muted-foreground truncate font-mono text-xs"
                :title="provider.base_url"
              >
                {{ provider.base_url }}
              </p>

              <p class="text-muted-foreground flex items-center gap-1.5 text-xs">
                <KeyRound class="size-3 shrink-0" />
                <span class="font-mono">{{ provider.api_key_masked ?? '未保存密钥' }}</span>
              </p>

              <div class="flex flex-wrap gap-1 pt-0.5">
                <Badge v-for="model in provider.models" :key="model.id" variant="secondary">
                  {{ model.name }}
                </Badge>
              </div>
            </div>

            <div v-if="!provider.is_builtin" class="flex shrink-0 items-center gap-1">
              <template v-if="pendingDeleteId === provider.id">
                <Button variant="destructive" size="sm" @click="confirmDelete(provider)">
                  确认删除
                </Button>
                <Button variant="ghost" size="sm" @click="pendingDeleteId = null">取消</Button>
              </template>
              <template v-else>
                <Button variant="ghost" size="sm" @click="openEdit(provider)">
                  <Pencil />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  :title="`删除供应商 ${provider.name}`"
                  @click="pendingDeleteId = provider.id"
                >
                  <Trash2 />
                  删除
                </Button>
              </template>
            </div>

            <Badge v-else variant="muted" title="内置供应商来自 ai-service/.env，需改环境变量">
              只读
            </Badge>
          </div>
        </li>
      </ul>

      <p
        v-if="rowError"
        class="border-destructive/35 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-xs"
      >
        {{ rowError }}
      </p>

      <p class="text-muted-foreground text-xs">
        内置供应商由 <code class="font-mono">ai-service/.env</code> 提供，只读；其余供应商的 API Key
        在服务端加密落盘，接口只回脱敏状态，前端不接触明文。
      </p>
    </CardContent>
  </Card>
</template>
