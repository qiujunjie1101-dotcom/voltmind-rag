<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { ArrowLeft, ArrowRight, Check, ChevronRight, Menu, PanelLeftClose, PanelLeftOpen, BookOpen, Copy, FolderOpen, Pencil, Plus, Sun, Moon } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import NavTree from '@/components/NavTree.vue'
import { docs, navigation, docHref, type Doc } from '@/lib/content'
import { localProject, restoreLocalProject } from '@/lib/local-workspace'
const LocalEditor = defineAsyncComponent(() => import('@/components/LocalEditor.vue'))
const editorOpen = ref(false), editorLoaded = ref(false), editorMode = ref<'edit' | 'new' | 'folder'>('edit')
const editorDocument = shallowRef<Doc>()
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
const homeLink = computed(() => docHref(docs[0]?.id || 'welcome'))
function openEditor(mode: 'edit' | 'new' | 'folder') { editorDocument.value = current.value; editorMode.value = mode; editorLoaded.value = true; editorOpen.value = true }
function saved(message: string) { toast.value = message; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 4000) }
const route = ref(location.hash)
const mobileOpen = ref(false)
const collapsed = ref(false)
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
function onHash() { route.value = location.hash; mobileOpen.value = false }
function scrollHeading(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); activeHeading.value = id }
async function refresh() {
  document.title = `${current.value?.title || '文档未找到'} · AI2CC`
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
onMounted(() => { window.addEventListener('hashchange', onHash); refresh(); void restoreLocalProject() })
onUnmounted(() => { window.removeEventListener('hashchange', onHash); observer?.disconnect(); clearTimeout(toastTimer) })
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
    <a :href="homeLink" class="brand" aria-label="AI2CC 首页"><span class="brand-logo"><img :src="'./brand/ai2cc-logo.png'" alt="AI2CC" width="1774" height="887" /></span></a>
    <span class="brand-doc-label">文档</span>
    <div class="header-divider" /><span class="header-label">AI to Coding Community</span>
    <button class="local-project-button" :aria-label="localProject.connected ? '本地项目' : '本地编辑'" @click="openEditor(current ? 'edit' : 'new')"><FolderOpen :size="14" /><span>{{ localProject.connected ? '本地项目' : '本地编辑' }}</span></button>
    <Button class="theme-toggle" variant="ghost" size="icon" :aria-label="dark ? '切换到浅色模式' : '切换到深色模式'" :title="dark ? '切换到浅色模式' : '切换到深色模式'" @click="toggleTheme"><Sun v-if="dark" :size="16" /><Moon v-else :size="16" /></Button>
  </header>
  <div :class="['workspace', { 'sidebar-collapsed': collapsed }]">
    <Button class="sidebar-toggle" variant="ghost" size="icon" :aria-label="collapsed ? '展开目录' : '收起目录'" :aria-expanded="!collapsed" aria-controls="document-sidebar" @click="collapsed = !collapsed"><PanelLeftOpen v-if="collapsed" :size="16" /><PanelLeftClose v-else :size="16" /></Button>
    <aside id="document-sidebar" class="sidebar" :inert="collapsed || undefined">
      <div class="sidebar-heading"><span>文档</span><button aria-label="创建文档或目录" title="创建文档或目录" @click="openEditor('new')"><Plus :size="14" /></button></div>
      <nav aria-label="文档分类"><NavTree :nodes="navigation" :active="currentId" /></nav>
    </aside>
    <main id="main-content" tabindex="-1">
      <div class="breadcrumb-bar">
        <Sheet v-model:open="mobileOpen"><SheetTrigger as-child><Button class="mobile-menu" variant="ghost" size="icon" aria-label="打开文档目录"><Menu :size="20" /></Button></SheetTrigger><SheetContent side="left" class="mobile-sheet"><SheetTitle>文档目录</SheetTitle><SheetDescription>社区从 0 到 1 的成长知识库</SheetDescription><nav aria-label="移动端文档分类"><NavTree :nodes="navigation" :active="currentId" @navigate="mobileOpen = false" /></nav></SheetContent></Sheet>
        <BookOpen :size="15" class="crumb-icon" /><span>{{ current?.categories[0] || '知识库' }}</span><ChevronRight :size="13" /><span class="crumb-current">{{ current?.title || '文档未找到' }}</span>
      </div>
      <div v-if="current" class="reading-layout">
        <div :key="current.id" class="document-column">
          <img v-if="current.id === 'welcome'" class="welcome-cover" :src="'./brand/ai2cc-welcome.png'" alt="AI2CC，Max VibeCoding Developer Community，AI to Coding Community" width="1378" height="536" />
          <h1>{{ current.title }}</h1>
          <p v-if="current.description" class="document-description">{{ current.description }}</p>
          <div class="document-meta"><span v-if="current.date">更新于 {{ current.date }}</span><span class="status">{{ current.status }}</span><div class="document-actions"><button aria-label="编辑文档" @click="openEditor('edit')"><Pencil :size="13" />编辑</button><button @click="copyLink"><Check v-if="copied" :size="14" /><Copy v-else :size="14" />{{ copied ? '已复制链接' : '复制链接' }}</button></div></div>
          <Separator class="article-separator" />
          <article ref="article" class="markdown" @click="onArticleClick" v-html="current.html" />
          <div class="page-navigation"><a v-if="previous" :href="docHref(previous.id)"><span><ArrowLeft :size="14" />上一篇</span><strong>{{ previous.title }}</strong></a><div v-else /><a v-if="following" :href="docHref(following.id)" class="next-page"><span>下一篇<ArrowRight :size="14" /></span><strong>{{ following.title }}</strong></a></div>
        </div>
        <aside class="toc"><div class="toc-sticky"><div class="toc-title">本页目录</div><nav aria-label="本页目录"><a v-for="heading in current.headings" :key="heading.id" :href="headingUrl(heading.id)" :class="{ active: activeHeading === heading.id, subheading: heading.level === 3 }" @click="scrollHeading(heading.id)">{{ heading.title }}</a></nav></div></aside>
      </div>
      <div v-else class="not-found"><BookOpen :size="36" /><h1>{{ docs.length ? '这篇文档还不存在' : '还没有文档' }}</h1><p>{{ docs.length ? '链接可能有误，或文档已移动。可以从左侧目录继续阅读。' : '连接本地项目后，就可以创建第一篇 Markdown 文档。' }}</p><Button v-if="docs.length" as-child><a :href="homeLink">返回知识库</a></Button><Button v-else @click="openEditor('new')">创建第一篇文档</Button></div>
    </main>
  </div>
  <LocalEditor v-if="editorLoaded" v-model:open="editorOpen" :mode="editorMode" :document="editorDocument" @saved="saved" />
  <Transition name="toast"><div v-if="toast" class="save-toast" role="status"><Check :size="14" />{{ toast }}</div></Transition>
</template>
