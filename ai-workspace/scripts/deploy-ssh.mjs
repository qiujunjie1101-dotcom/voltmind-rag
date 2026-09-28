import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import path from 'node:path'
import { failDeployment, fingerprint, shellQuote, validateTarget } from './deploy-config.mjs'

export function runProcess(command, args, { cwd, env, input, inputFile, timeout = 60000, log, signal, redact = text => text } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: env || process.env, stdio: ['pipe','pipe','pipe'], signal })
    let stdout = '', stderr = '', timedOut = false
    const pending = {out:'',err:''}
    const flush = stream => { if(pending[stream])log?.(redact(pending[stream]));pending[stream]='' }
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); killTimer = setTimeout(() => child.kill('SIGKILL'), 2000); killTimer.unref() }, timeout)
    let killTimer
    const append = (stream, chunk) => {
      const text = chunk.toString(); if (stream === 'out') stdout = (stdout + text).slice(-128 * 1024); else stderr = (stderr + text).slice(-128 * 1024)
      pending[stream] += text
      let newline
      while((newline=pending[stream].indexOf('\n'))>=0){log?.(redact(pending[stream].slice(0,newline)));pending[stream]=pending[stream].slice(newline+1)}
      if(pending[stream].length>128*1024){pending[stream]='';log?.('[输出过长，已省略]')}
    }
    child.stdout.on('data', chunk => append('out',chunk));child.stderr.on('data',chunk=>append('err',chunk))
    let source
    child.stdin.on('error', () => {})
    if (inputFile) { source = createReadStream(inputFile); source.on('error', error => { child.kill(); reject(error) }); source.pipe(child.stdin) }
    else child.stdin.end(input || '')
    child.on('error', error => { clearTimeout(timer); clearTimeout(killTimer); source?.destroy(); reject(error) })
    child.on('close', code => { clearTimeout(timer); clearTimeout(killTimer); source?.destroy(); flush('out');flush('err'); if (code === 0 && !timedOut) resolve({ stdout, stderr }); else reject(new Error(timedOut ? '操作超时，请检查网络和主机状态。' : redact(stderr || stdout || `${command} 执行失败`).trim().slice(-2000))) })
  })
}
export async function scanHost(target, run = runProcess) {
  const {host,port} = validateTarget(target)
  let result
  try { result = await run('ssh-keyscan',['-T','5','-p',String(port),'-t','ed25519,ecdsa,rsa',host],{timeout:20000}) }
  catch (error) { failDeployment(502,`无法获取 SSH 主机指纹：${error.message}`) }
  const keys = []
  for (const line of result.stdout.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const [,type,key] = line.trim().split(/\s+/)
    if (!['ssh-ed25519','ecdsa-sha2-nistp256','ssh-rsa'].includes(type)) continue
    const entry = {host,port,type,key,fingerprint:fingerprint(type,key)}
    if (!keys.some(k=>k.fingerprint===entry.fingerprint)) keys.push(entry)
  }
  keys.sort((a,b)=>['ssh-ed25519','ecdsa-sha2-nistp256','ssh-rsa'].indexOf(a.type)-['ssh-ed25519','ecdsa-sha2-nistp256','ssh-rsa'].indexOf(b.type))
  if (!keys.length) failDeployment(502,'未获取到 SSH 主机公钥，请检查地址、端口和云安全组。')
  return keys
}
export async function sshConnection(config, password, run = runProcess) {
  if (typeof password !== 'string' || password.length > 4096 || /[\r\n\0]/.test(password)) failDeployment(400,'密码或密钥口令格式无效。')
  if (config.auth === 'password' && !password) failDeployment(400,'请输入本次连接的登录密码。')
  const dir = await mkdtemp(path.join(tmpdir(),'ai-workspace-ssh-'))
  await chmod(dir,0o700)
  const knownHosts = path.join(dir,'known_hosts'), askpass = path.join(dir,'askpass.cjs')
  await writeFile(knownHosts,`workspace-deploy-target ${config.hostKey.type} ${config.hostKey.key}\n`,{mode:0o600})
  await writeFile(askpass,'#!/usr/bin/env node\nif (!/password|passphrase/i.test(process.argv.slice(2).join(" "))) process.exit(1);\nprocess.stdout.write(process.env.AI_WORKSPACE_DEPLOY_PASSWORD || "");\n',{mode:0o700})
  const args = ['-F','/dev/null','-T','-p',String(config.port),'-l',config.username,
    '-o','StrictHostKeyChecking=yes','-o',`UserKnownHostsFile=${knownHosts}`,'-o','GlobalKnownHostsFile=/dev/null',
    '-o','HostKeyAlias=workspace-deploy-target','-o','CheckHostIP=no','-o','UpdateHostKeys=no','-o','ForwardAgent=no','-o','ClearAllForwardings=yes','-o','PermitLocalCommand=no',
    '-o','ControlMaster=no','-o','ConnectTimeout=10','-o','ServerAliveInterval=15','-o','ServerAliveCountMax=2','-o','NumberOfPasswordPrompts=1','-o','LogLevel=ERROR',
    '-o',`BatchMode=${password ? 'no' : 'yes'}`,'-o',`PreferredAuthentications=${config.auth==='password'?'password,keyboard-interactive':'publickey'}`]
  if (config.auth==='key' && config.privateKeyPath) args.push('-i',config.privateKeyPath.replace(/^~(?=\/)/,homedir()),'-o','IdentitiesOnly=yes')
  const env = {...process.env, SSH_ASKPASS:askpass, SSH_ASKPASS_REQUIRE:'force', DISPLAY:process.env.DISPLAY || ':0', AI_WORKSPACE_DEPLOY_PASSWORD:password, PATH:path.dirname(process.execPath)+path.delimiter+(process.env.PATH || '')}
  const redact = text => password ? text.split(password).join('[隐藏]') : text
  return {
    execute(script,parameters=[],options={}) { return run('ssh',[...args,config.host,`sh -s -- ${parameters.map(shellQuote).join(' ')}`],{...options,env,input:script,redact}) },
    upload(archive,destination,options={}) { return run('ssh',[...args,config.host,`tar -xzf - -C ${shellQuote(destination)} && chmod -R a+rX ${shellQuote(destination)}`],{...options,env,inputFile:archive,timeout:300000,redact}) },
    async close() { delete env.AI_WORKSPACE_DEPLOY_PASSWORD; await rm(dir,{recursive:true,force:true}) },
  }
}
