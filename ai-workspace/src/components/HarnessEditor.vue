<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { Button } from '@/components/ui/button'
import { FolderOpen, Save, Download, Plus } from 'lucide-vue-next'
import { harnessFiles, harnessFile, validateHarnessFile, validateRoles, type RoleRegistry } from '@/lib/harness-files'
import { localProject, connectLocalProject, reconnectRememberedProject, readHarnessFile, writeHarnessFile } from '@/lib/local-workspace'
const folderConnected = computed(() => localProject.connected && localProject.mode === 'folder')
const emit = defineEmits<{ dirty: [value: boolean]; ready: [] }>()
const selectedPath = ref('AGENTS.md')
const selected = computed(() => harnessFile(selectedPath.value))
const text = ref(selected.value.template)
const baseline = ref(text.value), expected = ref<string | null>(null), connectionId = ref(-1)
const busy = ref(false), loaded = ref(false), error = ref(''), message = ref(''), preview = ref(false), advanced = ref(false)
const activeRole = ref('PM')
const roleData = ref<RoleRegistry>(JSON.parse(harnessFile('harness/roles.json').template))
const header = computed(() => selected.value.kind === 'skill' ? text.value.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/)?.[0] || '' : '')
const body = computed({ get: () => text.value.slice(header.value.length), set: value => { text.value = header.value + value } })
const raw = computed(() => selected.value.kind === 'roles' && !advanced.value ? JSON.stringify(roleData.value, null, 2) + '\n' : text.value)
const dirty = computed(() => raw.value !== baseline.value)
const renderer = new MarkdownIt({ html: false, linkify: true })
const previewHtml = computed(() => renderer.render(body.value))
watch(dirty, value => emit('dirty', value), { immediate: true })
function setContent(content: string) {
  text.value = content; advanced.value = false; preview.value = false
  if (selected.value.kind === 'roles') {
    try { roleData.value = validateRoles(JSON.parse(content)) }
    catch { advanced.value = true; error.value = '角色配置格式无效，请在 JSON 编辑框修正后保存。' }
  }
  baseline.value = raw.value
}
async function load() {
  if (!folderConnected.value) { loaded.value = false; expected.value = null; setContent(selected.value.template); return }
  busy.value = true; error.value = ''; loaded.value = false
  const id = localProject.connectionId, path = selectedPath.value
  try {
    const content = await readHarnessFile(path)
    if (id !== localProject.connectionId || path !== selectedPath.value) throw new Error('项目已改变，请重新读取。')
    connectionId.value = id; expected.value = content
    setContent(content ?? selected.value.template); loaded.value = true
    message.value = content === null ? '此工程还没有该规则，已载入模板，点击保存即可创建。' : '已读取工程中的实际规则。'
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
async function choose(event: Event) {
  const input = event.target as HTMLSelectElement
  if (dirty.value && !window.confirm('当前规则尚未保存，切换会放弃修改，继续吗？')) { input.value = selectedPath.value; return }
  selectedPath.value = input.value; message.value = ''; error.value = ''; await load()
}
async function reload() {
  if (dirty.value && !window.confirm('重新读取会放弃当前修改，继续吗？')) return
  await load()
}
async function connect(remembered: boolean) {
  if (dirty.value && !window.confirm('连接后会读取工程中的规则并替换当前草稿，继续吗？')) return
  busy.value = true; error.value = ''
  try { if (remembered) await reconnectRememberedProject(); else await connectLocalProject(); await load() }
  catch (e) { if ((e as DOMException).name !== 'AbortError') error.value = (e as Error).message }
  finally { busy.value = false }
}
async function save() {
  busy.value = true; error.value = ''; message.value = ''
  try {
    if (!loaded.value) throw new Error('请先连接并读取工程中的规则。')
    const content = raw.value
    await writeHarnessFile(selectedPath.value, content, expected.value, connectionId.value)
    if (connectionId.value !== localProject.connectionId) { loaded.value = false; throw new Error('内容已保存到原工程，但当前项目已切换，请重新读取。') }
    expected.value = content; baseline.value = content
    message.value = '已保存到工程，Agent 后续读取时使用新规则。团队共享需要提交这些规则文件。'
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
function download() {
  error.value = ''
  try {
    validateHarnessFile(selectedPath.value, raw.value)
    const url = URL.createObjectURL(new Blob([raw.value], { type: selected.value.kind === 'roles' ? 'application/json' : 'text/markdown' }))
    const a = document.createElement('a'); a.href = url; a.download = selectedPath.value.split('/').at(-1)!; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.value = `已生成下载文件，请放到工程的 ${selectedPath.value}。`
  } catch (e) { error.value = (e as Error).message }
}
function changeAdvanced(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  if (checked) { text.value = raw.value; advanced.value = true }
  else {
    try { roleData.value = validateRoles(JSON.parse(text.value)); advanced.value = false; error.value = '' }
    catch (e) { (event.target as HTMLInputElement).checked = true; error.value = (e as Error).message }
  }
}
watch(() => [folderConnected.value, localProject.connectionId] as const, () => {
  loaded.value = false
  if (busy.value) return
  if (dirty.value) { error.value = '项目已切换，草稿已保留。请下载备份，再重新读取目标项目规则。'; return }
  void load()
}, { immediate: true })
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) event.preventDefault() }
onMounted(() => { window.addEventListener('beforeunload', beforeUnload); emit('ready') })
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); emit('dirty', false) })
</script>
<template>
  <div class="workspace-settings harness-editor">
    <section class="settings-connection">
      <strong>{{ folderConnected ? `已连接 · ${localProject.name}` : '工程自带的团队规则，在这里维护' }}</strong>
      <p>选择要修改的规则，编辑后保存到当前 workspace。角色约束使用表单，其余规则可以直接编辑文字。</p>
      <div v-if="!folderConnected" class="settings-actions"><Button v-if="localProject.rememberedName" variant="outline" :disabled="busy || localProject.restoring || !localProject.supported" @click="connect(true)">连接 {{ localProject.rememberedName }}</Button><Button :disabled="busy || localProject.restoring || !localProject.supported" @click="connect(false)"><FolderOpen :size="15" />连接 workspace</Button></div>
      <p v-if="!localProject.supported" class="settings-hint">当前浏览器不能直接写入工程，可先编辑并下载规则文件。桌面 Chrome / Edge 授权目录后可直接保存。</p>
    </section>
    <fieldset :disabled="busy" class="settings-fields">
      <label class="harness-file-picker">要维护的规则<select :value="selectedPath" @change="choose"><option v-for="file in harnessFiles" :key="file.path" :value="file.path">{{ file.label }}</option></select></label>
      <div class="harness-file-note"><span>{{ selectedPath }}</span><span v-if="dirty">未保存</span><span v-else>{{ loaded ? '工程文件' : '模板内容' }}</span></div>
      <template v-if="selected.kind === 'roles'">
        <p class="settings-hint">团队共同使用这份职责表。修改目录只改变 Agent 工作范围，不会移动现有资料。个人选择哪些角色仍在“配置中心”设置。</p>
        <label class="harness-advanced"><input type="checkbox" :checked="advanced" @change="changeAdvanced" />高级：编辑 JSON</label>
        <template v-if="!advanced">
          <label class="harness-file-picker">角色<select v-model="activeRole"><option v-for="(role, id) in roleData.roles" :key="id" :value="id">{{ id }} · {{ role.name }}</option></select></label>
          <div v-if="roleData.roles[activeRole]" class="harness-role-form">
            <label>角色名称<input v-model="roleData.roles[activeRole]!.name" /></label>
            <label>职责说明<textarea v-model="roleData.roles[activeRole]!.outputs" rows="3" /></label>
            <label>可修改目录</label>
            <div v-for="(_directory, index) in roleData.roles[activeRole]!.directories" :key="index" class="harness-directory"><input v-model="roleData.roles[activeRole]!.directories[index]" :aria-label="`可修改目录 ${index + 1}`" list="harness-directories" /><button class="settings-remove" @click="roleData.roles[activeRole]!.directories.splice(index, 1)">移除</button></div>
            <datalist id="harness-directories"><option v-for="folder in localProject.folders" :key="folder" :value="`src/content/${folder}`" /></datalist>
            <Button variant="outline" @click="roleData.roles[activeRole]!.directories.push('')"><Plus :size="15" />添加可修改目录</Button>
            <p class="settings-hint">可以选择已有资料目录，或填写 src/content/、public/media/ 下的目录。多个角色的修改范围取并集。</p>
          </div>
        </template>
        <textarea v-else v-model="text" class="harness-textarea" rows="22" aria-label="角色配置 JSON" spellcheck="false" />
      </template>
      <template v-else>
        <div class="settings-actions harness-view"><Button variant="outline" :aria-pressed="!preview" @click="preview = false">编辑文字</Button><Button variant="outline" :aria-pressed="preview" @click="preview = true">阅读预览</Button></div>
        <p v-if="selected.kind === 'skill'" class="settings-hint">在这里编辑这个角色的工作方式和注意事项，技能名称等元信息自动保留。</p>
        <div v-if="preview" class="markdown harness-preview" v-html="previewHtml" />
        <textarea v-else v-model="body" class="harness-textarea" rows="22" aria-label="规则内容" spellcheck="false" />
      </template>
      <div class="settings-actions harness-save"><Button :disabled="!loaded || !folderConnected" @click="save"><Save :size="15" />{{ busy ? '处理中…' : '保存到工程' }}</Button><Button variant="outline" @click="download"><Download :size="15" />下载当前规则</Button><Button variant="ghost" @click="reload">重新读取</Button></div>
    </fieldset>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p><p v-if="message" class="settings-message" role="status">{{ message }}</p>
    <p class="settings-hint">这里维护团队可共享的 harness 文件；个人仓库路径仍保存在被 Git 忽略的 projects.local.json。保存后新 Agent 会话可读取最新规则，已运行的会话需要重新读取。</p>
  </div>
</template>
