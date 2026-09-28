<script setup lang="ts">
import { Moon, Server, Sun } from '@lucide/vue'
import { computed } from 'vue'

import ModelServiceCard from '@/components/model-service/ModelServiceCard.vue'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isDark } from '@/composables/use-theme'
import { apiBaseUrl, apiTimeoutMs } from '@/lib/env'
import { cn } from '@/lib/utils'

const themeOptions = [
  { label: '浅色', icon: Sun, value: false },
  { label: '深色', icon: Moon, value: true },
]

const timeoutSeconds = computed(() => Math.round(apiTimeoutMs / 1000))

function applyTheme(value: boolean) {
  isDark.value = value
}
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 lg:px-6 lg:py-8">
    <Card>
      <CardHeader>
        <CardTitle>外观</CardTitle>
        <CardDescription>主题立即生效，选择会保存在浏览器本地。</CardDescription>
      </CardHeader>
      <CardContent>
        <div class="grid gap-2 sm:grid-cols-2" role="group" aria-label="主题选择">
          <button
            v-for="option in themeOptions"
            :key="option.label"
            type="button"
            :aria-pressed="isDark === option.value"
            :class="
              cn(
                'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                isDark === option.value
                  ? 'border-primary bg-accent text-accent-foreground font-medium'
                  : 'border-border hover:bg-accent/50',
              )
            "
            @click="applyTheme(option.value)"
          >
            <component :is="option.icon" class="size-4" />
            {{ option.label }}
          </button>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader class="flex-row items-start justify-between gap-3">
        <div class="min-w-0">
          <CardTitle>服务端连接</CardTitle>
          <CardDescription class="mt-1">前端通过 Axios 直连，跨域由后端 CORS 放行。</CardDescription>
        </div>
        <Badge variant="success">已接入</Badge>
      </CardHeader>
      <CardContent class="space-y-3">
        <dl class="divide-border divide-y text-sm">
          <div class="flex items-center justify-between gap-4 py-2.5">
            <dt class="text-muted-foreground">问答接口</dt>
            <dd class="font-mono text-xs">POST /api/v1/chat</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2.5">
            <dt class="text-muted-foreground">模型列表</dt>
            <dd class="font-mono text-xs">GET /api/v1/models</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2.5">
            <dt class="text-muted-foreground">模型服务管理</dt>
            <dd class="font-mono text-xs">/api/v1/providers</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2.5">
            <dt class="text-muted-foreground">健康检查</dt>
            <dd class="font-mono text-xs">GET /health</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2.5">
            <dt class="text-muted-foreground shrink-0">服务地址</dt>
            <dd class="truncate font-mono text-xs" :title="apiBaseUrl">{{ apiBaseUrl }}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-2.5">
            <dt class="text-muted-foreground">请求超时</dt>
            <dd class="font-mono text-xs">{{ timeoutSeconds }} 秒</dd>
          </div>
        </dl>
        <p class="text-muted-foreground flex items-start gap-2 text-xs">
          <Server class="mt-0.5 size-3.5 shrink-0" />
          <span>
            服务地址与超时来自 Vite 环境变量（<code class="font-mono">.env</code>），不写在代码里。
            API Key 只由后端持有：前端不读取、不转发，也不写入 localStorage。
          </span>
        </p>
      </CardContent>
    </Card>

    <ModelServiceCard />

    <Card>
      <CardHeader>
        <CardTitle>关于</CardTitle>
        <CardDescription>VoltMind 多模态智能知识库 · 前端工作台</CardDescription>
      </CardHeader>
      <CardContent class="space-y-2 text-xs">
        <div class="border-border mb-3 flex items-center rounded-lg border bg-white px-3 py-2.5">
          <img src="/brand/voltmind-logo.png" alt="VoltMind" class="h-10 w-auto" />
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-muted-foreground">版本</span>
          <Badge variant="outline">v0.1.0</Badge>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-muted-foreground">技术栈</span>
          <span class="font-mono">Vue 3 · TS · Vite · Tailwind 4 · shadcn-vue · Axios</span>
        </div>
        <div class="flex items-center justify-between gap-4">
          <span class="text-muted-foreground">当前范围</span>
          <span>单轮问答，模型服务可自定义，未接检索与多轮记忆</span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
