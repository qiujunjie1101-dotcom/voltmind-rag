<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useMediaQuery } from '@vueuse/core'
import { FileText, Folder } from 'lucide-vue-next'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { docHref, isSortableNode, type NavNode } from '@/lib/content'
import type { CreationRequest } from '@/lib/creation'
import type { NavigationAction } from '@/lib/navigation-actions'
import { beginNavigationDrag, dropNavigationTarget, endNavigationDrag, hoverNavigationTarget, navigationDrag, suppressNavigationClick, type ReorderRequest } from '@/lib/navigation-drag'
import { readOnly } from '@/lib/runtime'
import NavCreateMenu from './NavCreateMenu.vue'
import NavMoreMenu from './NavMoreMenu.vue'

type TreeCommand = { id: number; expanded: boolean }
const props = withDefaults(defineProps<{ nodes: NavNode[]; active: string; depth?: number; revealPath?: string; treeCommand?: TreeCommand; sortingDisabled?: boolean }>(), { depth: 0, sortingDisabled: false })
const emit = defineEmits<{ navigate: []; create: [request: CreationRequest]; action: [action: NavigationAction]; reorder: [request: ReorderRequest] }>()
const expanded = ref<Record<string, boolean>>({})
const childCommands = ref<Record<string, TreeCommand>>({})
const inheritedCommand = ref<TreeCommand>()
let commandId = 0
const isOpen = (node: NavNode) => expanded.value[node.key] ?? (props.depth === 0 && node.title === '开始阅读')
const contains = (node: NavNode): boolean => node.doc?.id === props.active || !!node.children?.some(contains)
const folderPath = (node: NavNode) => node.key.slice(1)
const documentParent = (node: NavNode) => node.doc!.path.split('/').slice(0, -1).join('/')
const nodePath = (node: NavNode) => node.doc?.path || folderPath(node)
const coarsePointer = useMediaQuery('(pointer: coarse)')
const dragEnabled = computed(() => !readOnly && !props.sortingDisabled && !coarsePointer.value)
const nodeDragEnabled = (node: NavNode) => dragEnabled.value && isSortableNode(node)
let dragStartAllowed = true
function trackDragStart(event: PointerEvent) {
  dragStartAllowed = event.button === 0 && event.pointerType !== 'touch' && !(event.target as Element).closest('.nav-row-actions')
}
function startDrag(event: DragEvent, node: NavNode) {
  if (!nodeDragEnabled(node) || !dragStartAllowed) { event.preventDefault(); return }
  beginNavigationDrag(event, nodePath(node))
}
function hoverDrag(event: DragEvent, node: NavNode) {
  if (nodeDragEnabled(node)) hoverNavigationTarget(event, nodePath(node))
}
function dropDrag(event: DragEvent, node: NavNode) {
  if (!nodeDragEnabled(node)) { endNavigationDrag(); return }
  const request = dropNavigationTarget(event, nodePath(node))
  if (request) emit('reorder', request)
}
function dragClasses(node: NavNode) {
  const path = nodePath(node)
  return { 'nav-drag-source': navigationDrag.source === path, 'nav-drop-before': navigationDrag.target === path && navigationDrag.position === 'before', 'nav-drop-after': navigationDrag.target === path && navigationDrag.position === 'after' }
}
watch(dragEnabled, enabled => { if (!enabled) endNavigationDrag() })
onBeforeUnmount(endNavigationDrag)
function revealTargets() {
  for (const node of props.nodes) {
    if (!node.children) continue
    const path = folderPath(node)
    if (contains(node) || (props.revealPath && (props.revealPath === path || props.revealPath.startsWith(path + '/')))) expanded.value[node.key] = true
  }
}
watch([() => props.active, () => props.revealPath], () => {
  // Reading a new article or revealing a new folder supersedes an earlier bulk command.
  childCommands.value = {}
  inheritedCommand.value = undefined
  revealTargets()
}, { immediate: true })
watch(() => props.treeCommand, command => {
  inheritedCommand.value = command
  if (!command?.id) return
  childCommands.value = {}
  for (const node of props.nodes) if (node.children) expanded.value[node.key] = command.expanded
}, { immediate: true })
function handleAction(action: NavigationAction) {
  if (action.node?.children && (action.type === 'expand' || action.type === 'collapse')) {
    const open = action.type === 'expand'
    expanded.value[action.node.key] = open
    childCommands.value[action.node.key] = { id: ++commandId, expanded: open }
  } else emit('action', action)
}
</script>

