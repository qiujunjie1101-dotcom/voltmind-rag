<script setup lang="ts">
import hljs from 'highlight.js/lib/common'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { FolderOpen, Plus, Save, Download, Trash2, Check } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { workspaceService, discoverWorkspaceService, authorizeWorkspaceService, revokeWorkspaceService, readServiceSettings, writeServiceSettings } from '@/lib/workspace-service'
import { roleDefinitions as templateRoles, validateConfig, type WorkspaceConfig } from '../../harness/config.mjs'
import { site } from '@/site.config'
import agentGuideTemplate from '../../AGENTS.md?raw'
import harnessGuideTemplate from '../../harness/README.md?raw'
import { localProject, connectLocalProject, reconnectRememberedProject, readWorkspaceSettings, writeWorkspaceSettings, localHarnessRoles, readHarnessFile } from '@/lib/local-workspace'
const emit = defineEmits<{ dirty: [value: boolean]; ready: [] }>()
const agentGuide = ref(agentGuideTemplate), harnessGuide = ref(harnessGuideTemplate)
const agentFromProject = ref(false), guideFromProject = ref(false)
const target = ref<'server' | 'folder'>(workspaceService.connected ? 'server' : 'folder')
const connected = computed(() => target.value === 'server' ? workspaceService.connected : localProject.connected && localProject.mode === 'folder')
const connectionId = computed(() => target.value === 'server' ? workspaceService.connectionId : localProject.connectionId)
const connectionName = computed(() => target.value === 'server' ? workspaceService.info?.name : localProject.name)
const authorizationOpen = ref(false)
const isDevelopment = import.meta.env.DEV
const roleDefinitions = computed(() => target.value === 'server' ? templateRoles : localHarnessRoles.value)
const config = ref<WorkspaceConfig>({ $schema: './projects.schema.json', version: 1, workspace: { name: site.name }, roles: [], projects: [] })
const busy = ref(false), error = ref(''), message = ref(''), loaded = ref(false)
const source = ref<string | null>(null)
const sourceConnectionId = ref(-1)
const initial = ref(JSON.stringify(config.value))
const importedDraft = ref(false)
const dirty = computed(() => importedDraft.value || JSON.stringify(config.value) !== initial.value)
watch(dirty, value => emit('dirty', value), { immediate: true })
onMounted(() => { emit('ready'); void discoverWorkspaceService() })
const selectedDirectories = computed(() => [...new Set(config.value.roles.flatMap(role => roleDefinitions.value[role]?.directories || []))])
const preview = computed(() => JSON.stringify(config.value, null, 2))
const highlightedPreview = computed(() => hljs.highlight(preview.value, { language: 'json' }).value)
async function load(preserveDraft = false) {
  busy.value = true; error.value = ''; loaded.value = false
  try {
    const selectedId = connectionId.value, selectedTarget = target.value
    const [raw, , agentRaw, harnessRaw] = selectedTarget === 'server'
      ? [await readServiceSettings(), null, null, null]
      : await Promise.all([readWorkspaceSettings(), readHarnessFile('harness/roles.json'), readHarnessFile('AGENTS.md'), readHarnessFile('harness/README.md')])
    if (!connected.value || selectedId !== connectionId.value || selectedTarget !== target.value) throw new Error('连接的项目已变化，请重新读取配置。')
    agentFromProject.value = agentRaw !== null; guideFromProject.value = harnessRaw !== null
    agentGuide.value = agentRaw ?? agentGuideTemplate; harnessGuide.value = harnessRaw ?? harnessGuideTemplate
    const next = raw ? validateConfig(JSON.parse(raw)) : { ...config.value, roles: [], projects: [] }
    sourceConnectionId.value = selectedId
    if (!preserveDraft) { config.value = next; importedDraft.value = false }
    source.value = raw; initial.value = JSON.stringify(next); loaded.value = true
    message.value = preserveDraft ? '空间已绑定，当前草稿已保留。点击“保存到本地项目”后写入配置。' : raw ? '已读取本地配置。' : '尚无本地配置，填写后保存即可创建。'
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
async function connect(remembered: boolean) {
  const preserveDraft = dirty.value
  busy.value = true; error.value = ''
  try {
    if (remembered) await reconnectRememberedProject(); else await connectLocalProject()
    target.value = 'folder'
    await load(preserveDraft)
  } catch (e) { if ((e as DOMException).name !== 'AbortError') error.value = (e as Error).message }
  finally { busy.value = false }
}
async function showAuthorization() {
  await discoverWorkspaceService()
  if (workspaceService.info) authorizationOpen.value = true
}
async function authorize() {
  const preserveDraft = dirty.value
  busy.value = true; error.value = ''
  try {
    await authorizeWorkspaceService()
    target.value = 'server'
    authorizationOpen.value = false
    await load(preserveDraft)
  } catch (e) { error.value = (e as Error).message }
  finally { busy.value = false }
}
async function disconnect() {
  busy.value = true; error.value = ''
  try { await revokeWorkspaceService(); message.value = '已解除绑定，当前草稿已保留。' }
  catch { message.value = '本页已解除绑定，服务暂不可用。重新保存前需要再次授权。' }
  finally { loaded.value = false; busy.value = false }
}
async function reload() {
  if (dirty.value && !window.confirm('重新读取会替换未保存的配置，继续吗？')) return
  await load()
}
async function save() {
  busy.value = true; error.value = ''; message.value = ''
  try {
    if (!loaded.value) throw new Error('请先读取本地配置，再保存。')
    const next = validateConfig(config.value)
    source.value = target.value === 'server'
      ? await writeServiceSettings(JSON.stringify(next), source.value, sourceConnectionId.value)
      : await writeWorkspaceSettings(JSON.stringify(next), source.value, sourceConnectionId.value)
    config.value = next; importedDraft.value = false; initial.value = JSON.stringify(next); message.value = '已保存到 code/projects.local.json。'
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
function download() {
  error.value = ''; message.value = ''
  try {
    const next = validateConfig(config.value)
    const url = URL.createObjectURL(new Blob([JSON.stringify(next, null, 2) + '\n'], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = 'projects.local.json'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    message.value = '已生成配置文件，请放入 workspace 的 code/ 目录；下载不会直接修改项目。'
  } catch (e) { error.value = (e as Error).message }
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement, file = input.files?.[0]
  if (!file) return
  if (dirty.value && !window.confirm('导入配置会替换当前草稿，继续吗？')) { input.value = ''; return }
  try { config.value = validateConfig(JSON.parse(await file.text())); importedDraft.value = true; message.value = '已导入草稿，保存到项目或下载后生效。'; error.value = '' }
  catch (e) { error.value = (e as Error).message }
  input.value = ''
}
watch(() => [connected.value, target.value, connectionId.value] as const, ([isConnected]) => {
  loaded.value = false
  agentGuide.value = agentGuideTemplate; harnessGuide.value = harnessGuideTemplate
  agentFromProject.value = false; guideFromProject.value = false
  if (!isConnected || busy.value) return
  if (dirty.value) { error.value = '连接的 workspace 已变化。当前草稿已保留，请确认目标空间后重新绑定。'; return }
  void load()
}, { immediate: true })
function beforeUnload(event: BeforeUnloadEvent) { if (dirty.value) event.preventDefault() }
window.addEventListener('beforeunload', beforeUnload)
onBeforeUnmount(() => { window.removeEventListener('beforeunload', beforeUnload); emit('dirty', false) })
</script>
<template>
  <div class="workspace-settings">
    <section class="settings-connection">
      <div><strong>{{ connected ? `已绑定 · ${connectionName}` : '配置当前电脑上的 workspace' }}</strong><p>授权绑定空间后，可将项目路径和角色保存到本地配置文件。</p></div>
      <div class="settings-actions">
        <template v-if="!connected">
          <Button v-if="workspaceService.info" :disabled="busy || workspaceService.checking" @click="showAuthorization"><FolderOpen :size="15" />授权绑定当前空间</Button>
          <Button v-if="localProject.rememberedName && localProject.supported" variant="outline" :disabled="busy || localProject.restoring" @click="connect(true)">连接 {{ localProject.rememberedName }}</Button>
          <Button v-if="localProject.supported" :variant="workspaceService.info ? 'outline' : 'default'" :disabled="busy || localProject.restoring" @click="connect(false)"><FolderOpen :size="15" />选择 workspace 文件夹</Button>
          <Button v-if="isDevelopment && !workspaceService.info" variant="outline" :disabled="busy || workspaceService.checking" @click="discoverWorkspaceService">{{ workspaceService.checking ? '正在检测本地空间…' : '重试连接本地空间' }}</Button>
        </template>
        <template v-else>
          <Button variant="outline" :disabled="busy" @click="reload">重新读取配置</Button>
          <Button v-if="target === 'server'" variant="outline" :disabled="busy" @click="disconnect">解除绑定</Button>
        </template>
      </div>
      <p v-if="workspaceService.info && (!connected || target === 'server')" class="settings-hint">当前空间：<code class="settings-workspace-path">{{ workspaceService.info.path }}</code>。授权仅用于读取和保存本空间的个人配置，刷新页面后需要重新授权。</p>
      <p v-if="workspaceService.error && !connected" class="settings-hint" role="status">{{ workspaceService.error }}</p>
      <p v-if="!localProject.supported && !workspaceService.info && !workspaceService.checking" class="settings-hint">请通过 <code>npm run dev</code> 启动空间以启用授权保存；静态站点可导入、下载配置，或用支持文件夹授权的浏览器打开。</p>
      <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
    </section>
    <Sheet :open="authorizationOpen" @update:open="value => { if (!busy) authorizationOpen = value }">
      <SheetContent class="workspace-authorization">
        <SheetTitle>授权绑定当前空间</SheetTitle>
        <SheetDescription>确认后，本页面可以读取并保存下方空间的个人配置。</SheetDescription>
        <div class="settings-scope"><strong>{{ workspaceService.info?.name }}</strong><p class="settings-workspace-path">{{ workspaceService.info?.path }}</p></div>
        <p>允许读写：<code>code/projects.local.json</code>。</p>
        <p>导入的配置会保留为草稿，点击保存后才写入文件。你可以随时解除绑定。</p>
        <p class="settings-hint">如需绑定其他空间，请从目标 workspace 启动开发服务后打开对应地址。</p>
        <p v-if="error" class="editor-error" role="alert">{{ error }}</p>
        <div class="settings-actions"><Button :disabled="busy" @click="authorize">{{ busy ? '正在绑定…' : '允许并绑定' }}</Button><Button variant="outline" :disabled="busy" @click="authorizationOpen = false">取消</Button></div>
      </SheetContent>
    </Sheet>
    <fieldset :disabled="busy" class="settings-fields">
      <label class="settings-name">空间名称<input v-model="config.workspace.name" placeholder="例如 Ai Workspace" /></label>
      <section>
        <h2 id="代码仓库">代码仓库</h2><p>登记已有代码工程。路径支持绝对路径、~/ 或相对 workspace 根目录的路径。</p>
        <div v-if="!config.projects.length" class="settings-empty">还没有关联代码仓库，点击下方按钮添加。</div>
        <div v-for="(project, index) in config.projects" :key="index" class="settings-project">
          <label>工程 ID<input v-model="project.id" placeholder="例如 web" /></label>
          <label>工程名称<input v-model="project.name" placeholder="例如项目前端" /></label>
          <label class="settings-project-path">本地工程路径<input v-model="project.path" placeholder="例如 ~/projects/example-web" spellcheck="false" /></label>
          <button class="settings-remove" :aria-label="`移除工程 ${project.name || index + 1}`" @click="config.projects.splice(index, 1)"><Trash2 :size="16" />移除</button>
        </div>
        <Button variant="outline" @click="config.projects.push({ id: '', name: '', path: '' })"><Plus :size="15" />添加代码仓库</Button>
        <p class="settings-hint">网页保存时检查配置格式；真实目录是否存在，请在本机运行 <code>npm run workspace:check</code>。</p>
      </section>
      <section>
        <h2 id="我的角色与目录范围">我的角色与目录范围</h2><p>可以同时选择多个角色。可修改目录为已选角色负责目录的并集，其他空间可阅读和引用。</p>
        <div class="settings-roles">
          <label v-for="(role, id) in roleDefinitions" :key="id" :class="['settings-role', { selected: config.roles.includes(id) }]">
            <input v-model="config.roles" type="checkbox" :value="id" /><span><strong>{{ id }} · {{ role.name }}</strong><small>{{ role.outputs }}</small></span>
          </label>
        </div>
        <div class="settings-scope"><h3>当前可修改的资源</h3><ul v-if="selectedDirectories.length"><li v-for="directory in selectedDirectories" :key="directory"><code>{{ directory }}/</code></li></ul><p v-else>尚未选择角色。选择后会在这里显示对应目录。</p><p>所有角色还可维护 harness/tasks/ 中自己的任务记录。跨角色内容需交接或明确授权。</p></div>
        <details class="settings-details"><summary>查看全部角色、技能和目录约束</summary><div v-for="(role, id) in roleDefinitions" :key="id" class="settings-role-detail"><strong>{{ id }} · {{ role.name }}</strong><p>技能：<code>${{ role.skill }}</code></p><ul><li v-for="directory in role.directories" :key="directory"><code>{{ directory }}/</code></li></ul></div></details>
        <p class="settings-hint">目录约束由 Agent 按 harness 执行，属于协作规则，不是网页账号权限或操作系统权限。团队职责表在 harness/roles.json，个人角色选择不会修改团队规则。</p>
      </section>
      <section>
        <h2 id="harness-工作约定">Harness 工作约定</h2><a href="#/workspace-harness" class="harness-management-link">打开 Harness 管理，编辑团队规则与角色目录 →</a><p>让 Agent 知道读取哪些资料、修改哪些目录、如何验证和交接。</p>
        <div class="settings-harness-grid"><div><strong>工作入口</strong><code>AGENTS.md</code><p>项目边界、角色识别和完成标准。</p></div><div><strong>角色技能</strong><code>.agents/skills/</code><p>根据已选角色读取对应 Skill。</p></div><div><strong>职责与上下文</strong><code>harness/roles.json</code><p>目录约束，以及 templates/ 和 tasks/ 下的模板与任务记录。</p></div><div><strong>统一验证</strong><code>npm run check</code><p>检查 workspace 的配置、文档和构建。业务工程独立配置 harness。</p></div></div>
        <details class="settings-details"><summary>查看 AGENTS.md 工作规则 · {{ agentFromProject ? '当前工程' : '模板' }}</summary><pre><code>{{ agentGuide }}</code></pre></details>
        <details class="settings-details"><summary>查看完整 harness 使用说明 · {{ guideFromProject ? '当前工程' : '模板' }}</summary><pre><code>{{ harnessGuide }}</code></pre></details>
      </section>
      <section>
        <h2 id="保存本地配置">保存本地配置</h2><p>配置位置：<code>code/projects.local.json</code>。支持导入旧的单角色配置，保存时会转换为多角色格式。</p>
        <div class="settings-actions"><Button :disabled="!connected || !loaded" @click="save"><Save :size="15" />保存到本地项目</Button><Button variant="outline" @click="download"><Download :size="15" />下载配置 JSON</Button><label class="settings-import">导入配置<input type="file" accept=".json,application/json" @change="importFile" /></label></div>
        <p v-if="!connected" class="settings-hint">请先在页面顶部授权绑定空间。导入只更新草稿，绑定后即可保存。</p>
        <details class="settings-details"><summary>查看当前 JSON 配置{{ dirty ? ' · 未保存' : '' }}</summary><pre><code class="language-json" v-html="highlightedPreview" /></pre></details>
      </section>
    </fieldset>
    <p v-if="error" class="editor-error" role="alert">{{ error }}</p><p v-if="message" class="settings-message" role="status"><Check :size="16" />{{ message }}</p>
  </div>
</template>
