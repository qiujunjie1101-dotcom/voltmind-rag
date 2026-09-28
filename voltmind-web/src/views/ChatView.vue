<script setup lang="ts">
import { Bot, LoaderCircle, Send, Settings2, TriangleAlert, User } from '@lucide/vue'
import { computed, nextTick, onMounted, ref } from 'vue'

import { ChatRequestError, QUESTION_MAX_LENGTH, sendQuestion } from '@/api/chat'
import type { ModelOption } from '@/api/providers'
import ModelSelect from '@/components/chat/ModelSelect.vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  currentSelection,
  hasModels,
  isLoadingCatalog,
  modelOptions,
  refreshCatalog,
  selectModelByKey,
  selectedKey,
  selectedModel,
} from '@/composables/use-model-catalog'
import { selectNav } from '@/lib/navigation'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  /** 回答该条消息的模型，便于切换后回看 */
  model?: string
  /** 请求失败时的提示，用错误样式区分 */
  failed?: boolean
}

const messages = ref<ChatMessage[]>([])
const draft = ref('')
const isSending = ref(false)
const bottomAnchor = ref<HTMLElement | null>(null)
let nextId = 1

// 模型列表来自服务端已保存的配置，进入页面就刷新一次
onMounted(() => {
  void refreshCatalog()
})

const canSubmit = computed(
  () => !isSending.value && draft.value.trim().length > 0 && hasModels.value,
)

/** 按供应商分组交给选择器渲染，避免不同供应商的同名模型无法区分。 */
const groupedModels = computed(() => {
  const groups = new Map<
    string,
    { providerId: string; providerName: string; options: ModelOption[] }
  >()
  for (const option of modelOptions.value) {
    const group = groups.get(option.provider_id) ?? {
      providerId: option.provider_id,
      providerName: option.provider_name,
      options: [],
    }
    group.options.push(option)
    groups.set(option.provider_id, group)
  }
  return [...groups.values()]
})

// 只展示模型名：供应商来源在选择器分组里已经表达过，叠在模型名后面是冗余
const currentModelLabel = computed(() => selectedModel.value?.name ?? '未选择模型')

async function scrollToBottom() {
  await nextTick()
  // scrollIntoView 会自动滚动最近的滚动容器，不必耦合外层布局
  bottomAnchor.value?.scrollIntoView({ block: 'end' })
}

async function submit() {
  // 请求进行中直接返回，这是防重复提交的兜底；
  // 发送按钮同时处于 disabled，两条防线避免并发请求
  if (!canSubmit.value) return

  const question = draft.value.trim()
  // 记录本次使用的模型名，回答回来时即使已切换模型也能看清来源
  const modelName = selectedModel.value?.name
  messages.value.push({ id: nextId++, role: 'user', content: question })
  draft.value = ''
  isSending.value = true
  await scrollToBottom()

  try {
    const answer = await sendQuestion(question, currentSelection.value)
    messages.value.push({ id: nextId++, role: 'assistant', content: answer, model: modelName })
  } catch (error) {
    const content = error instanceof ChatRequestError ? error.message : '请求失败，请稍后重试'
    messages.value.push({ id: nextId++, role: 'assistant', content, failed: true })
  } finally {
    isSending.value = false
    await scrollToBottom()
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey) return
  // 中文等输入法候选未结束时，Enter 用于确认候选，不应触发发送
  if (event.isComposing) return
  event.preventDefault()
  void submit()
}

function avatarClass(message: ChatMessage): string {
  if (message.failed) {
    return 'bg-destructive/12 text-destructive flex size-7 shrink-0 items-center justify-center rounded-full'
  }
  return cn(
    'flex size-7 shrink-0 items-center justify-center rounded-full',
    message.role === 'assistant'
      ? 'bg-primary text-primary-foreground'
      : 'bg-secondary text-secondary-foreground',
  )
}

function bubbleClass(message: ChatMessage): string {
  if (message.failed) {
    return 'border-destructive/35 bg-destructive/8 text-foreground rounded-xl border px-3.5 py-2.5'
  }
  return cn(
    'rounded-xl px-3.5 py-2.5',
    message.role === 'assistant'
      ? 'bg-card border-border border shadow-sm'
      : 'bg-secondary text-secondary-foreground',
  )
}

