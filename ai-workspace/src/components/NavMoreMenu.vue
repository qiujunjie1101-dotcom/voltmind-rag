<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, ArrowDownToLine, ArrowUpToLine, ChevronsDownUp, ChevronsUpDown, Copy, Link, MoreHorizontal, Pencil } from 'lucide-vue-next'
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRoot, DropdownMenuSeparator, DropdownMenuTrigger } from 'reka-ui'
import { isSortableNode, navigation, type NavNode } from '@/lib/content'
import { nodePath, parentPath, sortableSiblingsAt } from '@/lib/navigation-sort'
import type { NavigationAction } from '@/lib/navigation-actions'

const props = defineProps<{ node?: NavNode; expanded?: boolean; sortingDisabled?: boolean }>()
const emit = defineEmits<{ action: [action: NavigationAction] }>()
const handingOff = ref(false)
const label = computed(() => props.node?.title || '文档目录')
const isFolder = computed(() => !props.node || !!props.node.children)
const editable = computed(() => props.node?.doc && !['workspace-settings', 'workspace-harness'].includes(props.node.doc.id))
const sortable = computed(() => !!props.node && isSortableNode(props.node))
const position = computed(() => {
  if (!props.node) return { index: -1, last: -1 }
  const path = nodePath(props.node), siblings = sortableSiblingsAt(navigation, parentPath(path))
  return { index: siblings.findIndex(node => nodePath(node) === path), last: siblings.length - 1 }
})
function choose(type: NavigationAction['type']) {
  handingOff.value = type === 'edit'
  emit('action', { type, node: props.node })
}
function closeAutoFocus(event: Event) { if (handingOff.value) event.preventDefault() }
</script>

<template>
  <DropdownMenuRoot :modal="false" @update:open="open => { if (open) handingOff = false }">
    <DropdownMenuTrigger class="nav-more-trigger" :aria-label="`「${label}」的更多操作`" :title="`「${label}」的更多操作`" @click.stop><MoreHorizontal :size="16" aria-hidden="true" /></DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent as-child side="bottom" align="end" :side-offset="4" :collision-padding="10" @close-auto-focus="closeAutoFocus">
        <div class="nav-more-menu">
          <DropdownMenuLabel class="nav-more-label" :title="label">{{ label }}</DropdownMenuLabel>
          <DropdownMenuItem v-if="editable" class="nav-more-option" @select="choose('edit')"><Pencil :size="15" /><span>编辑文档</span></DropdownMenuItem>
          <DropdownMenuItem v-if="node?.doc" class="nav-more-option" @select="choose('copy-link')"><Link :size="15" /><span>复制链接</span></DropdownMenuItem>
          <DropdownMenuItem v-if="node" class="nav-more-option" @select="choose('copy-path')"><Copy :size="15" /><span>复制相对路径</span></DropdownMenuItem>
          <DropdownMenuSeparator v-if="node && isFolder" class="nav-more-separator" />
          <template v-if="isFolder">
            <DropdownMenuItem class="nav-more-option" @select="choose('expand')"><ChevronsUpDown :size="15" /><span>{{ node ? '展开所有子目录' : '展开全部目录' }}</span></DropdownMenuItem>
            <DropdownMenuItem class="nav-more-option" @select="choose('collapse')"><ChevronsDownUp :size="15" /><span>{{ node ? '收起当前目录' : '收起全部目录' }}</span></DropdownMenuItem>
          </template>
          <template v-if="sortable">
            <DropdownMenuSeparator class="nav-more-separator" />
            <DropdownMenuItem class="nav-more-option" :disabled="sortingDisabled || position.index <= 0" @select="choose('move-up')"><ArrowUp :size="15" /><span>上移</span></DropdownMenuItem>
            <DropdownMenuItem class="nav-more-option" :disabled="sortingDisabled || position.index < 0 || position.index === position.last" @select="choose('move-down')"><ArrowDown :size="15" /><span>下移</span></DropdownMenuItem>
            <DropdownMenuItem class="nav-more-option" :disabled="sortingDisabled || position.index <= 0" @select="choose('move-first')"><ArrowUpToLine :size="15" /><span>置顶</span></DropdownMenuItem>
            <DropdownMenuItem class="nav-more-option" :disabled="sortingDisabled || position.index < 0 || position.index === position.last" @select="choose('move-last')"><ArrowDownToLine :size="15" /><span>置底</span></DropdownMenuItem>
          </template>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>

<style scoped>
.nav-more-trigger{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:24px;height:26px;padding:0;border:0;border-radius:4px;background:transparent;color:#858d9b;cursor:pointer;transition:opacity 120ms,background 120ms}
.nav-item-row .nav-more-trigger{opacity:0;pointer-events:none}
.nav-item-row:hover .nav-more-trigger,.nav-item-row:focus-within .nav-more-trigger,.nav-item-row:has(.nav-row-actions [data-state=open]) .nav-more-trigger,.nav-more-trigger[data-state=open],.nav-more-trigger:focus-visible{opacity:1;pointer-events:auto}
.nav-more-trigger:hover,.nav-more-trigger[data-state=open]{background:#e4e7ee;color:#4e5a70}
.nav-more-trigger:focus-visible{outline:2px solid #5b77ba;outline-offset:-2px}
.nav-more-menu{z-index:120;min-width:180px;max-width:min(280px,calc(100vw - 20px));padding:5px;background:#fff;color:#333b49;border:1px solid #e8eaf0;border-radius:6px;box-shadow:0 7px 25px #1721361c;font-family:inherit;outline:none}
.nav-more-label{padding:6px 10px 7px;font-size:11px;line-height:1.5;color:#9198a5;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nav-more-option{display:flex;align-items:center;gap:9px;min-height:34px;padding:7px 10px;border-radius:3px;font-size:13px;line-height:1.5;cursor:pointer;outline:none;user-select:none}
.nav-more-option svg{flex-shrink:0;color:#858e9e}
.nav-more-option[data-disabled]{opacity:.4;pointer-events:none}
.nav-more-option[data-highlighted]{background:#f0f2f7;color:#334e85}
.nav-more-separator{height:1px;background:#eceef3;margin:5px -5px}
[data-theme=dark] .nav-more-trigger{color:#99a5b7}
[data-theme=dark] .nav-more-trigger:hover,[data-theme=dark] .nav-more-trigger[data-state=open]{background:#303644;color:#d8dfed}
[data-theme=dark] .nav-more-menu{background:#20242c;color:#d3d9e5;border-color:#343b48;box-shadow:0 7px 25px #0006}
[data-theme=dark] .nav-more-label{color:#929daf}
[data-theme=dark] .nav-more-option svg{color:#9ca9be}
[data-theme=dark] .nav-more-option[data-highlighted]{background:#2c3443;color:#d3e1ff}
[data-theme=dark] .nav-more-separator{background:#373e4b}
@media(hover:none),(pointer:coarse){.nav-item-row .nav-more-trigger{opacity:1;pointer-events:auto;height:30px}.nav-more-option{min-height:42px}}
@media(prefers-reduced-motion:reduce){.nav-more-trigger{transition:none}}
</style>
