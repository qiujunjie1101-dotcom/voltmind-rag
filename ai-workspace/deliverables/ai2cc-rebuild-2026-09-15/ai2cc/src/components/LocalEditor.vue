<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { stringify } from 'yaml'
import { FolderOpen, Save, ImagePlus, FolderPlus, FilePlus2, Check, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { docs, parseDocument, renderDocument, docHref, type Doc } from '@/lib/content'
import { connectLocalProject, createLocalFolder, localAsset, localProject, reloadLocalProject, saveLocalDocument, stageMedia, validateName, type PendingAsset } from '@/lib/local-workspace'
const props = defineProps<{ open: boolean; mode: 'edit' | 'new' | 'folder'; document?: Doc }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [message: string] }>()
const mode = ref(props.mode)
const raw = ref(''), baseline = ref(''), original = ref<string>(), filename = ref(''), parent = ref(''), error = ref(''), busy = ref(false), pane = ref<'both' | 'source' | 'preview'>('both')
const originalPath = ref(''), folderName = ref('')
const textarea = ref<HTMLTextAreaElement>(), mediaInput = ref<HTMLInputElement>()
const assets = ref<PendingAsset[]>([])
const selectedMedia = ref(0), mediaWidth = ref(640), mediaHeight = ref('')
const dirty = computed(() => raw.value !== baseline.value || (mode.value === 'new' && !!filename.value) || (mode.value === 'folder' && !!folderName.value))
const filePath = computed(() => mode.value === 'edit' ? originalPath.value : [parent.value, filename.value.replace(/\.md$/i, '') + '.md'].filter(Boolean).join('/'))
const folderOptions = computed(() => ['', ...localProject.folders])
const preview = computed(() => {
  try {
    const doc = parseDocument(filePath.value || 'preview.md', raw.value)
    return { title: doc.title, html: renderDocument(doc, [...docs.filter(d => d.path !== doc.path), doc], source => assets.value.find(asset => asset.source === source)?.objectUrl || localAsset(source)), error: '' }
  } catch (e) { return { title: '', html: '', error: (e as Error).message } }
})
const mediaEntries = computed(() => [...raw.value.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g)].map(match => ({ index: match.index!, text: match[0], label: match[1] || '媒体文件', source: match[2]!, title: match[3] || '' })))
function releaseAssets() { assets.value.forEach(asset => URL.revokeObjectURL(asset.objectUrl)); assets.value = [] }
function template(title: string) { return '---\n' + stringify({ title, slug: 'doc-' + crypto.randomUUID().slice(0, 12), date: new Date().toLocaleDateString('en-CA'), status: '草稿' }) + '---\n\n## 开始记录\n\n' }
function initialise() {
  releaseAssets(); error.value = ''; busy.value = false; mode.value = props.mode; pane.value = 'both'; selectedMedia.value = 0
  const doc = docs.find(d => d.path === props.document?.path) || props.document
  originalPath.value = doc?.path || ''; parent.value = doc?.path.split('/').slice(0, -1).join('/') || ''
  if (!folderOptions.value.includes(parent.value)) parent.value = ''
  filename.value = ''; folderName.value = ''
  original.value = mode.value === 'edit' ? doc?.raw : undefined
  raw.value = original.value ?? template('新文档'); baseline.value = raw.value
}
watch(() => props.open, open => { if (open) initialise(); else releaseAssets() }, { immediate: true })
watch(filename, name => { if (mode.value === 'new' && name.trim()) raw.value = raw.value.replace(/^title:.*$/m, 'title: ' + JSON.stringify(name.replace(/\.md$/i, ''))) })
watch([selectedMedia, mediaEntries], () => {
  const entry = mediaEntries.value[selectedMedia.value]
  if (entry) { mediaWidth.value = Number(entry.title.match(/width=(\d+)/)?.[1] || 640); mediaHeight.value = entry.title.match(/height=(\d+)/)?.[1] || '' }
})
function changeOpen(open: boolean) {
  if (!open && busy.value) return
  if (!open && dirty.value && !window.confirm('还有未保存的内容。确定关闭并放弃这些修改吗？')) return
  emit('update:open', open)
}
async function connect() {
  error.value = ''; busy.value = true
  try { await connectLocalProject(); initialise() } catch (e) { if ((e as DOMException).name !== 'AbortError') error.value = (e as Error).message } finally { busy.value = false }
}
function reconnect() { if (dirty.value && !window.confirm('重新连接会放弃未保存的修改，继续吗？')) return; void connect() }
function selectMode(next: 'new' | 'folder') { if (busy.value) return; if (dirty.value && !window.confirm('切换后将放弃未保存的内容，继续吗？')) return; mode.value = next; original.value = undefined; filename.value = ''; folderName.value = ''; raw.value = template('新文档'); baseline.value = raw.value; releaseAssets() }
async function insertFiles(files: File[]) {
  if (busy.value) return
  error.value = ''
  const start = textarea.value?.selectionStart ?? raw.value.length, end = textarea.value?.selectionEnd ?? start
  const staged: PendingAsset[] = []
  try {
    for (const file of files) staged.push(stageMedia(file))
    const inserted = staged.map(asset => `\n![${asset.file.name.replace(/[\[\]\\\r\n]/g, '').slice(0, 100) || (asset.file.type.startsWith('video/') ? '视频' : '图片')}](${asset.source} "width=640")\n`).join('\n')
    assets.value.push(...staged)
    raw.value = raw.value.slice(0, start) + inserted + raw.value.slice(end)
    await nextTick(); textarea.value?.focus(); textarea.value?.setSelectionRange(start + inserted.length, start + inserted.length)
    selectedMedia.value = Math.max(0, mediaEntries.value.length - 1)
  } catch (e) { staged.forEach(asset => URL.revokeObjectURL(asset.objectUrl)); error.value = (e as Error).message }
}
function paste(event: ClipboardEvent) { const files = Array.from(event.clipboardData?.files || []); if (files.length) { event.preventDefault(); void insertFiles(files) } }
function drop(event: DragEvent) { const files = Array.from(event.dataTransfer?.files || []); if (files.length) { event.preventDefault(); void insertFiles(files) } }
function selectFiles(event: Event) { const input = event.target as HTMLInputElement; void insertFiles(Array.from(input.files || [])); input.value = '' }
function resizeMedia(reset = false) {
  const entry = mediaEntries.value[selectedMedia.value]
  if (!entry) return
  const width = Math.min(4096, Math.max(1, Math.round(Number(mediaWidth.value) || 640)))
  const height = mediaHeight.value ? Math.min(4096, Math.max(1, Math.round(Number(mediaHeight.value) || 1))) : ''
  const replacement = `![${entry.label}](${entry.source}${reset ? '' : ' "width=' + width + (height ? ' height=' + height : '') + '"'})`
  raw.value = raw.value.slice(0, entry.index) + replacement + raw.value.slice(entry.index + entry.text.length)
}
async function save() {
  if (busy.value || !localProject.connected) return
  error.value = ''; busy.value = true
  try {
    if (mode.value === 'folder') {
      const warning = await createLocalFolder(parent.value, folderName.value)
      folderName.value = ''; emit('saved', '目录已创建到本地项目'); if (warning) error.value = warning; else emit('update:open', false)
    } else {
      if (mode.value === 'new') validateName(filename.value.replace(/\.md$/i, ''))
      if (preview.value.error) throw new Error(preview.value.error)
      const snapshot = raw.value, savedPath = filePath.value
      const result = await saveLocalDocument(savedPath, snapshot, original.value, [...assets.value])
      baseline.value = snapshot; original.value = snapshot; originalPath.value = savedPath; mode.value = 'edit'; filename.value = ''; releaseAssets()
      emit('saved', '文档和媒体已保存到本地项目')
      if (result.warning) error.value = result.warning
      else if (raw.value === snapshot) { location.hash = docHref(result.id); emit('update:open', false) }
    }
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
async function reread() {
  if (dirty.value && !window.confirm('重新读取会放弃未保存的修改，继续吗？')) return
  error.value = ''; busy.value = true
  try { await reloadLocalProject(); initialise() } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
function keyboard(event: KeyboardEvent) { if (props.open && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void save() } }
function beforeUnload(event: BeforeUnloadEvent) { if (props.open && (dirty.value || busy.value)) event.preventDefault() }
onMounted(() => { window.addEventListener('keydown', keyboard); window.addEventListener('beforeunload', beforeUnload) })
onUnmounted(() => { releaseAssets(); window.removeEventListener('keydown', keyboard); window.removeEventListener('beforeunload', beforeUnload) })
</script>
<template>
  <Sheet :open="open" @update:open="changeOpen"><SheetContent side="right" class="local-editor-sheet">
    <div class="editor-heading"><div><SheetTitle>{{ mode === 'edit' ? '编辑文档' : mode === 'folder' ? '创建目录' : '创建文档' }}</SheetTitle><SheetDescription>{{ localProject.connected ? `本地项目 · ${localProject.name}` : '直接在你选择的项目文件夹中保存内容' }}</SheetDescription></div><span v-if="dirty && localProject.connected" class="unsaved-badge">未保存</span></div>
    <div v-if="!localProject.connected" class="editor-connect"><FolderOpen :size="30" /><h3>连接本地项目</h3><p>选择包含 <code>package.json</code> 和 <code>src/content</code> 的 AI2CC 项目文件夹，并允许浏览器编辑文件。</p><p>文档写入 <code>src/content</code>，图片和视频写入 <code>public/media</code>。内容保存在你的电脑上。</p><Button :disabled="busy || !localProject.supported" @click="connect"><FolderOpen :size="15" />选择项目文件夹</Button><p v-if="!localProject.supported" class="editor-warning">当前浏览器不支持文件夹读写。请使用桌面 Chrome 或 Edge 打开本地知识库后重试。</p><span class="editor-fineprint">网站无法在未经选择和授权的情况下访问本地文件。</span></div>
    <fieldset v-else class="editor-workarea" :disabled="busy" :inert="busy || undefined" :aria-busy="busy">
      <div v-if="mode !== 'edit'" class="creation-types"><button :class="{ active: mode === 'new' }" @click="selectMode('new')"><FilePlus2 :size="14" />文档</button><button :class="{ active: mode === 'folder' }" @click="selectMode('folder')"><FolderPlus :size="14" />目录</button></div>
      <div v-if="mode !== 'edit'" class="editor-file-fields"><label>所在目录<select v-model="parent" aria-label="所在目录"><option v-for="folder in folderOptions" :key="folder" :value="folder">{{ folder || '知识库根目录' }}</option></select></label><label v-if="mode === 'new'">文件名<input v-model="filename" aria-label="文件名" placeholder="例如：我的第一篇实践" /><span>.md</span></label><label v-else>目录名<input v-model="folderName" placeholder="例如：产品调研" /></label></div>
      <template v-if="mode !== 'folder'">
        <div class="editor-toolbar"><span class="editor-path" :title="filePath">{{ mode === 'edit' ? filePath : 'Markdown' }}</span><input ref="mediaInput" type="file" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime" multiple hidden @change="selectFiles" /><button title="插入图片或视频" @click="mediaInput?.click()"><ImagePlus :size="15" /><span>插入媒体</span></button><div class="editor-view-modes" aria-label="编辑视图"><button :aria-pressed="pane === 'source'" @click="pane = 'source'">源码</button><button :aria-pressed="pane === 'both'" @click="pane = 'both'">双栏</button><button :aria-pressed="pane === 'preview'" @click="pane = 'preview'">预览</button></div></div>
        <div :class="['editor-panes', 'pane-' + pane]"><textarea v-show="pane !== 'preview'" ref="textarea" v-model="raw" aria-label="Markdown 源码" spellcheck="false" placeholder="在这里输入 Markdown，也可以粘贴图片或视频文件…" @paste="paste" @drop="drop" @dragover.prevent /><div v-show="pane !== 'source'" class="editor-preview"><p v-if="preview.error" class="editor-warning">{{ preview.error }}</p><template v-else><h2>{{ preview.title }}</h2><div class="markdown" @click="(event: MouseEvent) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault() }" v-html="preview.html" /></template></div></div>
        <div v-if="mediaEntries.length" class="media-size-tools"><label>媒体<select v-model.number="selectedMedia"><option v-for="(entry, i) in mediaEntries" :key="entry.index" :value="i">{{ entry.label }}</option></select></label><label>宽<input v-model.number="mediaWidth" type="number" min="1" max="4096" aria-label="媒体宽度" />px</label><label>高<input v-model="mediaHeight" type="number" min="1" max="4096" placeholder="自动" aria-label="媒体高度" />px</label><button @click="resizeMedia()">应用尺寸</button><button @click="resizeMedia(true)">自适应</button></div>
        <p class="editor-media-hint">支持粘贴剪贴板提供的图片、视频文件，也可拖入或选择文件。只有文字链接时不会复制媒体。原文件保留，保存时使用唯一文件名。</p>
      </template>
      <div class="editor-footer"><button class="editor-reload" :disabled="busy" @click="reread">重新读取</button><button class="editor-reload" :disabled="busy" title="更换项目文件夹或重新授权" @click="reconnect">重新连接</button><span>仅保存到本地，线上更新需重新发布</span><Button size="sm" :disabled="busy || (mode === 'new' && !filename.trim()) || (mode === 'folder' && !folderName.trim())" @click="save"><LoaderCircle v-if="busy" class="spin" :size="14" /><Save v-else :size="14" />{{ busy ? '保存中…' : mode === 'folder' ? '创建目录' : '保存到项目' }}</Button></div>
    </fieldset>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
  </SheetContent></Sheet>
</template>