function messageLabel(message: ChatMessage): string {
  if (message.failed) return '请求失败'
  if (message.role === 'user') return '我'
  return message.model ? `VoltMind · ${message.model}` : 'VoltMind'
}
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6 lg:px-6 lg:py-8">
      <div
        v-if="!hasModels && !isLoadingCatalog"
        class="border-destructive/35 bg-destructive/8 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
        role="status"
      >
        <p class="text-destructive flex items-start gap-2 text-xs">
          <TriangleAlert class="mt-0.5 size-3.5 shrink-0" />
          <span>暂无可用模型：请先在「设置 → 模型服务」中配置供应商与模型。</span>
        </p>
        <Button variant="outline" size="sm" @click="selectNav('settings')">
          <Settings2 />
          去设置
        </Button>
      </div>

      <section
        v-if="messages.length > 0"
        class="space-y-5"
        aria-label="对话内容"
        aria-live="polite"
      >
        <article v-for="message in messages" :key="message.id" class="flex gap-3">
          <span :class="avatarClass(message)">
            <TriangleAlert v-if="message.failed" class="size-3.5" />
            <Bot v-else-if="message.role === 'assistant'" class="size-3.5" />
            <User v-else class="size-3.5" />
          </span>

          <div class="min-w-0 flex-1 space-y-1.5">
            <p class="text-muted-foreground text-xs font-medium">{{ messageLabel(message) }}</p>
            <div :class="bubbleClass(message)">
              <p class="text-sm leading-relaxed whitespace-pre-line">{{ message.content }}</p>
            </div>
          </div>
        </article>

        <article v-if="isSending" class="flex gap-3" aria-label="VoltMind 正在思考">
          <span
            class="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-full"
          >
            <Bot class="size-3.5" />
          </span>
          <div class="min-w-0 flex-1 space-y-1.5">
            <p class="text-muted-foreground text-xs font-medium">VoltMind</p>
            <div
              class="bg-card border-border flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 shadow-sm"
            >
              <span class="flex gap-1" aria-hidden="true">
                <span
                  class="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.3s]"
                />
                <span
                  class="bg-muted-foreground size-1.5 animate-bounce rounded-full [animation-delay:-0.15s]"
                />
                <span class="bg-muted-foreground size-1.5 animate-bounce rounded-full" />
              </span>
              <span class="text-muted-foreground text-xs">正在思考…</span>
            </div>
          </div>
        </article>
      </section>

      <section
        v-else
        class="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center"
      >
        <img
          src="/brand/voltmind-mark.png"
          alt=""
          width="41"
          height="28"
          class="h-8 w-auto"
          aria-hidden="true"
        />
        <p class="text-foreground text-sm font-medium">向 VoltMind 提问</p>
        <p class="text-xs">输入问题后按 Enter 发送，Shift + Enter 换行。</p>
        <p v-if="hasModels" class="text-xs">
          当前模型：<span class="text-foreground font-medium">{{ currentModelLabel }}</span>
        </p>
      </section>

      <div ref="bottomAnchor" aria-hidden="true" />
    </div>

    <div class="bg-background/85 sticky bottom-0 border-t backdrop-blur">
      <div class="mx-auto w-full max-w-3xl px-4 py-4 lg:px-6">
        <div
          class="border-input bg-card focus-within:border-ring focus-within:ring-ring/30 rounded-xl border shadow-sm transition focus-within:ring-2"
        >
          <Textarea
            v-model="draft"
            :rows="2"
            :maxlength="QUESTION_MAX_LENGTH"
            :placeholder="hasModels ? '输入问题，向 VoltMind 提问…' : '请先配置模型服务…'"
            class="min-h-[68px] resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
            aria-label="问题输入框"
            @keydown="handleKeydown"
          />
          <div class="flex items-center gap-3 px-3 pb-2.5">
            <!-- 模型选择与发送同处输入区工具行：两者都是「这条消息怎么发」的开关 -->
            <ModelSelect
              v-if="hasModels"
              :groups="groupedModels"
              :model-value="selectedKey"
              @select="selectModelByKey"
            />

            <p class="text-muted-foreground hidden min-w-0 flex-1 truncate text-[11px] sm:block">
              Enter 发送 · Shift + Enter 换行
            </p>

            <Button
              class="ml-auto shrink-0"
              size="sm"
              :disabled="!canSubmit"
              :title="isSending ? '请求进行中，请稍候' : '发送问题'"
              @click="submit"
            >
              <LoaderCircle v-if="isSending" class="animate-spin" />
              <Send v-else />
              {{ isSending ? '发送中' : '发送' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
