<script setup lang="ts">
import { Check, ChevronDown } from '@lucide/vue'
import {
  SelectContent,
  SelectGroup,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectLabel,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from 'reka-ui'

import type { ModelOption } from '@/api/providers'
import { modelKey } from '@/composables/use-model-catalog'

/**
 * 对话页的模型选择器。
 *
 * 用 Reka UI 的 Select 原语而非原生 `<select>`：原生控件的下拉面板由操作系统绘制，
 * 无法定制，做不出与工作台一致的样式；分组、键盘导航与 ARIA 由 Reka UI 负责，
 * 这里只定义外观。选项按供应商分组，组标题即供应商名。
 */

defineProps<{
  groups: { providerId: string; providerName: string; options: ModelOption[] }[]
  modelValue: string
}>()

const emit = defineEmits<{ select: [key: string] }>()
</script>

<template>
  <SelectRoot
    :model-value="modelValue"
    @update:model-value="(value) => emit('select', String(value))"
  >
    <SelectTrigger
      class="group border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/10 focus-visible:border-primary/60 focus-visible:ring-ring/25 data-[state=open]:border-primary/60 data-[state=open]:bg-primary/10 data-[state=open]:ring-ring/25 inline-flex h-7 max-w-[220px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs font-medium shadow-sm transition focus:outline-none focus-visible:ring-2 data-[state=open]:ring-2"
      aria-label="选择模型"
    >
      <span class="bg-primary size-1.5 shrink-0 rounded-full" aria-hidden="true" />
      <SelectValue class="truncate" placeholder="选择模型" />
      <SelectIcon
        class="text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
      >
        <ChevronDown class="size-3.5" />
      </SelectIcon>
    </SelectTrigger>

    <SelectPortal>
      <!-- 触发器在页面底部，固定向上展开，避免与输入框、发送按钮叠在一起 -->
      <SelectContent
        position="popper"
        align="start"
        side="top"
        :side-offset="8"
        class="border-border bg-popover text-popover-foreground shadow-primary/10 z-50 min-w-[220px] overflow-hidden rounded-xl border shadow-xl"
      >
        <SelectViewport class="max-h-72 p-1.5">
          <SelectGroup v-for="group in groups" :key="group.providerId">
            <SelectLabel
              class="text-muted-foreground px-2.5 pt-2 pb-1 text-[10px] font-medium tracking-wide"
            >
              {{ group.providerName }}
            </SelectLabel>
            <SelectItem
              v-for="option in group.options"
              :key="modelKey(option)"
              :value="modelKey(option)"
              class="data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary relative flex cursor-pointer items-center rounded-lg py-2 pr-2.5 pl-7 text-xs outline-none select-none data-[state=checked]:font-medium"
            >
              <SelectItemIndicator class="absolute left-2 inline-flex items-center">
                <Check class="text-primary size-3.5" />
              </SelectItemIndicator>
              <SelectItemText class="truncate">{{ option.name }}</SelectItemText>
            </SelectItem>
          </SelectGroup>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