<template>
  <ul :class="['nav-tree', { nested: depth > 0 }]" :style="{ '--nav-indent': Math.min(depth, 6) * 14 + 'px' }">
    <li v-for="node in nodes" :key="node.key">
      <Collapsible v-if="node.children" :open="isOpen(node)" @update:open="expanded[node.key] = $event">
        <div class="nav-item-row nav-folder-row" :class="dragClasses(node)" :draggable="nodeDragEnabled(node)" :data-nav-drag-path="nodePath(node)" :data-nav-draggable="nodeDragEnabled(node)" @pointerdown.capture="trackDragStart" @dragstart.stop="startDrag($event, node)" @dragenter="hoverDrag($event, node)" @dragover="hoverDrag($event, node)" @drop.stop="dropDrag($event, node)" @dragend="endNavigationDrag" @click.capture="suppressNavigationClick">
          <CollapsibleTrigger class="folder-row" :data-nav-path="folderPath(node)" :title="node.title">
            <span class="nav-arrow-slot" aria-hidden="true"><svg viewBox="0 0 10 10" class="nav-toggle-arrow" :class="{ expanded: isOpen(node) }"><path d="M3 1.5 7 5 3 8.5Z" /></svg></span>
            <Folder :size="14" class="node-icon" aria-hidden="true" />
            <span class="nav-node-title">{{ node.title }}</span>
          </CollapsibleTrigger>
          <div v-if="!readOnly" class="nav-row-actions">
            <NavCreateMenu :parent="folderPath(node)" :label="node.title" @create="emit('create', $event)" />
            <NavMoreMenu :node="node" :expanded="isOpen(node)" :sorting-disabled="sortingDisabled" @action="handleAction" />
          </div>
        </div>
        <CollapsibleContent>
          <NavTree v-if="node.children.length" :nodes="node.children" :active="active" :depth="depth + 1" :reveal-path="revealPath" :tree-command="childCommands[node.key] || inheritedCommand" :sorting-disabled="sortingDisabled" @navigate="emit('navigate')" @create="emit('create', $event)" @action="emit('action', $event)" @reorder="emit('reorder', $event)" />
          <p v-else class="nav-empty-folder">暂无文档</p>
        </CollapsibleContent>
      </Collapsible>
      <div v-else-if="node.doc" :class="['nav-item-row', { selected: active === node.doc.id }, dragClasses(node)]" :draggable="nodeDragEnabled(node)" :data-nav-drag-path="nodePath(node)" :data-nav-draggable="nodeDragEnabled(node)" @pointerdown.capture="trackDragStart" @dragstart.stop="startDrag($event, node)" @dragenter="hoverDrag($event, node)" @dragover="hoverDrag($event, node)" @drop.stop="dropDrag($event, node)" @dragend="endNavigationDrag" @click.capture="suppressNavigationClick">
        <a :href="docHref(node.doc.id)" :draggable="false" :data-nav-path="node.doc.path" :class="['doc-row', { selected: active === node.doc.id }]" :aria-current="active === node.doc.id ? 'page' : undefined" :title="node.title" @click="emit('navigate')">
          <span class="nav-arrow-slot" aria-hidden="true"></span>
          <FileText :size="14" class="node-icon" aria-hidden="true" />
          <span class="nav-node-title">{{ node.title }}</span>
        </a>
        <div v-if="!readOnly" class="nav-row-actions">
          <NavCreateMenu :parent="documentParent(node)" :label="node.title" sibling @create="emit('create', $event)" />
          <NavMoreMenu :node="node" :sorting-disabled="sortingDisabled" @action="handleAction" />
        </div>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.nav-tree.nested{margin:0;padding:0;border:0}
