<script setup lang="ts">
import { LoaderCircle, X } from '@lucide/vue'
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'
import { reactive, ref, watch } from 'vue'

import type { KnowledgeBase, KnowledgeBaseInput } from '@/api/knowledge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

const props = defineProps<{
  open: boolean
  knowledgeBase: KnowledgeBase | null
  submitting: boolean
  error: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [value: KnowledgeBaseInput]
}>()

const draft = reactive({ name: '', description: '' })
const validationError = ref('')

watch(
  () => [props.open, props.knowledgeBase] as const,
  ([open, knowledgeBase]) => {
    if (!open) return
    draft.name = knowledgeBase?.name ?? ''
    draft.description = knowledgeBase?.description ?? ''
    validationError.value = ''
  },
  { immediate: true },
)

function submit() {
  const name = draft.name.trim()
  const description = draft.description.trim()
  if (!name) {
    validationError.value = '请输入知识库名称'
    return
  }
  if (name.length > 128) {
    validationError.value = '知识库名称不能超过 128 个字符'
    return
  }
  if (description.length > 10000) {
    validationError.value = '描述不能超过 10000 个字符'
    return
  }
  validationError.value = ''
  emit('submit', { name, description })
}
</script>

<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]" />
      <DialogContent
        class="border-border bg-card text-card-foreground fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-xl focus:outline-none"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <DialogTitle class="text-base font-semibold">
              {{ knowledgeBase ? '编辑知识库' : '新建知识库' }}
            </DialogTitle>
            <DialogDescription class="text-muted-foreground mt-1 text-xs">
              名称用于区分知识范围，描述可补充资料用途与维护范围。
            </DialogDescription>
          </div>
          <button
            type="button"
            class="text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md"
            aria-label="关闭"
            :disabled="submitting"
            @click="emit('update:open', false)"
          >
            <X class="size-4" />
          </button>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="submit">
          <label class="block space-y-1.5">
            <span class="text-sm font-medium">名称</span>
            <Input
              v-model="draft.name"
              autofocus
              maxlength="128"
              placeholder="例如：产品与技术资料"
              :disabled="submitting"
            />
          </label>
          <label class="block space-y-1.5">
            <span class="text-sm font-medium">描述</span>
            <Textarea
              v-model="draft.description"
              maxlength="10000"
              placeholder="可选，说明这个知识库收录什么内容"
              :disabled="submitting"
              class="min-h-24 resize-y"
            />
          </label>

          <p
            v-if="validationError || error"
            class="border-destructive/35 bg-destructive/8 text-destructive rounded-md border px-3 py-2 text-xs"
            role="alert"
          >
            {{ validationError || error }}
          </p>

          <div class="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              :disabled="submitting"
              @click="emit('update:open', false)"
            >
              取消
            </Button>
            <Button type="submit" :disabled="submitting">
              <LoaderCircle v-if="submitting" class="animate-spin" />
              {{ submitting ? '保存中' : '保存' }}
            </Button>
          </div>
        </form>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
