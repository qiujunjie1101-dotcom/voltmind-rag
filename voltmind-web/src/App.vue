<script setup lang="ts">
import { Menu, Sparkles } from '@lucide/vue'
import { computed, ref } from 'vue'

import AppSidebar from '@/components/AppSidebar.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { activeNavKey, findNavItem, selectNav, type ViewKey } from '@/lib/navigation'
import ChatView from '@/views/ChatView.vue'
import KnowledgeView from '@/views/KnowledgeView.vue'
import SettingsView from '@/views/SettingsView.vue'

const views = {
  chat: ChatView,
  knowledge: KnowledgeView,
  settings: SettingsView,
} as const satisfies Record<ViewKey, unknown>

const sidebarOpen = ref(false)

const activeItem = computed(() => findNavItem(activeNavKey.value))
const activeView = computed<ViewKey>(() => activeItem.value?.view ?? 'chat')

function selectNavItem(key: string) {
  selectNav(key)
  sidebarOpen.value = false
}
</script>

<template>
  <div class="relative flex h-full">
    <!-- 背景图与遮罩都是独立的固定层：不参与滚动，也不接收指针事件 -->
    <div
      class="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
      style="background-image: url('/backgrounds/snow-winter.jpeg')"
      aria-hidden="true"
    />
    <!--
      遮罩用 bg-background 的半透明色压在图上，只做淡化、不做虚化：
      照片保持清晰，靠浓度保证正文与气泡的对比度；暗色下压得更重一些，
      避免亮色照片刺眼。内容整体抬到 z-10，遮罩留在 z-0，两者分层。
    -->
    <div
      class="bg-background/70 dark:bg-background/72 pointer-events-none fixed inset-0 z-0"
      aria-hidden="true"
    />

    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
      aria-hidden="true"
      @click="sidebarOpen = false"
    />

    <div class="relative z-10 flex h-full w-full">
      <AppSidebar
        :active-key="activeNavKey"
        :open="sidebarOpen"
        @select="selectNavItem"
        @close="sidebarOpen = false"
      />

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="bg-background/85 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b px-4 backdrop-blur lg:px-6"
        >
          <Button
            variant="ghost"
            size="icon"
            class="lg:hidden"
            aria-label="打开导航"
            @click="sidebarOpen = true"
          >
            <Menu />
          </Button>

          <div class="min-w-0 flex-1">
            <h1 class="truncate text-sm font-semibold">{{ activeItem?.label }}</h1>
            <p class="text-muted-foreground truncate text-xs">{{ activeItem?.description }}</p>
          </div>

          <Badge variant="success" class="hidden sm:inline-flex">
            <Sparkles />
            已接入 API
          </Badge>
        </header>

        <main class="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
          <component :is="views[activeView]" />
        </main>
      </div>
    </div>
  </div>
</template>