.nav-tree>li{margin:0}
.nav-item-row{position:relative;display:flex;align-items:center;gap:2px;min-width:0;min-height:34px;padding-right:3px;border-radius:4px;color:#465266;transition:background 120ms ease}
.nav-item-row.nav-drag-source{opacity:.4}
.nav-item-row.nav-drop-before::before,.nav-item-row.nav-drop-after::after{content:'';position:absolute;left:calc(var(--nav-indent) + 3px);right:3px;height:2px;background:#4b7cff;border-radius:2px;z-index:2;pointer-events:none}
.nav-item-row.nav-drop-before::before{top:0}
.nav-item-row.nav-drop-after::after{bottom:0}
.nav-folder-row{margin:0}
.nav-item-row:hover,.nav-item-row:focus-within,.nav-item-row:has(.nav-row-actions [data-state=open]){background:#f0f1f5}
.nav-item-row.selected,.nav-item-row.selected:hover,.nav-item-row.selected:focus-within,.nav-item-row.selected:has(.nav-row-actions [data-state=open]){background:#edf2ff;color:#356eff}
.nav-item-row>.folder-row,.nav-item-row>.doc-row{display:flex;align-items:center;gap:6px;width:auto;flex:1;min-width:0;height:34px;min-height:34px;margin:0;padding:0 3px 0 calc(var(--nav-indent) + 3px);border:0;border-radius:4px;background:transparent;color:inherit;font-size:13px;font-weight:400;line-height:1.4;text-align:left}
.nav-item-row>.folder-row{font-weight:500}
.nav-item-row>.folder-row:hover,.nav-item-row>.doc-row:hover,.nav-item-row>.doc-row.selected{background:transparent;color:inherit}
.nav-item-row .nav-node-title{display:block;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal}
.nav-item-row .nav-arrow-slot{display:flex;align-items:center;justify-content:center;flex:0 0 10px;width:10px;min-width:10px;height:14px;overflow:visible}
.folder-row .nav-toggle-arrow{width:10px;height:10px;fill:currentColor;stroke:none;color:#7a8492;transition:transform 140ms ease}
.folder-row .nav-toggle-arrow.expanded{transform:rotate(90deg)}
.nav-item-row .node-icon{flex:0 0 14px;width:14px;height:14px;color:currentColor;opacity:.76}
.nav-row-actions{display:flex;align-items:center;gap:0;flex:0 0 48px;width:48px;min-width:48px}
.nav-empty-folder{margin:0;padding:7px 5px 7px calc(var(--nav-indent) + 35px);color:#8b94a4;font-size:12px;line-height:1.5}
[data-theme=dark] .nav-item-row{color:#c2ccdb}
[data-theme=dark] .nav-item-row:hover,[data-theme=dark] .nav-item-row:focus-within,[data-theme=dark] .nav-item-row:has(.nav-row-actions [data-state=open]){background:#252d3b}
[data-theme=dark] .nav-item-row.selected,[data-theme=dark] .nav-item-row.selected:hover,[data-theme=dark] .nav-item-row.selected:focus-within,[data-theme=dark] .nav-item-row.selected:has(.nav-row-actions [data-state=open]){background:#293953;color:#a7c2ff}
[data-theme=dark] .nav-item-row>.folder-row,[data-theme=dark] .nav-item-row>.doc-row{background:transparent;color:inherit}
[data-theme=dark] .folder-row .nav-toggle-arrow{color:#8f9caf}
[data-theme=dark] .nav-empty-folder{color:#91a0b5}
@media(hover:none),(pointer:coarse){.nav-item-row,.nav-item-row>.folder-row,.nav-item-row>.doc-row{height:38px;min-height:38px}}
@media(prefers-reduced-motion:reduce){.nav-item-row,.folder-row .nav-toggle-arrow{transition:none}}
</style>
