<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { stringify } from 'yaml'
import { FolderOpen, Save, ImagePlus, FolderPlus, FilePlus2, ChevronRight, LoaderCircle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { workspaceService, discoverWorkspaceService } from '@/lib/workspace-service'
import { clean, docs, parseDocument, renderDocument, docHref, type Doc } from '@/lib/content'
import { reconnectRememberedProject, connectLocalProject, connectServiceProject, disconnectServiceProject, createLocalFolder, localAsset, localProject, reloadLocalProject, saveLocalDocument, stageMedia, validateName, type PendingAsset } from '@/lib/local-workspace'
const props = defineProps<{ open: boolean; mode: 'edit' | 'new' | 'folder'; document?: Doc; creationParent?: string }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; saved: [message: string]; created: [value: { mode: 'new' | 'folder'; path: string }]; 'close-auto-focus': [event: Event] }>()
const mode = ref(props.mode)
const serviceConsent = ref(false)
const isDevelopment = import.meta.env.DEV
const raw = ref(''), baseline = ref(''), original = ref<string>(), filename = ref(''), parent = ref(''), error = ref(''), busy = ref(false), pane = ref<'both' | 'source' | 'preview'>('both')
const originalPath = ref(''), folderName = ref('')
const textarea = ref<HTMLTextAreaElement>(), mediaInput = ref<HTMLInputElement>(), nameInput = ref<HTMLInputElement>()
const assets = ref<PendingAsset[]>([])
const selectedMedia = ref(0), mediaWidth = ref(640), mediaHeight = ref('')
const dirty = computed(() => raw.value !== baseline.value || (mode.value === 'new' && !!filename.value) || (mode.value === 'folder' && !!folderName.value))
const documentName = computed(() => filename.value.trim().replace(/\.md$/i, '').trim())
const creationName = computed(() => mode.value === 'folder' ? folderName.value.trim() : documentName.value + '.md')
const filePath = computed(() => mode.value === 'edit' ? originalPath.value : [parent.value, documentName.value + '.md'].filter(Boolean).join('/'))
const creationPath = computed(() => [parent.value, creationName.value].filter(Boolean).join('/'))
const parentBreadcrumbs = computed(() => parent.value.split('/').filter(Boolean).map(clean))
const parentError = computed(() => mode.value !== 'edit' && localProject.connected && parent.value && !localProject.folders.includes(parent.value)
  ? '所选目录在当前连接的空间中不存在。请关闭面板，从目录树重新选择创建位置，或连接包含该目录的空间。' : '')
