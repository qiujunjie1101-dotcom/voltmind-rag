<script setup lang="ts">
import { Activity, Clock, Database, FileText, Plus, Search } from '@lucide/vue'
import type { Component } from 'vue'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

interface StatCard {
  label: string
  value: string
  hint: string
  icon: Component
}

interface DocumentRow {
  name: string
  type: string
  chunks: number
  status: '已索引' | '解析中' | '失败'
  updatedAt: string
}

/** 占位数据：等待文档入库链路实现后替换为真实数据。 */
const stats: StatCard[] = [
  { label: '文档总数', value: '128', hint: '较上周 +12', icon: FileText },
  { label: '向量片段', value: '3,412', hint: '平均 27 段/篇', icon: Database },
  { label: '索引状态', value: '正常', hint: '最近同步 2 小时前', icon: Activity },
  { label: '待处理', value: '3', hint: '解析队列', icon: Clock },
]

const documents: DocumentRow[] = [
  { name: '技术架构.md', type: 'Markdown', chunks: 42, status: '已索引', updatedAt: '2 小时前' },
  { name: 'AI 服务接口契约.md', type: 'Markdown', chunks: 31, status: '已索引', updatedAt: '1 天前' },
  { name: '架构原则与演进.md', type: 'Markdown', chunks: 18, status: '已索引', updatedAt: '1 天前' },
  { name: '产品需求说明.pdf', type: 'PDF', chunks: 0, status: '解析中', updatedAt: '5 分钟前' },
  { name: '会议纪要扫描件.png', type: '图片', chunks: 0, status: '失败', updatedAt: '3 天前' },
]

function statusVariant(status: DocumentRow['status']) {
  if (status === '已索引') return 'success' as const
  if (status === '解析中') return 'secondary' as const
  return 'muted' as const
}
</script>

<template>
  <div class="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 lg:px-6 lg:py-8">
    <section class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label" class="gap-3 py-4">
        <CardHeader class="flex-row items-center justify-between gap-2">
          <CardDescription>{{ stat.label }}</CardDescription>
          <component :is="stat.icon" class="text-muted-foreground size-4" />
        </CardHeader>
        <CardContent class="space-y-0.5">
          <p class="text-2xl font-semibold tracking-tight">{{ stat.value }}</p>
          <p class="text-muted-foreground text-[11px]">{{ stat.hint }}</p>
        </CardContent>
      </Card>
    </section>

    <Card class="gap-0 py-0">
      <CardHeader class="flex-row items-center justify-between gap-3 py-5">
        <div class="min-w-0">
          <CardTitle>知识库文档</CardTitle>
          <CardDescription class="mt-1">占位数据，文档入库链路尚未实现</CardDescription>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <div class="relative hidden sm:block">
            <Search
              class="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            />
            <Input placeholder="搜索文档" class="h-8 w-44 pl-8 text-xs" aria-label="搜索文档" />
          </div>
          <Button size="sm" disabled title="尚未实现">
            <Plus />
            入库
          </Button>
        </div>
      </CardHeader>

      <div class="scrollbar-slim overflow-x-auto border-t">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-muted-foreground border-b text-left text-xs">
              <th class="px-5 py-2.5 font-medium">名称</th>
              <th class="px-5 py-2.5 font-medium">类型</th>
              <th class="px-5 py-2.5 font-medium">片段数</th>
              <th class="px-5 py-2.5 font-medium">状态</th>
              <th class="px-5 py-2.5 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="doc in documents" :key="doc.name" class="border-b last:border-0">
              <td class="px-5 py-2.5 font-medium">{{ doc.name }}</td>
              <td class="text-muted-foreground px-5 py-2.5">{{ doc.type }}</td>
              <td class="text-muted-foreground px-5 py-2.5 tabular-nums">{{ doc.chunks }}</td>
              <td class="px-5 py-2.5">
                <Badge :variant="statusVariant(doc.status)">{{ doc.status }}</Badge>
              </td>
              <td class="text-muted-foreground px-5 py-2.5 whitespace-nowrap">
                {{ doc.updatedAt }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  </div>
</template>
