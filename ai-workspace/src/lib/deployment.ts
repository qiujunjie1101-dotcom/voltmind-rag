import { reactive } from 'vue'
import { workspaceService } from './workspace-service'
export interface HostKey { host: string; port: number; type: string; key: string; fingerprint: string }
export interface DeploymentConfig { version: 1; deploymentId: string; host: string; port: number; username: string; auth: 'password'|'key'; privateKeyPath: string; remoteDir: string; publicUrl: string; mode: 'existing'|'nginx'; httpPort: number; hostKey: HostKey|null }
export interface DeploymentJob { id: string; action: 'test'|'publish'|'rollback'; status: 'running'|'success'|'failed'; stage: string; startedAt: string; finishedAt: string|null; logs: {time:string;message:string}[]; url: string; releaseId: string|null; error: string|null }
export const deploymentSession = reactive({ authorized: false, job: null as DeploymentJob|null })
let token = ''
const endpoint = `${import.meta.env.BASE_URL}__workspace-config`
async function request<T>(route: string, method='GET', body?: unknown): Promise<T> {
  const response=await fetch(`${endpoint}/${route}`,{method,credentials:'omit',cache:'no-store',headers:{'X-Workspace-Request':'1',...(token?{Authorization:`Bearer ${token}`} : {}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)})
  if(response.status===401){token='';deploymentSession.authorized=false}
  if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('部署服务不可用，请在本机运行 npm run dev 后打开页面。')
  const data=await response.json()
  if(!response.ok)throw new Error(response.status===404?'当前本地服务未加载部署功能，请重启后重试。':data.error||'部署请求失败。')
  return data as T
}
export async function authorizeDeployment() {
  if(!import.meta.env.DEV||!workspaceService.info?.capabilities?.includes('deployment'))throw new Error('当前服务不支持部署，请重启项目开发服务。')
  const result=await request<{token:string}>('authorize','POST',{approved:true,instanceId:workspaceService.info.instanceId,scope:'deploy'})
  token=result.token;deploymentSession.authorized=true
}
export async function revokeDeployment(){try{if(token)await request('revoke','POST')}finally{token='';deploymentSession.authorized=false;deploymentSession.job=null}}
export const loadDeployment=()=>request<{raw:string|null;config:DeploymentConfig}>('deployment/config')
export const saveDeployment=(config:DeploymentConfig,expected:string|null)=>request<{raw:string;config:DeploymentConfig}>('deployment/config','PUT',{config,expected})
export const scanDeploymentHost=(host:string,port:number)=>request<{keys:HostKey[]}>('deployment/host-key','POST',{host,port})
export async function startDeployment(action:DeploymentJob['action'],expected:string|null,password:string){const result=await request<{job:DeploymentJob}>('deployment/jobs','POST',{action,expected,password});deploymentSession.job=result.job}
export async function readDeploymentJob(){const result=await request<{job:DeploymentJob|null}>('deployment/jobs');deploymentSession.job=result.job}