const nameError = computed(() => {
  if (mode.value === 'edit' || !(mode.value === 'folder' ? folderName.value : filename.value)) return ''
  try {
    if (mode.value === 'new') validateName(documentName.value)
    validateName(creationName.value)
    if (creationName.value.startsWith('.') || /\x7f/.test(creationName.value)) return '名称不能以点开头或包含特殊控制字符。'
    if (localProject.connected && (localProject.folders.includes(creationPath.value) || docs.some(doc => doc.path === creationPath.value))) return '这个位置已存在同名文件或目录，请换一个名称。'
    return ''
  } catch (e) { return (e as Error).message }
})
const displayedDestination = computed(() => 'src/content/' + [parent.value, (mode.value === 'folder' ? folderName.value.trim() || '目录名' : documentName.value ? documentName.value + '.md' : '文档名.md')].filter(Boolean).join('/') + (mode.value === 'folder' ? '/' : ''))
const cannotCreate = computed(() => !!parentError.value || !!nameError.value || (mode.value === 'new' && !documentName.value) || (mode.value === 'folder' && !folderName.value.trim()))
const preview = computed(() => {
  try {
    const doc = parseDocument(filePath.value || 'preview.md', raw.value)
    return { title: doc.title, html: renderDocument(doc, [...docs.filter(d => d.path !== doc.path), doc], source => assets.value.find(asset => asset.source === source)?.objectUrl || localAsset(source)), error: '' }
  } catch (e) { return { title: '', html: '', error: (e as Error).message } }
})
const mediaEntries = computed(() => [...raw.value.matchAll(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)/g)].map(match => ({ index: match.index!, text: match[0], label: match[1] || '媒体文件', source: match[2]!, title: match[3] || '' })))
function releaseAssets() { assets.value.forEach(asset => URL.revokeObjectURL(asset.objectUrl)); assets.value = [] }
function template(title: string) { return '---\n' + stringify({ title, slug: 'doc-' + crypto.randomUUID().slice(0, 12), description: '', date: new Date().toLocaleDateString('en-CA'), status: '草稿' }) + '---\n\n## 开始记录\n\n' }
function initialise(resetTarget = false) {
  releaseAssets(); error.value = ''; busy.value = false; mode.value = props.mode; pane.value = 'both'; selectedMedia.value = 0
  const doc = docs.find(d => d.path === props.document?.path) || props.document
  originalPath.value = doc?.path || ''
  if (resetTarget) parent.value = props.creationParent ?? doc?.path.split('/').slice(0, -1).join('/') ?? ''
  filename.value = ''; folderName.value = ''
  original.value = mode.value === 'edit' ? doc?.raw : undefined
  raw.value = original.value ?? template('新文档'); baseline.value = raw.value
}
watch(() => props.open, open => {
  serviceConsent.value = false
  if (open) { initialise(true); void discoverWorkspaceService() } else releaseAssets()
}, { immediate: true })
watch(() => localProject.connected, connected => { if (connected && props.open && !busy.value && !dirty.value) initialise() })
watch(documentName, name => { if (mode.value === 'new' && name) raw.value = raw.value.replace(/^title:.*$/m, 'title: ' + JSON.stringify(name)) })
async function focusCreationName() {
  await nextTick()
  if (props.open && localProject.connected && mode.value !== 'edit') nameInput.value?.focus()
}
function focusOnOpen(event: Event) {
  if (localProject.connected && mode.value !== 'edit') { event.preventDefault(); void focusCreationName() }
}
watch([selectedMedia, mediaEntries], () => {
  const entry = mediaEntries.value[selectedMedia.value]
  if (entry) { mediaWidth.value = Number(entry.title.match(/width=(\d+)/)?.[1] || 640); mediaHeight.value = entry.title.match(/height=(\d+)/)?.[1] || '' }
})
function changeOpen(open: boolean) {
  if (!open && busy.value) return
  if (!open && dirty.value && !window.confirm('还有未保存的内容。确定关闭并放弃这些修改吗？')) return
  emit('update:open', open)
}
async function connect(remembered = false) {
  if (dirty.value && !window.confirm('连接所选文件夹会替换当前未保存的草稿，继续吗？')) return
  error.value = ''; busy.value = true
  try { if (remembered) await reconnectRememberedProject(); else await connectLocalProject(); initialise() } catch (e) { if ((e as DOMException).name !== 'AbortError') error.value = (e as Error).message } finally { busy.value = false; void focusCreationName() }
}
async function showServiceConsent() {
  error.value = ''
  await discoverWorkspaceService()
  if (workspaceService.info) serviceConsent.value = true
}
async function connectService() {
  const preserveDraft = dirty.value
  error.value = ''; busy.value = true
  try {
    await connectServiceProject()
    serviceConsent.value = false
    if (!preserveDraft) initialise()
  } catch (e) { error.value = (e as Error).message }
  finally { busy.value = false; void focusCreationName() }
}
async function disconnectService() {
  error.value = ''; busy.value = true
  try { await disconnectServiceProject() }
  catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
function reconnect() {
  if (localProject.mode === 'service') { void disconnectService(); return }
  void connect()
}
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
  if (mode.value !== 'edit' && cannotCreate.value) { error.value = parentError.value || nameError.value || '请先填写名称。'; return }
  error.value = ''; busy.value = true
  try {
    if (mode.value === 'folder') {
      const savedPath = creationPath.value
      const warning = await createLocalFolder(parent.value, folderName.value.trim())
      folderName.value = ''; emit('created', { mode: 'folder', path: savedPath }); emit('saved', '目录已创建到本地项目'); if (warning) error.value = warning; else emit('update:open', false)
    } else {
      const creating = mode.value === 'new'
      if (creating) validateName(documentName.value)
      if (preview.value.error) throw new Error(preview.value.error)
      const snapshot = raw.value, savedPath = filePath.value
      const result = await saveLocalDocument(savedPath, snapshot, original.value, [...assets.value])
      baseline.value = snapshot; original.value = snapshot; originalPath.value = savedPath; mode.value = 'edit'; filename.value = ''; releaseAssets()
      if (creating) emit('created', { mode: 'new', path: savedPath })
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
  <Sheet :open="open" @update:open="changeOpen"><SheetContent side="right" class="local-editor-sheet" @open-auto-focus="focusOnOpen" @close-auto-focus="emit('close-auto-focus', $event)">
    <div class="editor-heading"><div><SheetTitle>{{ mode === 'edit' ? '编辑文档' : mode === 'folder' ? '创建目录' : '创建文档' }}</SheetTitle><SheetDescription>{{ localProject.connected ? `本地项目 · ${localProject.name}` : '直接在你选择的项目文件夹中保存内容' }}</SheetDescription></div><span v-if="dirty" class="unsaved-badge">未保存</span></div>
    <div v-if="mode !== 'edit'" class="creation-location">
      <div class="creation-location-heading"><FolderPlus v-if="mode === 'folder'" :size="16" /><FilePlus2 v-else :size="16" /><span>{{ mode === 'folder' ? '在此目录下创建子目录' : '在此目录下创建 Markdown 文档' }}</span></div>
      <nav class="creation-breadcrumbs" aria-label="创建位置"><span>知识库</span><template v-for="(segment, index) in parentBreadcrumbs" :key="index"><ChevronRight :size="13" aria-hidden="true" /><span>{{ segment }}</span></template></nav>
      <p class="creation-destination">保存位置 <code>{{ displayedDestination }}</code></p>
      <p class="creation-location-hint">{{ mode === 'folder' ? '目录用于组织文档和子目录，不含正文。' : '文档用于记录内容，自动添加 .md 后缀。' }}</p>
      <p v-if="parentError" class="editor-warning creation-parent-error" role="alert">{{ parentError }}</p>
    </div>
    <div v-if="!localProject.connected" class="editor-connect">
      <FolderOpen :size="30" /><h3>{{ serviceConsent ? '授权编辑当前空间' : '连接本地项目' }}</h3>
      <p v-if="dirty" class="editor-fineprint" role="status">当前编辑草稿已保留，重新授权后可继续保存。</p>
      <template v-if="serviceConsent">
        <p>允许本页面编辑以下 workspace 的知识资料：</p>
        <div class="settings-scope"><strong>{{ workspaceService.info?.name }}</strong><p class="settings-workspace-path">{{ workspaceService.info?.path }}</p></div>
        <p>读取和保存 <code>src/content</code> 下的 Markdown，创建资料目录、调整目录顺序；将插入的图片和视频保存到 <code>public/media</code>。</p>
        <p>点击保存后才写入文件。可随时解除连接，刷新页面或重启服务后需要重新授权。</p>
        <div class="settings-actions"><Button :disabled="busy" @click="connectService"><FolderOpen :size="15" />{{ busy ? '正在连接…' : '允许并连接' }}</Button><Button variant="outline" :disabled="busy" @click="serviceConsent = false">取消</Button></div>
      </template>
      <template v-else>
        <template v-if="workspaceService.info">
          <p>当前空间：<strong>{{ workspaceService.info.name }}</strong></p>
          <p class="settings-workspace-path">{{ workspaceService.info.path }}</p>
          <p>授权连接后可直接编辑文档、创建目录并保存媒体。内容保存在你的电脑上。</p>
          <Button :disabled="busy || workspaceService.checking" @click="showServiceConsent"><FolderOpen :size="15" />授权连接当前空间</Button>
        </template>
        <template v-if="localProject.supported">
          <p>也可选择包含 <code>package.json</code> 和 <code>src/content</code> 的 workspace 文件夹，并允许浏览器编辑文件。</p>
          <Button v-if="localProject.rememberedName" variant="outline" :disabled="busy || localProject.restoring" @click="connect(true)">连接 {{ localProject.rememberedName }}</Button>
          <Button :variant="workspaceService.info || localProject.rememberedName ? 'outline' : 'default'" :disabled="busy || localProject.restoring" @click="connect(false)"><FolderOpen :size="15" />选择项目文件夹</Button>
        </template>
        <Button v-if="isDevelopment && !workspaceService.info" :disabled="busy || workspaceService.checking" @click="discoverWorkspaceService">{{ workspaceService.checking ? '正在检测本地空间…' : '重试连接本地空间' }}</Button>
        <p v-if="workspaceService.error" class="editor-warning" role="status">{{ workspaceService.error }}</p>
        <p v-if="!localProject.supported && !workspaceService.info && !workspaceService.checking" class="editor-warning">请在目标 workspace 运行 <code>npm run dev</code>，打开对应地址后授权编辑。静态站点需使用支持文件夹授权的浏览器。</p>
        <p v-if="localProject.restoreError" class="editor-warning" role="status">{{ localProject.restoreError }}</p>
        <span class="editor-fineprint">授权范围为当前空间的文档、目录与媒体；个人配置需在配置中心单独授权。</span>
      </template>
    </div>
    <fieldset v-else class="editor-workarea" :disabled="busy" :inert="busy || undefined" :aria-busy="busy">
      <div v-if="mode !== 'edit'" class="editor-file-fields creation-name-fields"><label v-if="mode === 'new'">文件名<input ref="nameInput" v-model="filename" aria-label="文件名" :aria-invalid="!!nameError" aria-describedby="creation-name-hint" placeholder="例如：我的第一篇实践" /><span>.md</span></label><label v-else>目录名<input ref="nameInput" v-model="folderName" aria-label="目录名" :aria-invalid="!!nameError" aria-describedby="creation-name-hint" placeholder="例如：产品调研" /></label><p id="creation-name-hint" :class="['creation-name-hint', { 'creation-name-error': nameError }]" :role="nameError ? 'status' : undefined">{{ nameError || '只填写名称；创建位置由左侧目录树确定。' }}</p></div>
      <template v-if="mode !== 'folder'">
        <div class="editor-toolbar"><span class="editor-path" :title="filePath">{{ mode === 'edit' ? filePath : 'Markdown' }}</span><input ref="mediaInput" type="file" accept="image/*,video/mp4,video/webm,video/ogg,video/quicktime" multiple hidden @change="selectFiles" /><button title="插入图片或视频" @click="mediaInput?.click()"><ImagePlus :size="15" /><span>插入媒体</span></button><div class="editor-view-modes" aria-label="编辑视图"><button :aria-pressed="pane === 'source'" @click="pane = 'source'">源码</button><button :aria-pressed="pane === 'both'" @click="pane = 'both'">双栏</button><button :aria-pressed="pane === 'preview'" @click="pane = 'preview'">预览</button></div></div>
        <div :class="['editor-panes', 'pane-' + pane]"><textarea v-show="pane !== 'preview'" ref="textarea" v-model="raw" aria-label="Markdown 源码" spellcheck="false" placeholder="在这里输入 Markdown，也可以粘贴图片或视频文件…" @paste="paste" @drop="drop" @dragover.prevent /><div v-show="pane !== 'source'" class="editor-preview"><p v-if="preview.error" class="editor-warning">{{ preview.error }}</p><template v-else><h2>{{ preview.title }}</h2><div class="markdown" @click="(event: MouseEvent) => { if ((event.target as HTMLElement).closest('a')) event.preventDefault() }" v-html="preview.html" /></template></div></div>
        <div v-if="mediaEntries.length" class="media-size-tools"><label>媒体<select v-model.number="selectedMedia"><option v-for="(entry, i) in mediaEntries" :key="entry.index" :value="i">{{ entry.label }}</option></select></label><label>宽<input v-model.number="mediaWidth" type="number" min="1" max="4096" aria-label="媒体宽度" />px</label><label>高<input v-model="mediaHeight" type="number" min="1" max="4096" placeholder="自动" aria-label="媒体高度" />px</label><button @click="resizeMedia()">应用尺寸</button><button @click="resizeMedia(true)">自适应</button></div>
        <p class="editor-media-hint">支持粘贴剪贴板提供的图片、视频文件，也可拖入或选择文件。只有文字链接时不会复制媒体。原文件保留，保存时使用唯一文件名。</p>
      </template>
      <div class="editor-footer"><button class="editor-reload" :disabled="busy" @click="reread">重新读取</button><button class="editor-reload" :disabled="busy" :title="localProject.mode === 'service' ? '解除当前文档编辑授权并保留草稿' : '更换项目文件夹或重新授权'" @click="reconnect">{{ localProject.mode === 'service' ? '解除连接' : '重新连接' }}</button><span>仅保存到本地，线上更新需重新发布</span><Button size="sm" :disabled="busy || (mode !== 'edit' && cannotCreate)" @click="save"><LoaderCircle v-if="busy" class="spin" :size="14" /><Save v-else :size="14" />{{ busy ? '保存中…' : mode === 'folder' ? '创建目录' : '保存到项目' }}</Button></div>
    </fieldset>
    <p v-if="localProject.storageWarning" class="editor-warning" role="status">{{ localProject.storageWarning }}</p>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
  </SheetContent></Sheet>
</template>
<style scoped>
.editor-heading > div { min-width: 0; overflow-wrap: anywhere; }
.unsaved-badge { white-space: nowrap; flex-shrink: 0; }
.creation-location { flex-shrink: 0; max-height: 32vh; overflow-y: auto; margin-bottom: 18px; padding: 13px 15px; border: 1px solid #e3e8f0; border-radius: 7px; background: #f8faff; color: #536073; }
.creation-location-heading { display: flex; align-items: center; gap: 7px; font-size: 12px; color: #66758d; }
.creation-breadcrumbs { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; margin: 8px 0; font-size: 14px; font-weight: 500; overflow-wrap: anywhere; }
.creation-breadcrumbs svg { flex-shrink: 0; color: #8c96a6; }
.creation-destination { display: flex; gap: 8px; align-items: baseline; font-size: 12px; line-height: 1.6; }
.creation-destination code { min-width: 0; font-size: 12px; overflow-wrap: anywhere; color: #475875; }
.creation-location-hint, .creation-name-hint { margin: 6px 0 0; font-size: 12px; line-height: 1.6; color: #727c8e; }
.creation-parent-error { margin-top: 10px; }
.creation-name-fields { grid-template-columns: 1fr; gap: 0; flex-shrink: 0; }
.creation-name-fields label { max-width: 560px; }
.creation-name-fields input:focus-visible { outline: 2px solid #9cadcf; outline-offset: 2px; }
.creation-name-error { color: #ad593c; }
.editor-connect { min-height: 0; overflow-y: auto; margin: 22px auto; }
.editor-workarea { overflow-y: auto; }
[data-theme=dark] .creation-location { background: #202735; border-color: #3c4657; color: #d0daeb; }
[data-theme=dark] .creation-location-heading, [data-theme=dark] .creation-location-hint, [data-theme=dark] .creation-name-hint { color: #aab6c9; }
[data-theme=dark] .creation-destination code { color: #c1cde3; }
[data-theme=dark] .creation-name-error { color: #f0b299; }
@media (max-width: 760px) {
  .creation-location { padding: 10px 12px; margin-bottom: 13px; }
  .creation-breadcrumbs { font-size: 13px; }
  .creation-destination { display: block; }
  .creation-destination code { display: block; margin-top: 2px; }
}
</style>
