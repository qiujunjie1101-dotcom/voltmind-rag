<script setup lang="ts">
import { X } from '@lucide/vue'
import { computed } from 'vue'

import ThemeToggle from '@/components/ThemeToggle.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { navigation, type NavItem } from '@/lib/navigation'

const props = defineProps<{
  activeKey: string
  open: boolean
}>()

const emit = defineEmits<{
  select: [key: string]
  close: []
}>()

const sidebarClass = computed(() =>
  cn(
    // 半透明：让工作台的背景图透过来；不做模糊，保持背景图整体清晰
    'bg-sidebar/85 text-sidebar-foreground border-sidebar-border fixed inset-y-0 left-0 z-40 flex w-[264px] flex-col border-r transition-transform duration-200 lg:static lg:translate-x-0',
    props.open ? 'translate-x-0' : '-translate-x-full',
  ),
)

function navItemClass(item: NavItem): string {
  const base =
    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors disabled:cursor-not-allowed'

  if (!item.view) {
    return cn(base, 'text-muted-foreground/70')
  }

  if (item.key === props.activeKey) {
    return cn(base, 'bg-sidebar-accent text-sidebar-accent-foreground font-medium')
  }

  return cn(
    base,
    'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
  )
}
</script>

<template>
  <aside :class="sidebarClass" aria-label="主导航">
    <div class="border-sidebar-border flex h-14 shrink-0 items-center gap-2.5 border-b px-4">
      <img
        src="/brand/voltmind-mark.png"
        alt=""
        width="41"
        height="28"
        class="h-7 w-auto shrink-0"
        aria-hidden="true"
      />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm leading-tight font-semibold">VoltMind</span>
        <span class="text-muted-foreground block truncate text-[11px] leading-tight">
          AI 工作台
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        class="lg:hidden"
        aria-label="关闭导航"
        @click="emit('close')"
      >
        <X />
      </Button>
    </div>

    <nav class="scrollbar-slim flex-1 overflow-y-auto px-3 py-4">
      <div v-for="section in navigation" :key="section.label" class="mb-5 last:mb-0">
        <p class="text-muted-foreground mb-1.5 px-2 text-[11px] font-medium tracking-wide">
          {{ section.label }}
        </p>
        <ul class="space-y-0.5">
          <li v-for="item in section.items" :key="item.key">
            <button
              type="button"
              :class="navItemClass(item)"
              :disabled="!item.view"
              :aria-current="item.key === activeKey ? 'page' : undefined"
              @click="item.view ? emit('select', item.key) : undefined"
            >
              <component :is="item.icon" class="size-4 shrink-0" />
              <span class="flex-1 truncate text-left">{{ item.label }}</span>
              <Badge v-if="item.status === 'planned'" variant="muted" class="text-[10px]">
                规划中
              </Badge>
            </button>
          </li>
        </ul>
      </div>
    </nav>

    <div class="border-sidebar-border flex items-center gap-1 border-t px-3 py-2.5">
      <ThemeToggle />
      <div class="min-w-0 flex-1 px-1">
        <p class="truncate text-xs font-medium">已接入 API</p>
        <p class="text-muted-foreground truncate text-[11px]">单轮问答 · 模型可选</p>
      </div>
      <Badge variant="outline">v0.1.0</Badge>
    </div>
  </aside>
</template>
