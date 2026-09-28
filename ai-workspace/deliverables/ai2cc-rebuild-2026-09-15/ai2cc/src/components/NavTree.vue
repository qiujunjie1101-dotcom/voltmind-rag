<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { docHref, type NavNode } from '@/lib/content'
const props = withDefaults(defineProps<{ nodes: NavNode[]; active: string; depth?: number }>(), { depth: 0 })
const emit = defineEmits<{ navigate: [] }>()
const closed = ref<Record<string, boolean>>({})
const contains = (node: NavNode): boolean => node.doc?.id === props.active || !!node.children?.some(contains)
watch(() => props.active, () => { for (const node of props.nodes) if (contains(node)) closed.value[node.key] = false }, { immediate: true })
</script>
<template>
  <ul :class="['nav-tree', { nested: depth > 0 }]">
    <li v-for="node in nodes" :key="node.key">
      <Collapsible v-if="node.children" :open="!closed[node.key]" @update:open="closed[node.key] = !$event">
        <CollapsibleTrigger class="folder-row"><span>{{ node.title }}</span><ChevronRight :size="14" :class="{ expanded: !closed[node.key] }" /></CollapsibleTrigger>
        <CollapsibleContent><NavTree :nodes="node.children" :active="active" :depth="depth + 1" @navigate="emit('navigate')" /></CollapsibleContent>
      </Collapsible>
      <a v-else-if="node.doc" :href="docHref(node.doc.id)" :class="['doc-row', { selected: active === node.doc.id }]" :aria-current="active === node.doc.id ? 'page' : undefined" @click="emit('navigate')"><span>{{ node.title }}</span></a>
    </li>
  </ul>
</template>
