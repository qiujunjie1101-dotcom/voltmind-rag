<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowDownUp, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { navigation } from '@/lib/content'
import { connectLocalProject, connectServiceProject, localProject, reloadLocalProject, saveLocalNavigation } from '@/lib/local-workspace'
import { discoverWorkspaceService, workspaceService } from '@/lib/workspace-service'
import { navigationServiceUnavailable } from '@/lib/content-service'
import { nodePath, parentPath, planNavigationOrder, resolveNavigationMove, sortableSiblingsAt, type NavigationMove } from '@/lib/navigation-sort'
import type { ReorderRequest } from '@/lib/navigation-drag'
import type { NavigationAction } from '@/lib/navigation-actions'

const props = defineProps<{ disabled?: boolean }>()
const emit = defineEmits<{ busy: [value: boolean]; saved: [message: string, failed?: boolean]; sorted: [path: string] }>()
const open = ref(false), busy = ref(false), error = ref('')
type PendingSort = { kind: 'reorder'; request: ReorderRequest } | { kind: 'move'; source: string; direction: NavigationMove }
const pending = ref<PendingSort>()
const returnFocus = ref<HTMLElement | null>(null)
const isDevelopment = import.meta.env.DEV
const serviceSupportsSorting = computed(() => workspaceService.info?.capabilities?.includes('navigation') === true)
const description = computed(() => {
  if (!pending.value) return ''
  const source = pending.value.kind === 'move' ? pending.value.source : pending.value.request.source
  const siblings = sortableSiblingsAt(navigation, parentPath(source))
  const title = (path: string) => siblings.find(node => nodePath(node) === path)?.title || path.split('/').at(-1)
  if (pending.value.kind === 'move') {
    const action = { 'move-up': '上移一位', 'move-down': '下移一位', 'move-first': '移至同级首位', 'move-last': '移至同级末位' }[pending.value.direction]
    return `将「${title(source)}」${action}`
  }
  const { target, position } = pending.value.request
  return `将「${title(source)}」排在「${title(target)}」${position === 'before' ? '之前' : '之后'}`
})
watch([busy, open], () => emit('busy', busy.value || open.value))
function changeOpen(value: boolean) { if (!busy.value) { open.value = value; if (!value) pending.value = undefined } }
function restoreFocus(event: Event) {
  event.preventDefault()
  if (returnFocus.value?.isConnected) returnFocus.value.focus({ preventScroll: true })
}
async function applyPending() {
  if (!pending.value) return
  // Authorization can load a different current order. Menu commands retain
  // their intent and resolve their target against those latest real siblings.
  const request = pending.value.kind === 'move'
    ? resolveNavigationMove(navigation, pending.value.source, pending.value.direction)
    : pending.value.request
  const raw = request ? planNavigationOrder(navigation, request, localProject.navigationRaw) : null
  if (raw === null) { emit('saved', '顺序未变化'); open.value = false; pending.value = undefined; return }
  const result = await saveLocalNavigation(raw, localProject.navigationRaw)
  open.value = false; pending.value = undefined
  error.value = result.warning
  emit('sorted', request!.source)
  emit('saved', result.warning || '目录顺序已保存，刷新后仍保留', !!result.warning)
  await nextTick()
}
async function beginSort(operation: PendingSort) {
  if (props.disabled || busy.value || open.value) return
  pending.value = operation; error.value = ''
  returnFocus.value = document.querySelector<HTMLElement>('.nav-more-trigger[data-state="open"]') || document.activeElement as HTMLElement | null
  if (!localProject.connected) { open.value = true; void discoverWorkspaceService(); return }
  busy.value = true
  try { await applyPending() }
  catch (e) {
    error.value = (e as Error).message
    if (!localProject.connected) { open.value = true; void discoverWorkspaceService() }
    else emit('saved', error.value, true)
  } finally { busy.value = false }
}
function reorder(request: ReorderRequest) { return beginSort({ kind: 'reorder', request }) }
function move(action: NavigationAction) {
  if (!action.node || !['move-up', 'move-down', 'move-first', 'move-last'].includes(action.type)) return
  void beginSort({ kind: 'move', source: nodePath(action.node), direction: action.type as NavigationMove })
}
async function authorize(mode: 'service' | 'folder') {
  busy.value = true; error.value = ''
  try {
    if (mode === 'service') {
      if (!serviceSupportsSorting.value) throw new Error(navigationServiceUnavailable)
      await connectServiceProject()
    }
    else await connectLocalProject()
    await applyPending()
  } catch (e) { if ((e as DOMException).name !== 'AbortError') error.value = (e as Error).message }
  finally { busy.value = false }
}
async function refreshService() { error.value = ''; await discoverWorkspaceService() }
async function reread() {
  busy.value = true
  try { await reloadLocalProject(); error.value = ''; pending.value = undefined; emit('saved', '已读取最新顺序，请重新调整') }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
defineExpose({ reorder, move })
</script>

<template>
  <div v-if="error && !open" class="navigation-sort-error" role="alert"><span>{{ error }}</span><button v-if="localProject.connected" :disabled="busy" @click="reread">重新读取</button><button :disabled="busy" aria-label="关闭排序提示" @click="error = ''">关闭</button></div>
  <Sheet :open="open" @update:open="changeOpen"><SheetContent side="right" class="navigation-sort-sheet" @close-auto-focus="restoreFocus">
    <SheetTitle>授权保存目录顺序</SheetTitle>
    <SheetDescription>排序保存在项目里，刷新和重新打开后仍然有效。</SheetDescription>
    <div class="sort-proposal"><ArrowDownUp :size="18" /><p>{{ description }}</p></div>
    <template v-if="workspaceService.info">
      <p>目标空间：<strong>{{ workspaceService.info.name }}</strong></p>
      <p class="sort-workspace-path">{{ workspaceService.info.path }}</p>
      <p>连接后可编辑知识文档、创建目录、保存媒体和目录顺序。本次操作只保存同级顺序。</p>
      <Button v-if="serviceSupportsSorting" :disabled="busy || workspaceService.checking" @click="authorize('service')"><LoaderCircle v-if="busy" :size="15" class="spin" />{{ busy ? '正在保存…' : '授权并保存顺序' }}</Button>
      <template v-else>
        <p class="editor-warning" role="alert">{{ navigationServiceUnavailable }}</p>
        <Button variant="outline" :disabled="busy || workspaceService.checking" @click="refreshService">{{ workspaceService.checking ? '正在检测本地空间…' : '重新检测服务' }}</Button>
      </template>
    </template>
    <Button v-if="localProject.supported" variant="outline" :disabled="busy" @click="authorize('folder')">选择文件夹并保存顺序</Button>
    <Button v-if="isDevelopment && !workspaceService.info" variant="outline" :disabled="busy || workspaceService.checking" @click="refreshService">{{ workspaceService.checking ? '正在检测本地空间…' : '重新检测本地空间' }}</Button>
    <p v-if="!workspaceService.info && !workspaceService.checking && !localProject.supported">请通过目标项目的本地开发服务打开页面后重试，或使用支持文件夹授权的浏览器。</p>
    <p v-if="error || workspaceService.error" class="editor-warning" role="alert">{{ error || workspaceService.error }}</p>
    <Button variant="outline" :disabled="busy" @click="changeOpen(false)">取消</Button>
  </SheetContent></Sheet>
</template>

<style>
.navigation-sort-sheet{width:min(100vw,460px)!important;max-width:460px!important;padding:28px 24px!important;overflow-y:auto;display:flex;flex-direction:column;gap:18px;font-size:14px;line-height:1.75}
.navigation-sort-sheet [data-slot=sheet-title]{padding-right:20px;font-size:20px}
.navigation-sort-sheet [data-slot=sheet-description]{color:#788292}
.sort-proposal{display:flex;align-items:flex-start;gap:10px;padding:14px;border-radius:6px;background:#f2f5fa;color:#425779;overflow-wrap:anywhere}
.sort-proposal svg{flex-shrink:0;margin-top:4px}.sort-workspace-path{font-size:12px;color:#748194;overflow-wrap:anywhere}
.navigation-sort-error{position:fixed;z-index:140;bottom:24px;left:50%;transform:translateX(-50%);display:flex;align-items:center;flex-wrap:wrap;gap:12px;width:max-content;max-width:calc(100vw - 32px);padding:12px 16px;border:1px solid #e5ccb6;border-radius:7px;background:#fff7ee;color:#825432;font-size:13px;box-shadow:0 6px 24px #0001}
.navigation-sort-error span{flex:1;min-width:180px}.navigation-sort-error button{text-decoration:underline;text-underline-offset:3px}
[data-theme=dark] .sort-proposal{background:#283347;color:#d0ddf5}[data-theme=dark] .navigation-sort-error{background:#382c23;color:#e2c3a7;border-color:#6f5039}
</style>
