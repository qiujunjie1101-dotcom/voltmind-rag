<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { Check, CloudUpload, KeyRound, LoaderCircle, RefreshCw, RotateCcw, Server } from 'lucide-vue-next'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { discoverWorkspaceService, workspaceService } from '@/lib/workspace-service'
import { authorizeDeployment, deploymentSession, loadDeployment, readDeploymentJob, revokeDeployment, saveDeployment, scanDeploymentHost, startDeployment, type DeploymentConfig, type DeploymentJob, type HostKey } from '@/lib/deployment'
const props=defineProps<{open:boolean;unsaved?:boolean}>()
const emit=defineEmits<{'update:open':[value:boolean]}>()
const config=ref<DeploymentConfig>(),raw=ref<string|null>(null),savedConfig=ref('')
const password=ref(''),busy=ref(false),error=ref(''),notice=ref(''),keys=ref<HostKey[]>([]),candidate=ref<HostKey>(),confirmAction=ref<'publish'|'rollback'|null>(null)
const logs=ref<HTMLElement>()
const dirty=computed(()=>config.value&&JSON.stringify(config.value)!==savedConfig.value)
const running=computed(()=>deploymentSession.job?.status==='running')
const available=computed(()=>workspaceService.info?.capabilities?.includes('deployment'))
const controlsDisabled=computed(()=>busy.value||running.value)
let timer:ReturnType<typeof setTimeout>|undefined
let disposed=false
async function perform(fn:()=>Promise<void>){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{await fn()}catch(e){error.value=(e as Error).message}finally{busy.value=false}}
async function load(){const result=await loadDeployment();config.value=result.config;raw.value=result.raw;savedConfig.value=JSON.stringify(result.config);keys.value=[];candidate.value=undefined;confirmAction.value=null}
async function authorize(){await perform(async()=>{await authorizeDeployment();await load();await readDeploymentJob();schedule()})}
async function refresh(){await perform(async()=>{await discoverWorkspaceService();if(deploymentSession.authorized){await load();await readDeploymentJob();schedule()}})}
async function scan(){await perform(async()=>{if(!config.value)return;const result=await scanDeploymentHost(config.value.host,Number(config.value.port));keys.value=result.keys;candidate.value=result.keys[0]})}
function trust(){if(config.value&&candidate.value){config.value.hostKey={...candidate.value};keys.value=[];candidate.value=undefined;notice.value='已确认指纹，请保存配置。'}}
async function save(){await perform(async()=>{if(!config.value)return;const result=await saveDeployment(config.value,raw.value);config.value=result.config;raw.value=result.raw;savedConfig.value=JSON.stringify(result.config);notice.value='部署配置已保存到本机。'})}
async function run(action:DeploymentJob['action']){await perform(async()=>{if(dirty.value||!raw.value)throw new Error('请先保存配置。');if(props.unsaved)throw new Error('请先保存正在编辑的文档或配置，再部署磁盘中的内容。');await startDeployment(action,raw.value,password.value);confirmAction.value=null;schedule()})}
function schedule(){clearTimeout(timer);if(!props.open||!deploymentSession.authorized||disposed)return;timer=setTimeout(async()=>{try{await readDeploymentJob();if(running.value)schedule()}catch(e){error.value=(e as Error).message}},1200)}
async function disconnect(){await perform(async()=>{await revokeDeployment();password.value='';config.value=undefined;clearTimeout(timer)})}
function changeOpen(value:boolean){if(!value&&dirty.value&&!window.confirm('部署配置尚未保存，关闭后放弃这些修改？'))return;emit('update:open',value)}
watch(()=>props.open,async open=>{if(open){await discoverWorkspaceService();if(deploymentSession.authorized)await perform(async()=>{await load();await readDeploymentJob();schedule()})}else{clearTimeout(timer);password.value='';confirmAction.value=null;keys.value=[]}},{immediate:true})
watch(()=>[config.value?.host,config.value?.port],()=>{keys.value=[];candidate.value=undefined;if(config.value?.hostKey&&(config.value.hostKey.host!==config.value.host||config.value.hostKey.port!==config.value.port))config.value.hostKey=null})
watch(()=>deploymentSession.job?.logs.length,async()=>{await nextTick();if(logs.value)logs.value.scrollTop=logs.value.scrollHeight})
onUnmounted(()=>{disposed=true;clearTimeout(timer);password.value=''})
</script>
<template>
 <Sheet :open="open" @update:open="changeOpen"><SheetContent class="deployment-panel">
  <div class="deployment-header"><div class="deployment-icon"><CloudUpload :size="21" /></div><div><SheetTitle>部署到服务器</SheetTitle><SheetDescription>本地编辑，一键发布远程只读站点。</SheetDescription></div></div>
  <template v-if="!deploymentSession.authorized">
   <div class="deployment-intro"><h3>连接本机部署工具</h3><p>配置主机后，可检查连接、发布站点和回退版本。服务器密码仅在当前面板会话使用，不写入配置文件。</p></div>
   <div v-if="workspaceService.info" class="deployment-target"><Server :size="18"/><div><strong>{{workspaceService.info.name}}</strong><p>{{workspaceService.info.path}}</p></div></div>
   <p class="deployment-hint">允许读取和保存本机部署配置，并执行你在面板中发起的 SSH 操作。只有点击“确认部署”才会发布到远程。</p>
   <Button v-if="available" :disabled="busy" @click="authorize"><KeyRound :size="15"/>{{busy?'正在连接…':'启用本机部署工具'}}</Button>
   <p v-else class="editor-warning">当前服务未加载部署功能，请重启项目的开发服务后重新检测。</p>
   <Button variant="outline" :disabled="busy||workspaceService.checking" @click="refresh"><RefreshCw :size="14"/>重新检测服务</Button>
  </template>
  <template v-else-if="config">
   <fieldset :disabled="controlsDisabled" class="deployment-form">
    <div class="deployment-section-title"><h3>服务器</h3><span>配置仅保存在本机</span></div>
    <div class="deployment-grid"><label>IP 或域名<input v-model.trim="config.host" placeholder="203.0.113.10" autocomplete="off" /></label><label>SSH 端口<input v-model.number="config.port" type="number" min="1" max="65535" /></label><label>登录用户名<input v-model.trim="config.username" placeholder="deploy 或 root" autocomplete="off" /></label><label>登录方式<select v-model="config.auth"><option value="password">密码</option><option value="key">SSH 密钥 / agent</option></select></label></div>
    <label v-if="config.auth==='key'">本机私钥路径<input v-model.trim="config.privateKeyPath" placeholder="留空使用 SSH agent，或 ~/.ssh/id_ed25519" autocomplete="off" /></label>
    <label>{{config.auth==='password'?'登录密码':'密钥口令（可选）'}}<input v-model="password" type="password" autocomplete="new-password" placeholder="仅用于本次会话，不保存到磁盘" /></label>
    <div class="deployment-fingerprint"><div><strong>SSH 主机指纹</strong><p v-if="config.hostKey"><Check :size="13"/>已确认 {{config.hostKey.fingerprint}}</p><p v-else>首次连接需要核对主机身份。</p></div><Button variant="outline" :disabled="!config.host" @click="scan">获取指纹</Button></div>
    <div v-if="keys.length" class="deployment-trust"><p>请与云主机控制台或管理员提供的指纹核对：</p><select v-model="candidate" aria-label="待确认的主机指纹"><option v-for="key in keys" :key="key.fingerprint" :value="key">{{key.type}} · {{key.fingerprint}}</option></select><p class="deployment-hint">扫描结果尚未被信任。地址或端口变化后需要重新确认。</p><Button variant="outline" @click="trust">指纹一致，信任此主机</Button></div>
    <div class="deployment-section-title"><h3>发布位置</h3></div>
    <label>服务器准备方式<select v-model="config.mode"><option value="existing">已有网站服务，只发布静态文件</option><option value="nginx">自动安装并配置独立 Nginx 站点</option></select></label>
    <p v-if="config.mode==='nginx'" class="deployment-hint">适用于 Linux 新服务器，需要 root 或免密 sudo。使用专用网站端口，不覆盖其他站点配置；请在云安全组放行该端口。</p>
    <label>专用部署目录<input v-model.trim="config.remoteDir" placeholder="/var/www/ai-workspace" /></label>
    <p v-if="config.mode==='existing'" class="deployment-hint">请让网站服务的根目录指向 <code>{{config.remoteDir}}/current</code>。部署目录应为空或由本空间管理。</p>
    <label v-if="config.mode==='nginx'">网站端口<input v-model.number="config.httpPort" type="number" min="1" max="65535" /></label>
    <label>部署后的访问地址<input v-model.trim="config.publicUrl" placeholder="http://服务器IP:8080/ 或 https://知识库域名/" /></label>
    <p class="deployment-hint">地址以 / 结尾，用于检查发布版本是否可访问。只有保存到磁盘的文档和媒体会被发布。</p>
   </fieldset>
   <div class="deployment-actions"><Button variant="outline" :disabled="controlsDisabled||!dirty" @click="save">保存配置</Button><Button variant="outline" :disabled="controlsDisabled||dirty||!raw" @click="run('test')">检查连接</Button><Button :disabled="controlsDisabled||dirty||!raw||unsaved" @click="confirmAction='publish'"><CloudUpload :size="15"/>一键部署</Button><Button variant="ghost" :disabled="controlsDisabled||dirty||!raw" @click="confirmAction='rollback'"><RotateCcw :size="14"/>回退上一版</Button></div>
   <p v-if="unsaved" class="editor-warning">存在未保存的文档或配置，请先保存后再发布。</p>
   <div v-if="confirmAction" class="deployment-confirm"><h3>{{confirmAction==='publish'?'确认发布当前空间':'确认回退线上版本'}}</h3><p>目标：<strong>{{config.username}}@{{config.host}}:{{config.port}}</strong></p><p>{{config.remoteDir}}/current</p><p>{{confirmAction==='publish'?'当前空间的文档和媒体将通过下方地址提供阅读，请确认这些内容可以分享。':'将线上站点切换为上一次发布的版本，本地资料不变。'}}</p><p>{{config.publicUrl}}</p><p v-if="confirmAction==='publish'&&config.mode==='nginx'">本次还会安装或配置独立 Nginx 站点。</p><div class="deployment-actions"><Button :disabled="controlsDisabled" @click="run(confirmAction)">{{confirmAction==='publish'?'确认部署':'确认回退'}}</Button><Button variant="outline" :disabled="busy" @click="confirmAction=null">取消</Button></div></div>
   <div v-if="deploymentSession.job" class="deployment-job" :data-status="deploymentSession.job.status"><div class="deployment-job-heading"><LoaderCircle v-if="running" :size="16" class="spin"/><Check v-else-if="deploymentSession.job.status==='success'" :size="16"/><strong role="status">{{deploymentSession.job.stage}}</strong></div><p v-if="deploymentSession.job.error" class="editor-warning" role="alert">{{deploymentSession.job.error}}</p><pre ref="logs" tabindex="0" aria-label="部署日志">{{deploymentSession.job.logs.map(line=>`${new Date(line.time).toLocaleTimeString()}  ${line.message}`).join('\n')}}</pre><a v-if="deploymentSession.job.status==='success'&&deploymentSession.job.action!=='test'" :href="deploymentSession.job.url" target="_blank" rel="noopener noreferrer">打开远程站点 ↗</a><p v-if="running" class="deployment-hint">关闭面板后任务继续运行。请保持本地开发服务开启。</p></div>
   <div class="deployment-footer"><button :disabled="controlsDisabled" @click="refresh">重新读取配置</button><button :disabled="controlsDisabled" @click="disconnect">解除部署授权</button></div>
  </template>
  <p v-if="notice" class="deployment-notice" role="status">{{notice}}</p><p v-if="error" class="editor-warning" role="alert">{{error}}</p>
 </SheetContent></Sheet>
