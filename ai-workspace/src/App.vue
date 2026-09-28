<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { AlertCircle, ArrowLeft, ArrowRight, Check, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, BookOpen, Copy, FolderOpen, Pencil, Sun, Moon, Settings2, CloudUpload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import NavTree from '@/components/NavTree.vue'
import NavCreateMenu from '@/components/NavCreateMenu.vue'
import NavMoreMenu from '@/components/NavMoreMenu.vue'
import NavigationSorter from '@/components/NavigationSorter.vue'
import type { ReorderRequest } from '@/lib/navigation-drag'
import type { CreationRequest } from '@/lib/creation'
import type { NavigationAction } from '@/lib/navigation-actions'
import { site } from '@/site.config'
import { readOnly } from '@/lib/runtime'
import { docs, navigation, docHref, type Doc } from '@/lib/content'
import { localProject, restoreLocalProject } from '@/lib/local-workspace'
const HarnessEditor = defineAsyncComponent(() => import('@/components/HarnessEditor.vue'))
const WorkspaceSettings = defineAsyncComponent(() => import('@/components/WorkspaceSettings.vue'))
const DeploymentPanel = defineAsyncComponent(() => import('@/components/DeploymentPanel.vue'))
const deploymentOpen = ref(false), deploymentLoaded = ref(false)
const canDeploy = import.meta.env.DEV && !readOnly
const LocalEditor = defineAsyncComponent(() => import('@/components/LocalEditor.vue'))
const editorOpen = ref(false), editorLoaded = ref(false), editorMode = ref<'edit' | 'new' | 'folder'>('edit')
const editorDocument = shallowRef<Doc>()
const creationParent = ref<string>()
const revealPath = ref('')
const treeOpen = ref(true)
const treeCommand = ref<{ id: number; expanded: boolean }>()
const navigationSorter = ref<InstanceType<typeof NavigationSorter>>()
const sortingBusy = ref(false)
let editorReturnFocus: HTMLElement | null = null
let createdPath = ''
const toast = ref('')
const toastError = ref(false)
let toastTimer: ReturnType<typeof setTimeout> | undefined
const homeLink = computed(() => docHref(docs[0]?.id || 'welcome'))
function openEditor(mode: 'edit' | 'new' | 'folder', doc = current.value, returnFocus = document.activeElement as HTMLElement | null) { editorReturnFocus = returnFocus; createdPath = ''; creationParent.value = mode === 'edit' ? undefined : ''; editorDocument.value = doc; editorMode.value = mode; editorLoaded.value = true; editorOpen.value = true }
async function openCreation(request: CreationRequest) {
  editorReturnFocus = document.querySelector<HTMLElement>('.nav-create-trigger[data-state="open"]')
  createdPath = ''
  mobileOpen.value = false
  creationParent.value = request.parent
  editorDocument.value = undefined
  editorMode.value = request.mode
  editorLoaded.value = true
  // Close the mobile navigation before handing keyboard focus to the editor.
  await nextTick()
  editorOpen.value = true
}
function created(result: { mode: 'new' | 'folder'; path: string }) { treeOpen.value = true; revealPath.value = result.path; createdPath = result.path }
function mobileCloseFocus(event: Event) { if (editorOpen.value) event.preventDefault() }
function restoreEditorFocus(event: Event) {
  event.preventDefault()
  const createdNode = createdPath ? document.querySelector<HTMLElement>(`#document-sidebar [data-nav-path="${CSS.escape(createdPath)}"]`) : null
  const target = viewportWidth.value <= 760 ? document.querySelector<HTMLElement>('.mobile-menu') : createdNode || editorReturnFocus
  if (target?.isConnected && target.getClientRects().length) { target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'nearest' }) }
}
function pinReadingRoute() {
  if (!route.value.replace(/^#\/?/, '').split('?')[0] && current.value) { history.replaceState(null, '', docHref(current.value.id)); route.value = location.hash }
}
function reorderNavigation(request: ReorderRequest) { pinReadingRoute(); void navigationSorter.value?.reorder(request) }
async function sortedNavigation(path: string) {
  await nextTick()
  const target = [...document.querySelectorAll<HTMLElement>(`[data-nav-path="${CSS.escape(path)}"]`)].find(element => element.getClientRects().length)
  target?.focus({ preventScroll: true }); target?.scrollIntoView({ block: 'nearest' })
}
async function navigationAction(action: NavigationAction) {
  if (action.type.startsWith('move-')) { pinReadingRoute(); navigationSorter.value?.move(action); return }
  if (action.type === 'expand' || action.type === 'collapse') {
    treeOpen.value = true
    treeCommand.value = { id: (treeCommand.value?.id || 0) + 1, expanded: action.type === 'expand' }
    return
  }
  const node = action.node
  if (!node) return
  if (action.type === 'edit' && node.doc) {
    const returnFocus = document.querySelector<HTMLElement>('.nav-more-trigger[data-state="open"]')
    mobileOpen.value = false
    await nextTick()
    openEditor('edit', node.doc, returnFocus)
    return
  }
  try {
    if (action.type === 'copy-link' && node.doc) {
      const link = new URL(location.href); link.hash = docHref(node.doc.id)
      await navigator.clipboard.writeText(link.href)
      saved('已复制文档链接')
    } else if (action.type === 'copy-path') {
      await navigator.clipboard.writeText('src/content/' + (node.doc?.path || node.key.slice(1)))
      saved('已复制相对路径')
    }
  } catch { saved('复制失败，请允许浏览器访问剪贴板后重试。', true) }
}
function saved(message: string, failed = false) { toast.value = message; toastError.value = failed; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 4000) }
const settingsDirty = ref(false)
const route = ref(location.hash)
const mobileOpen = ref(false)
const collapsed = ref(false)
const sidebarMin = 220
const viewportWidth = ref(window.innerWidth)
const sidebarMax = computed(() => Math.max(sidebarMin, Math.min(520, viewportWidth.value - 440)))
const preferredSidebarWidth = ref(260)
try {
  const stored = Number(localStorage.getItem('ai2cc-sidebar-width'))
  if (Number.isFinite(stored) && stored >= sidebarMin && stored <= 520) preferredSidebarWidth.value = stored
} catch { /* Resizing also works without browser storage. */ }
const sidebarWidth = computed(() => Math.min(sidebarMax.value, Math.max(sidebarMin, preferredSidebarWidth.value)))
const resizingSidebar = ref(false)
let resizePointer: number | undefined
let resizeStartX = 0, resizeStartWidth = 0
function rememberSidebarWidth() {
  try { localStorage.setItem('ai2cc-sidebar-width', String(preferredSidebarWidth.value)) } catch { /* Keep the current session width. */ }
}
function startSidebarResize(event: PointerEvent) {
  if (event.button !== 0 || collapsed.value) return
  event.preventDefault()
  const handle = event.currentTarget as HTMLElement
  handle.focus()
  handle.setPointerCapture(event.pointerId)
  resizePointer = event.pointerId
  resizeStartX = event.clientX; resizeStartWidth = sidebarWidth.value
  resizingSidebar.value = true
}
function moveSidebarResize(event: PointerEvent) {
  if (resizePointer !== event.pointerId) return
  preferredSidebarWidth.value = Math.max(sidebarMin, Math.min(sidebarMax.value, resizeStartWidth + event.clientX - resizeStartX))
}
function stopSidebarResize() {
  if (!resizingSidebar.value) return
  resizePointer = undefined; resizingSidebar.value = false
  rememberSidebarWidth()
}
function resetSidebarWidth() { preferredSidebarWidth.value = 260; rememberSidebarWidth() }
function resizeSidebarKeyboard(event: KeyboardEvent) {
  const step = event.shiftKey ? 40 : 16
  const target = event.key === 'ArrowLeft' ? sidebarWidth.value - step : event.key === 'ArrowRight' ? sidebarWidth.value + step : event.key === 'Home' ? sidebarMin : event.key === 'End' ? sidebarMax.value : undefined
  if (target === undefined) return
  event.preventDefault()
  preferredSidebarWidth.value = Math.max(sidebarMin, Math.min(sidebarMax.value, target))
  rememberSidebarWidth()
}
function updateViewportWidth() { viewportWidth.value = window.innerWidth; if (viewportWidth.value <= 760) stopSidebarResize() }
watch(collapsed, value => { if (value) stopSidebarResize() })
const dark = ref(document.documentElement.dataset.theme === 'dark')
function toggleTheme() {
  dark.value = !dark.value
  document.documentElement.dataset.theme = dark.value ? 'dark' : 'light'
  try { localStorage.setItem('ai2cc-theme', dark.value ? 'dark' : 'light') } catch { /* Theme still works when storage is unavailable. */ }
}
const article = ref<HTMLElement>()
const activeHeading = ref('')
const copied = ref(false)
const currentId = computed(() => { try { return decodeURIComponent(route.value.replace(/^#\/?/, '').split('?')[0]) || docs[0]?.id } catch { return '' } })
const current = computed(() => docs.find(d => d.id === currentId.value))
const index = computed(() => docs.findIndex(d => d.id === currentId.value))
const previous = computed(() => docs[index.value - 1])
const following = computed(() => docs[index.value + 1])
const headingUrl = (id: string) => docHref(current.value!.id) + '?heading=' + encodeURIComponent(id)
let observer: IntersectionObserver | undefined
function onHash() {
  if (settingsDirty.value && location.hash.split('?')[0] !== route.value.split('?')[0] && !window.confirm('配置还有未保存的修改，确定离开吗？')) { history.replaceState(null, '', location.pathname + location.search + route.value); return }
  route.value = location.hash; mobileOpen.value = false
}
function scrollHeading(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); activeHeading.value = id }
async function refresh() {
  document.title = `${current.value?.title || '文档未找到'} · ${site.name}`
  await nextTick()
  observer?.disconnect()
  const heading = new URLSearchParams(route.value.split('?')[1]).get('heading')
  if (heading) scrollHeading(heading)
  else { window.scrollTo({ top: 0 }); activeHeading.value = current.value?.headings[0]?.id || '' }
  observer = new IntersectionObserver(entries => { const visible = entries.filter(e => e.isIntersecting); if (visible[0]) activeHeading.value = visible[0].target.id }, { rootMargin: '-90px 0px -65% 0px' })
  article.value?.querySelectorAll('h2, h3').forEach(el => observer?.observe(el))
  article.value?.querySelectorAll('pre').forEach(pre => {
    const button = document.createElement('button')
    button.className = 'copy-code'; button.type = 'button'; button.textContent = '复制'; button.setAttribute('aria-label', '复制代码')
    button.onclick = async () => { try { await navigator.clipboard.writeText(pre.querySelector('code')?.textContent || ''); button.textContent = '已复制'; setTimeout(() => button.textContent = '复制', 1800) } catch { button.textContent = '请手动复制' } }
    if (!pre.querySelector('.copy-code')) pre.appendChild(button)
  })
}
watch([route, () => current.value?.html], refresh)
onMounted(() => { window.addEventListener('resize', updateViewportWidth); window.addEventListener('blur', stopSidebarResize); window.addEventListener('hashchange', onHash); refresh(); if (!readOnly) void restoreLocalProject() })
onUnmounted(() => { stopSidebarResize(); window.removeEventListener('resize', updateViewportWidth); window.removeEventListener('blur', stopSidebarResize); window.removeEventListener('hashchange', onHash); observer?.disconnect(); clearTimeout(toastTimer) })
function onArticleClick(event: MouseEvent) {
  const link = (event.target as HTMLElement).closest('a')
  if (!link || !current.value || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  const href = link.getAttribute('href') || ''
  if (href === location.hash) {
    const heading = new URLSearchParams(href.split('?')[1]).get('heading')
    if (heading) { event.preventDefault(); scrollHeading(heading) }
  }
}
function skipToContent() { const main = document.getElementById('main-content'); main?.focus(); main?.scrollIntoView() }
async function copyLink() { try { await navigator.clipboard.writeText(location.href); copied.value = true; setTimeout(() => copied.value = false, 1800) } catch { copied.value = false } }
</script>
<template>
  <a class="skip-link" href="#main-content" @click.prevent="skipToContent">跳到正文</a>
  <header class="topbar">
    <a :href="homeLink" class="brand" :aria-label="`${site.name} 首页`"><span class="brand-logo"><img :src="site.logo" alt="Ai" width="1536" height="1024" /></span></a>
    <span class="brand-doc-label">workspace</span>
    <a v-if="!readOnly" class="workspace-settings-link" href="#/workspace-settings" title="空间配置"><Settings2 :size="16" /><span>空间配置</span></a>
    <button v-if="canDeploy" class="deployment-button" aria-label="部署到服务器" title="部署到服务器" @click="deploymentLoaded = true; deploymentOpen = true"><CloudUpload :size="15"/><span>部署</span></button>
    <button v-if="!readOnly" class="local-project-button" :aria-label="localProject.connected ? '本地项目' : '本地编辑'" @click="openEditor(current ? 'edit' : 'new')"><FolderOpen :size="14" /><span>{{ localProject.connected ? '本地项目' : '本地编辑' }}</span></button>
    <Button class="theme-toggle" variant="ghost" size="icon" :aria-label="dark ? '切换到浅色模式' : '切换到深色模式'" :title="dark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleTheme"><Sun v-if="dark" :size="16" /><Moon v-else :size="16" /></Button>
  </header>
  <div :class="['workspace', { 'sidebar-collapsed': collapsed, 'sidebar-resizing': resizingSidebar }]" :style="{ '--sidebar': sidebarWidth + 'px' }">
    <Button class="sidebar-toggle" variant="ghost" size="icon" :aria-label="collapsed ? '展开目录' : '收起目录'" :aria-expanded="!collapsed" aria-controls="document-sidebar" @click="collapsed = !collapsed"><PanelLeftOpen v-if="collapsed" :size="16" /><PanelLeftClose v-else :size="16" /></Button>
    <aside id="document-sidebar" class="sidebar" :inert="collapsed || undefined">
      <div class="sidebar-heading nav-item-row"><button class="sidebar-root-toggle" :aria-label="treeOpen ? '收起文档目录' : '展开文档目录'" :aria-expanded="treeOpen" aria-controls="desktop-document-tree" @click="treeOpen = !treeOpen"><ChevronRight :size="12" :class="{ expanded: treeOpen }" /><span>文档</span></button><div v-if="!readOnly" class="nav-row-actions"><NavCreateMenu parent="" label="知识库根目录" @create="openCreation" /><NavMoreMenu @action="navigationAction" /></div></div>
      <p v-if="sortingBusy" class="navigation-saving" role="status">正在处理目录顺序…</p>
      <nav v-show="treeOpen" id="desktop-document-tree" aria-label="文档分类"><NavTree :nodes="navigation" :active="currentId" :reveal-path="revealPath" :tree-command="treeCommand" :sorting-disabled="sortingBusy || editorOpen || settingsDirty" @reorder="reorderNavigation" @create="openCreation" @action="navigationAction" /></nav>
    </aside>
    <div v-if="!collapsed" class="sidebar-resizer" role="separator" tabindex="0" aria-label="调整目录宽度" aria-orientation="vertical" aria-controls="document-sidebar" :aria-valuemin="sidebarMin" :aria-valuemax="sidebarMax" :aria-valuenow="sidebarWidth" :aria-valuetext="`${sidebarWidth} 像素`" title="拖动调整目录宽度，双击恢复默认；也可用左右方向键调整" @pointerdown="startSidebarResize" @pointermove="moveSidebarResize" @pointerup="stopSidebarResize" @pointercancel="stopSidebarResize" @lostpointercapture="stopSidebarResize" @dblclick="resetSidebarWidth" @keydown="resizeSidebarKeyboard" />
    <main id="main-content" tabindex="-1">
      <div class="breadcrumb-bar">
        <Sheet v-model:open="mobileOpen"><SheetTrigger as-child><Button class="mobile-menu" variant="ghost" size="icon" aria-label="打开文档目录"><Menu :size="20" /></Button></SheetTrigger><SheetContent side="left" class="mobile-sheet" @close-auto-focus="mobileCloseFocus"><SheetTitle>文档目录</SheetTitle><SheetDescription>{{ site.slogan }}</SheetDescription><div class="sidebar-heading mobile-create-heading nav-item-row"><button class="sidebar-root-toggle" :aria-label="treeOpen ? '收起文档目录' : '展开文档目录'" :aria-expanded="treeOpen" aria-controls="mobile-document-tree" @click="treeOpen = !treeOpen"><ChevronRight :size="12" :class="{ expanded: treeOpen }" /><span>文档</span></button><div v-if="!readOnly" class="nav-row-actions"><NavCreateMenu parent="" label="知识库根目录" @create="openCreation" /><NavMoreMenu @action="navigationAction" /></div></div><nav v-show="treeOpen" id="mobile-document-tree" aria-label="移动端文档分类"><NavTree :nodes="navigation" :active="currentId" :reveal-path="revealPath" :tree-command="treeCommand" :sorting-disabled="sortingBusy || editorOpen || settingsDirty" @reorder="reorderNavigation" @navigate="mobileOpen = false" @create="openCreation" @action="navigationAction" /></nav></SheetContent></Sheet>
        <BookOpen :size="15" class="crumb-icon" /><span>{{ current?.categories[0] || '知识库' }}</span><ChevronRight :size="13" /><span class="crumb-current">{{ current?.title || '文档未找到' }}</span>
      </div>
      <div v-if="current" class="reading-layout">
        <div :key="current.id" class="document-column">
          <img v-if="current.id === 'welcome'" class="welcome-cover" :src="site.hero" :alt="`${site.name}，${site.slogan}`" width="1378" height="536" />
          <h1>{{ current.title }}</h1>
          <p v-if="current.description" class="document-description">{{ current.description }}</p>
          <div class="document-meta"><span v-if="current.date">更新于 {{ current.date }}</span><span class="status">{{ current.status }}</span><div class="document-actions"><button v-if="!readOnly && !['workspace-settings', 'workspace-harness'].includes(current.id)" aria-label="编辑文档" @click="openEditor('edit')"><Pencil :size="13" />编辑</button><button @click="copyLink"><Check v-if="copied" :size="14" /><Copy v-else :size="14" />{{ copied ? '已复制链接' : '复制链接' }}</button></div></div>
          <Separator class="article-separator" />
          <article v-if="current.id === 'workspace-harness'" ref="article"><HarnessEditor @dirty="settingsDirty = $event" @ready="refresh" /></article>
          <article v-else-if="current.id === 'workspace-settings'" ref="article"><WorkspaceSettings @dirty="settingsDirty = $event" @ready="refresh" /></article>
          <article v-else ref="article" class="markdown" @click="onArticleClick" v-html="current.html" />
          <div class="page-navigation"><a v-if="previous" :href="docHref(previous.id)"><span><ArrowLeft :size="14" />上一篇</span><strong>{{ previous.title }}</strong></a><div v-else /><a v-if="following" :href="docHref(following.id)" class="next-page"><span>下一篇<ArrowRight :size="14" /></span><strong>{{ following.title }}</strong></a></div>
        </div>
        <aside class="toc"><div class="toc-sticky"><div class="toc-title">本页目录</div><nav aria-label="本页目录"><a v-for="heading in current.headings" :key="heading.id" :href="headingUrl(heading.id)" :class="{ active: activeHeading === heading.id, subheading: heading.level === 3 }" @click="scrollHeading(heading.id)">{{ heading.title }}</a></nav></div></aside>
      </div>
      <div v-else class="not-found"><BookOpen :size="36" /><h1>{{ docs.length ? '这篇文档还不存在' : '还没有文档' }}</h1><p>{{ docs.length ? '链接可能有误，或文档已移动。可以从左侧目录继续阅读。' : '连接本地项目后，就可以创建第一篇 Markdown 文档。' }}</p><Button v-if="docs.length" as-child><a :href="homeLink">返回知识库</a></Button><Button v-else-if="!readOnly" @click="openEditor('new')">创建第一篇文档</Button></div>
    </main>
  </div>
  <LocalEditor v-if="!readOnly && editorLoaded" v-model:open="editorOpen" :mode="editorMode" :document="editorDocument" :creation-parent="creationParent" @saved="saved" @created="created" @close-auto-focus="restoreEditorFocus" />
  <DeploymentPanel v-if="canDeploy && deploymentLoaded" v-model:open="deploymentOpen" :unsaved="editorOpen || settingsDirty" />
  <NavigationSorter v-if="!readOnly" ref="navigationSorter" :disabled="editorOpen || settingsDirty" @busy="sortingBusy = $event" @saved="saved" @sorted="sortedNavigation" />
  <Transition name="toast"><div v-if="toast" class="save-toast" role="status"><AlertCircle v-if="toastError" :size="14" /><Check v-else :size="14" />{{ toast }}</div></Transition>
</template>
<style scoped>
.deployment-button{display:flex;align-items:center;gap:6px;border:0;background:transparent;color:#586579;font-size:13px;padding:6px 8px;border-radius:4px;white-space:nowrap}.deployment-button:hover{background:#f1f4fa;color:#4668a5}[data-theme=dark] .deployment-button{color:#b3c1d8}[data-theme=dark] .deployment-button:hover{background:#293241}.topbar>.theme-toggle:last-child{margin-left:0}.topbar:not(:has(.workspace-settings-link))>.theme-toggle{margin-left:auto}@media(max-width:760px){.deployment-button span{display:none}}
.sidebar-heading{padding:0 0 8px;gap:2px;min-width:0;letter-spacing:0}
.sidebar-heading .sidebar-root-toggle{display:flex;align-items:center;gap:8px;flex:1;min-width:0;width:auto;height:30px;padding:0 6px;text-align:left;border:0;background:transparent;border-radius:4px;color:inherit;font:inherit}
.sidebar-root-toggle svg{flex-shrink:0;transition:transform 140ms}
.sidebar-root-toggle svg.expanded{transform:rotate(90deg)}
.sidebar-heading .sidebar-root-toggle:hover{background:#f1f2f6}
.sidebar-heading .nav-row-actions{display:flex;align-items:center;flex-shrink:0;width:48px}
.mobile-create-heading{margin-top:10px;padding-bottom:2px}
.navigation-saving{padding:0 6px 7px;color:#768296;font-size:12px}
[data-theme=dark] .sidebar-heading .sidebar-root-toggle:hover{background:#292e38}
</style>
