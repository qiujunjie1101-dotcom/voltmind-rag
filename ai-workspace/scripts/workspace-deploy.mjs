import { constants } from 'node:fs'
import { chmod, lstat, mkdir, mkdtemp, open, readdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { defaultDeployment, validateDeployment, DeploymentError, failDeployment } from './deploy-config.mjs'
import { scanHost, sshConnection, runProcess } from './deploy-ssh.mjs'
import { inspectRemote, prepareRemote, currentRemote, activateRemote, finalizeRemote, recoverRemote, unlockRemote, initializeNginx, restoreNginx, diagnoseNginx } from './deploy-remote.mjs'
export { DeploymentError }
const configLimit = 64 * 1024
const releasePattern = /^[0-9]{14}-[a-f0-9]{12}$/
const same = (a,b) => a.ino===b.ino && a.dev===b.dev
async function artifactFiles(directory) {
  for (const entry of await readdir(directory,{withFileTypes:true})) {
    if (entry.isSymbolicLink()) throw new Error('发布产物含符号链接，已停止部署。')
    if (/^(?:deploy|projects)\.local\.json$/i.test(entry.name) || /^\.env(?:\.|$)/.test(entry.name) || /\.(?:pem|key)$/i.test(entry.name)) throw new Error('发布产物包含本地配置或密钥文件，已停止部署。')
    if (entry.isDirectory()) await artifactFiles(path.join(directory,entry.name))
    else if (!entry.isFile()) throw new Error('发布产物包含不支持的文件类型。')
  }
}
async function buildSite(root, output, log) {
  await artifactFiles(path.join(root,'public'))
  await runProcess(process.execPath,[path.join(root,'scripts/check-content.mjs')],{cwd:root,timeout:120000,log})
  await runProcess(process.execPath,[path.join(root,'node_modules/vue-tsc/bin/vue-tsc.js'),'--noEmit'],{cwd:root,timeout:120000,log})
  await runProcess(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'build','--outDir',output,'--emptyOutDir'],{cwd:root,timeout:180000,log,env:{...process.env,VITE_WORKSPACE_READ_ONLY:'true'}})
  await artifactFiles(output)
  if (!(await lstat(path.join(output,'index.html'))).isFile()) throw new Error('构建没有生成首页，停止发布。')
}
async function verifySite(config, release) {
  let last
  for (let attempt=0;attempt<3;attempt++) {
    try {
      const url = new URL('workspace-release.json',config.publicUrl);url.searchParams.set('verify',randomBytes(8).toString('hex'))
      const response = await fetch(url,{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)})
      if (!response.ok) throw new Error(`访问检查返回 HTTP ${response.status}`)
      const reader = response.body?.getReader();let text=''
      if (!reader) throw new Error('访问检查没有响应内容')
      try { while(true) { const {done,value}=await reader.read();if(done)break;text+=new TextDecoder().decode(value);if(text.length>4096)throw new Error('访问检查内容不正确') } } finally { await reader.cancel().catch(()=>{}) }
      const metadata=JSON.parse(text)
      if(metadata.deploymentId!==config.deploymentId || metadata.releaseId!==release)throw new Error('访问地址未指向刚发布的版本，请检查网站根目录、代理缓存和端口')
      return
    } catch(error) {last=error;if(attempt<2)await new Promise(resolve=>setTimeout(resolve,1200))}
  }
  throw new Error(`站点验证失败：${last?.message}。请检查访问地址及云安全组。`)
}
export async function createDeploymentManager(root, dependencies={}) {
  root=await realpath(root);const rootStat=await lstat(root), code=path.join(root,'code'), filename=path.join(code,'deploy.local.json')
  let queue=Promise.resolve(), job=null
  const initial=defaultDeployment()
  const build=dependencies.build || buildSite, connect=dependencies.connect || sshConnection, verify=dependencies.verify || verifySite, run=dependencies.run || runProcess
  async function directory(create=false) {
    if(await realpath(root)!==root || !same(rootStat,await lstat(root)))failDeployment(409,'空间目录已变化，请重启服务。')
    if(create)await mkdir(code,{recursive:true})
    let stat;try{stat=await lstat(code)}catch(error){if(error.code==='ENOENT')return null;throw error}
    if(!stat.isDirectory() || stat.isSymbolicLink() || await realpath(code)!==code)failDeployment(409,'code 必须是当前空间内的真实目录。')
    return stat
  }
  async function load() {
    const dir=await directory();if(!dir)return {raw:null,config:initial}
    let before;try{before=await lstat(filename)}catch(error){if(error.code==='ENOENT')return {raw:null,config:initial};throw error}
    if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>configLimit)failDeployment(409,'部署配置必须为不超过 64 KiB 的独立普通文件。')
    const file=await open(filename,constants.O_RDONLY|constants.O_NOFOLLOW)
    try{
      const stat=await file.stat();if(!same(before,stat)||stat.nlink!==1)failDeployment(409,'部署配置已变化。')
      const bytes=Buffer.alloc(configLimit+1);let used=0
      while(used<bytes.length){const {bytesRead}=await file.read(bytes,used,bytes.length-used,used);if(!bytesRead)break;used+=bytesRead}
      if(used>configLimit)failDeployment(413,'部署配置过大。')
      const current=await directory();if(!current||!same(dir,current))failDeployment(409,'部署目录已变化。')
      const raw=bytes.subarray(0,used).toString('utf8');let config
      try{config=validateDeployment(JSON.parse(raw))}catch(error){failDeployment(400,`本地部署配置无效：${error.message}`)}
      return {raw,config}
    }finally{await file.close()}
  }
  async function save(body,check) {
    if(!body||Object.keys(body).some(k=>!['config','expected'].includes(k))||!(body.expected===null||typeof body.expected==='string'))failDeployment(400,'部署配置保存请求无效。')
    const config=validateDeployment(body.config),raw=JSON.stringify(config,null,2)+'\n'
    const operation=queue.then(async()=>{
      check();if(job?.status==='running')failDeployment(409,'部署正在进行，请完成后再修改配置。')
      if((await load()).raw!==body.expected)failDeployment(409,'配置已被其他窗口修改，请重新读取。')
      const dir=await directory(true),temp=path.join(code,`.deploy.local.${randomBytes(12).toString('hex')}.tmp`)
      try{await writeFile(temp,raw,{flag:'wx',mode:0o600});check();const after=await directory();if(!after||!same(dir,after)||(await load()).raw!==body.expected)failDeployment(409,'保存期间配置发生变化。');await rename(temp,filename);return {raw,config}}
      finally{const after=await directory().catch(()=>null);if(after&&same(dir,after))await rm(temp,{force:true})}
    });queue=operation.catch(()=>{});return operation
  }
  function status(){return job ? structuredClone(job) : null}
  async function start(body,check) {
    if(!body||Object.keys(body).some(k=>!['action','password','expected'].includes(k))||!['test','publish','rollback'].includes(body.action)||typeof body.password!=='string'||body.password.length>4096||/[\r\n\0]/.test(body.password))failDeployment(400,'部署操作参数无效。')
    if(job?.status==='running')failDeployment(409,'已有部署任务正在执行。')
    check();const snapshot=await load();if(!snapshot.raw||snapshot.raw!==body.expected)failDeployment(409,'请先保存部署配置，并确保没有外部修改。')
    if(job?.status==='running')failDeployment(409,'已有部署任务正在执行。')
    const config=snapshot.config
    if(config.auth==='password'&&!body.password)failDeployment(400,'请输入本次部署的登录密码。')
    const password=body.password,id=randomBytes(12).toString('hex'), action=body.action
    job={id,action,status:'running',stage:'准备',startedAt:new Date().toISOString(),finishedAt:null,logs:[],url:config.publicUrl,releaseId:null,error:null}
    const current=job
    const log=message=>{let safe=String(message).replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');if(password)safe=safe.split(password).join('[隐藏]');for(const line of safe.split('\n').filter(Boolean)){current.logs.push({time:new Date().toISOString(),message:line.slice(0,1600)})}if(current.logs.length>300)current.logs.splice(0,current.logs.length-300)}
    const stage=name=>{current.stage=name;log(name)}
    void (async()=>{
      let ssh,work,lockAttempted=false,switchAttempted=false,nginxAttempted=false,keepLock=false,old='',release='',recovered=false
      const lock=id, args=[config.remoteDir,config.deploymentId,lock]
      try{
        check();stage('连接并检查服务器');ssh=await connect(config,password)
        await ssh.execute(inspectRemote,[config.remoteDir,config.deploymentId,config.mode],{timeout:30000,log})
        if(action==='test'){check();current.status='success';stage('连接检查通过');return}
        work=await mkdtemp(path.join(tmpdir(),'ai-workspace-release-'));await chmod(work,0o700)
        if(action==='publish'){
          stage('校验并构建只读站点');await build(root,path.join(work,'site'),log);check()
          release=new Date().toISOString().replace(/\D/g,'').slice(0,14)+'-'+randomBytes(6).toString('hex')
          await writeFile(path.join(work,'site/workspace-release.json'),JSON.stringify({deploymentId:config.deploymentId,releaseId:release}))
          await run('tar',['-czf',path.join(work,'site.tgz'),'-C',path.join(work,'site'),'.'],{timeout:120000})
        }
        check();stage('准备远程版本目录');lockAttempted=true
        await ssh.execute(prepareRemote,[...args,action==='publish'?release:'rollback',config.mode],{log})
        const state=await ssh.execute(currentRemote,args);const links=state.stdout.trimEnd().split('\n');old=links[0]||''
        if(old&&!/^releases\/[0-9]{14}-[a-f0-9]{12}$/.test(old))throw new Error('远程当前版本标识异常，停止发布。')
        if(action==='rollback'){
          release=(links[1]||'').replace(/^releases\//,'')
          if(!releasePattern.test(release))throw new Error('没有可以回退的上一版本。')
        }else{
          stage('上传静态文件');await ssh.upload(path.join(work,'site.tgz'),`${config.remoteDir}/releases/${release}`,{log});check()
          if(config.mode==='nginx'){stage('初始化独立 Nginx 站点');nginxAttempted=true;await ssh.execute(initializeNginx,[...args,String(config.httpPort)],{timeout:300000,log})}
        }
        check();stage(action==='rollback'?'切换至上一版本':'切换线上版本');switchAttempted=true
        await ssh.execute(activateRemote,[...args,release,old],{log});stage('验证访问地址');log(`检查地址：${config.publicUrl}`)
        try { await verify(config,release) }
        catch (error) {
          if(config.mode==='nginx'){
            stage('回退前诊断服务器访问状态')
            try { await ssh.execute(diagnoseNginx,[...args,String(config.httpPort)],{timeout:20000,log}) }
            catch (diagnostic) { log('服务器诊断未完成：'+diagnostic.message) }
          }
          throw error
        }
        check()
        await ssh.execute(finalizeRemote,[...args,old],{log});lockAttempted=false
        current.releaseId=release;current.status='success';stage(action==='rollback'?'回退完成':'部署完成')
      }catch(error){
        log(error.message)
        if(switchAttempted&&ssh){try{stage('恢复原线上版本');await ssh.execute(recoverRemote,[...args,release,old],{timeout:30000,log});recovered=true;log('已恢复切换前的版本状态')}catch(recovery){log('自动恢复未确认，请检查远程 current 链接：'+recovery.message)}}
        if(nginxAttempted&&ssh){try{await ssh.execute(restoreNginx,args,{timeout:30000,log})}catch(restore){keepLock=true;log('Nginx 配置恢复未确认，已保留远程 .deploy-lock 内的备份：'+restore.message)}}
        current.status='failed';current.stage='操作失败';let message=String(error.message);if(password)message=message.split(password).join('[隐藏]');current.error=message+(switchAttempted?(recovered?'；原版本状态已恢复。':'；无法确认自动恢复结果，请检查远程版本。'):'')+(keepLock?'；Nginx 配置需人工检查，备份保留在远程 .deploy-lock。':'')
      }finally{
        if(lockAttempted&&!keepLock&&ssh)try{await ssh.execute(unlockRemote,args,{timeout:20000})}catch(error){log('远程部署锁可能需要清理：'+error.message)}
        await ssh?.close().catch(()=>{});if(work)await rm(work,{recursive:true,force:true});current.finishedAt=new Date().toISOString()
      }
    })().catch(error=>{current.status='failed';current.error='部署清理失败，请检查本地临时目录。';current.finishedAt=new Date().toISOString();log(error.message)})
    return status()
  }
  return {load,save,start,status,scan:target=>scanHost(target,dependencies.run || runProcess)}
}