</template>
<style>
.deployment-panel{width:min(100vw,620px)!important;max-width:620px!important;padding:28px!important;overflow-y:auto;gap:20px!important;background:#fff;font-size:14px;line-height:1.7;color:#465266}
.deployment-header{display:flex;align-items:center;gap:12px;padding-right:25px}.deployment-icon{display:grid;place-items:center;width:42px;height:42px;border-radius:10px;background:#edf2ff;color:#506db4;flex-shrink:0}.deployment-header [data-slot=sheet-title]{font-size:21px}.deployment-header [data-slot=sheet-description]{font-size:13px;color:#7d8797}
.deployment-panel h3{font-size:15px;font-weight:600;color:#343e4f}.deployment-intro p{margin-top:8px}.deployment-target{display:flex;gap:12px;align-items:center;background:#f6f8fb;border-radius:8px;padding:16px}.deployment-target p{font-size:12px;overflow-wrap:anywhere;color:#8290a1}.deployment-hint{font-size:12px;color:#7d8797;line-height:1.8;overflow-wrap:anywhere}.deployment-hint code{font-family:monospace}
.deployment-form{border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:13px;min-width:0}.deployment-section-title{display:flex;align-items:center;justify-content:space-between;margin-top:5px}.deployment-section-title span{font-size:11px;color:#8b94a3}.deployment-grid{display:grid;grid-template-columns:2fr 1fr;gap:12px}.deployment-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;color:#697589}.deployment-form input,.deployment-form select,.deployment-trust select{border:1px solid #dfe4ed;background:#fff;color:#3d485b;border-radius:5px;min-width:0;width:100%;padding:8px 10px;font-size:13px;line-height:1.5}.deployment-form input:focus,.deployment-form select:focus{outline:2px solid #a7b9e1;outline-offset:1px}.deployment-form:disabled{opacity:.7}.deployment-fingerprint{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 0;border-top:1px solid #edf0f5;border-bottom:1px solid #edf0f5}.deployment-fingerprint strong{font-size:12px;font-weight:500}.deployment-fingerprint p{font-size:11px;color:#8190a4;overflow-wrap:anywhere}.deployment-fingerprint p svg{display:inline}.deployment-fingerprint button{flex-shrink:0}.deployment-trust,.deployment-confirm{background:#f5f8fd;padding:16px;border-radius:7px;display:flex;flex-direction:column;gap:10px;overflow-wrap:anywhere}.deployment-confirm p{font-size:13px}.deployment-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.deployment-actions button{font-size:12px}.deployment-job{border-top:1px solid #e6eaf0;padding-top:18px}.deployment-job-heading{display:flex;gap:8px;align-items:center;color:#516b9a}.deployment-job pre{font:11px/1.8 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:#f7f9fc;padding:12px;border-radius:6px;max-height:230px;overflow:auto;margin:12px 0;color:#657389}.deployment-job a{color:#496daf;text-decoration:underline;text-underline-offset:3px}.deployment-footer{display:flex;justify-content:space-between;font-size:12px;color:#8190a5}.deployment-notice{font-size:13px;color:#507967}.deployment-panel button:disabled{opacity:.5}
[data-theme=dark] .deployment-panel{background:#191c22;color:#c5cede}[data-theme=dark] .deployment-panel h3{color:#dbe1ed}[data-theme=dark] .deployment-icon{background:#29354c;color:#b8cbf2}[data-theme=dark] .deployment-form input,[data-theme=dark] .deployment-form select,[data-theme=dark] .deployment-trust select{background:#202630;border-color:#354052;color:#d1daeb}[data-theme=dark] .deployment-target,[data-theme=dark] .deployment-trust,[data-theme=dark] .deployment-confirm,[data-theme=dark] .deployment-job pre{background:#222a37;color:#acbbd1}[data-theme=dark] .deployment-fingerprint,[data-theme=dark] .deployment-job{border-color:#313b4b}
@media(max-width:760px){.deployment-panel{padding:22px 16px!important}.deployment-grid{grid-template-columns:minmax(0,2fr) minmax(0,1fr)}.deployment-header [data-slot=sheet-title]{font-size:19px}}
</style>
