import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink, readlink, readdir, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { defaultDeployment, validateDeployment, fingerprint } from './deploy-config.mjs'
import { scanHost, sshConnection, runProcess } from './deploy-ssh.mjs'
import { createDeploymentManager } from './workspace-deploy.mjs'
import * as scripts from './deploy-remote.mjs'
const type='ssh-ed25519',key=Buffer.concat([Buffer.from([0,0,0,11]),Buffer.from(type),Buffer.from([0,0,0,32]),Buffer.alloc(32,7)]).toString('base64')
const target=()=>({...defaultDeployment(),host:'example.invalid',username:'deploy',publicUrl:'http://example.invalid:8080/',hostKey:{host:'example.invalid',port:22,type,key,fingerprint:fingerprint(type,key)}})
const check=()=>{}
async function fixture(fn){const root=await realpath(await mkdtemp(path.join(tmpdir(),'deploy-test-')));try{await mkdir(path.join(root,'code'));await fn(root)}finally{await rm(root,{recursive:true,force:true})}}
const untilDone=async manager=>{for(let i=0;i<100;i++){const job=manager.status();if(job?.finishedAt)return job;await new Promise(r=>setTimeout(r,10))}throw new Error('job timed out')}

test('RPM Nginx installation retries only exclude failures and propagates other failures',()=>fixture(async root=>{
 const tools=path.join(root,'tools'),calls=path.join(root,'calls');await mkdir(tools)
 const mock=`#!/bin/sh
printf '%s\\n' "$*" >> "$CALLS"
[ "$LC_ALL" = C ] || exit 99
if [ "$1" = --disableexcludes=all ]; then
  [ "$SCENARIO" != retry-fails ] || { echo 'dependency conflict' >&2; exit 2; }
  echo installed
  exit 0
fi
case "$SCENARIO" in
 success) echo installed ;;
 excluded|retry-fails) echo 'All matches were filtered out by exclude filtering for argument: nginx' >&2; exit 1 ;;
 dependency-excluded) echo 'package nginx-core is filtered out by exclude filtering' >&2; exit 1 ;;
 network) echo 'Could not resolve host' >&2; exit 1 ;;
 missing) echo 'No match for argument: nginx' >&2; exit 1 ;;
esac
`
 for(const manager of ['dnf','yum']){
  await writeFile(path.join(tools,manager),mock,{mode:0o700})
  for(const scenario of ['success','excluded','dependency-excluded','retry-fails','network','missing']){
   await writeFile(calls,'')
   const run=()=>runProcess('sh',['-s','--',manager],{input:`set -eu\npriv() { "$@"; }\n${scripts.installRpmNginx}\ninstall_rpm_nginx "$1"\necho finished\n`,env:{...process.env,PATH:tools+':'+process.env.PATH,CALLS:calls,SCENARIO:scenario}})
   if(['retry-fails','network','missing'].includes(scenario))await assert.rejects(run(),/dependency conflict|Could not resolve host|No match for argument/)
   else assert.match((await run()).stdout,/finished/)
   const retried=['excluded','dependency-excluded','retry-fails'].includes(scenario)
   assert.equal(await readFile(calls,'utf8'),`install -y nginx\n${retried?'--disableexcludes=all install -y nginx\n':''}`)
  }
 }
}))

test('deployment config validates paths, commands, host identity and forbids stored passwords',()=>{
 assert.equal(validateDeployment(target()).host,'example.invalid')
 for(const patch of [{host:'-oProxyCommand=id'},{host:'a; id'},{host:'a/path'},{port:0},{username:'root;id'},{remoteDir:'/'},{remoteDir:'/etc/nginx'},{remoteDir:'/var/www/../secret'},{remoteDir:'/var/www/a$(id)'},{publicUrl:'http://user:secret@example.invalid/'},{publicUrl:'file:///tmp/'},{publicUrl:'http://example.invalid/path'},{password:'secret'},{hostKey:{...target().hostKey,host:'other.invalid'}}])assert.throws(()=>validateDeployment({...target(),...patch}))
 assert.throws(()=>validateDeployment({...target(),mode:'nginx',publicUrl:'https://example.invalid/'}))
 assert.throws(()=>validateDeployment({...target(),hostKey:null}))
})
test('deployment configuration is private, conflict checked and never overwrites another writer',()=>fixture(async root=>{
 const manager=await createDeploymentManager(root),first=await manager.load();assert.equal(first.raw,null)
 const saved=await manager.save({config:target(),expected:null},check)
 assert.equal((await stat(path.join(root,'code/deploy.local.json'))).mode&0o777,0o600)
 await assert.rejects(manager.save({config:target(),expected:null},check),e=>e.status===409)
 assert.equal((await manager.load()).raw,saved.raw)
 const result=await Promise.allSettled([manager.save({config:{...saved.config,username:'one'},expected:saved.raw},check),manager.save({config:{...saved.config,username:'two'},expected:saved.raw},check)])
 assert.equal(result.filter(r=>r.status==='fulfilled').length,1)
 assert.deepEqual(await readdir(path.join(root,'code')),['deploy.local.json'])
}))
test('deployment refuses local configuration links and revoked writes',()=>fixture(async root=>{
 const outside=path.join(root,'outside.json');await writeFile(outside,'untouched');await symlink(outside,path.join(root,'code/deploy.local.json'));const manager=await createDeploymentManager(root)
 await assert.rejects(manager.load(),e=>e.status===409);assert.equal(await readFile(outside,'utf8'),'untouched')
 await rm(path.join(root,'code/deploy.local.json'));await assert.rejects(manager.save({config:target(),expected:null},()=>{throw new Error('revoked')}),/revoked/);assert.equal((await manager.load()).raw,null)
}))
test('host scanning returns fingerprints without authentication or accepting them automatically',async()=>{
 let received
 const keys=await scanHost({host:'example.invalid',port:2222},async(command,args)=>{received={command,args};return {stdout:`# comment\n[example.invalid]:2222 ${type} ${key}\n`,stderr:''}})
 assert.equal(received.command,'ssh-keyscan');assert.equal(received.args.at(-1),'example.invalid');assert.equal(keys[0].fingerprint,fingerprint(type,key));assert.equal(keys[0].port,2222)
})
test('SSH pins host identity; password stays out of arguments and helper files; private files are cleaned',async()=>{
 let captured;const connection=await sshConnection(target(),'test-password',async(command,args,options)=>{captured={command,args,options};return {stdout:'',stderr:''}})
 try{await connection.execute('printf ready',['value with spaces']);assert.equal(captured.command,'ssh');assert(!captured.args.join(' ').includes('test-password'));assert(captured.args.includes('StrictHostKeyChecking=yes'));assert(captured.args.includes('ForwardAgent=no'));assert(captured.args.includes('HostKeyAlias=workspace-deploy-target'));assert(captured.args.at(-1).endsWith("'value with spaces'"));assert.equal(captured.options.env.SSH_ASKPASS_REQUIRE,'force');assert(!((await readFile(captured.options.env.SSH_ASKPASS,'utf8')).includes('test-password')));assert.equal(captured.options.redact('test-password'), '[隐藏]')}
 finally{const filename=captured?.options.env.SSH_ASKPASS;await connection.close();if(filename)await assert.rejects(stat(filename),e=>e.code==='ENOENT')}
})
test('process logging joins output chunks before redacting secrets',async()=>{
 const logs=[];await runProcess(process.execPath,['-e',"process.stdout.write('test-');setTimeout(()=>process.stdout.write('password\\n'),10)"],{log:x=>logs.push(x),redact:x=>x.replaceAll('test-password','[隐藏]')});assert.deepEqual(logs,['[隐藏]'])
})
function fakeTransport({failVerification=false,blockBuild}={}){
 const a='20260918000000-aaaaaaaaaaaa',b='20260917000000-bbbbbbbbbbbb';const state={current:`releases/${a}`,previous:`releases/${b}`,commands:[],uploaded:false,closed:false,unlocked:false}
 const deps={
  connect:async()=>({execute:async(script,args)=>{state.commands.push(script);if(script===scripts.currentRemote)return {stdout:`${state.current}\n${state.previous}\n`};if(script===scripts.activateRemote)state.current=`releases/${args[3]}`;if(script===scripts.finalizeRemote){state.previous=args[3];state.unlocked=true}if(script===scripts.recoverRemote)state.current=args[4];if(script===scripts.unlockRemote)state.unlocked=true;return {stdout:'',stderr:''}},upload:async()=>{state.uploaded=true},close:async()=>{state.closed=true}}),
  build:async(_root,out,log)=>{await blockBuild?.();await mkdir(out,{recursive:true});await writeFile(path.join(out,'index.html'),'<h1>static</h1>');log('build ready')},
  run:async()=>({stdout:'',stderr:''}),
  verify:async()=>{if(failVerification)throw new Error('simulated network failure')},
 };return {state,deps}
}
test('publish uses a new release and only reports success after verification and finalize',()=>fixture(async root=>{
 const {state,deps}=fakeTransport(),manager=await createDeploymentManager(root,deps),saved=await manager.save({config:target(),expected:null},check)
 await manager.start({action:'publish',password:'test-password',expected:saved.raw},check);const job=await untilDone(manager)
 assert.equal(job.status,'success');assert(state.uploaded&&state.closed&&state.unlocked);assert.match(job.releaseId,/^\d{14}-[a-f0-9]{12}$/);assert.equal(state.current,`releases/${job.releaseId}`);assert.equal(state.previous,'releases/20260918000000-aaaaaaaaaaaa');assert(!JSON.stringify(job).includes('test-password'))
}))
test('failed verification restores original online version and reports failure',()=>fixture(async root=>{
 const {state,deps}=fakeTransport({failVerification:true}),manager=await createDeploymentManager(root,deps),saved=await manager.save({config:target(),expected:null},check)
 await manager.start({action:'publish',password:'x',expected:saved.raw},check);const job=await untilDone(manager)
 assert.equal(job.status,'failed');assert.equal(state.current,'releases/20260918000000-aaaaaaaaaaaa');assert.equal(state.previous,'releases/20260917000000-bbbbbbbbbbbb');assert(state.unlocked);assert.match(job.error,/原版本状态已恢复/)
}))
test('Nginx failure restores prior site configuration; uncertain recovery retains its backup and lock',()=>fixture(async root=>{
 for(const failRecovery of [false,true]){
  const {state,deps}=fakeTransport({failVerification:true}),execute=(await deps.connect()).execute
  deps.connect=async()=>({execute:async(script,args)=>{if(script===scripts.restoreNginx&&failRecovery)throw new Error('restore interrupted');return execute(script,args)},upload:async()=>{},close:async()=>{}})
  const manager=await createDeploymentManager(root,deps),before=await manager.load(),saved=await manager.save({config:{...target(),mode:'nginx'},expected:before.raw},check)
  await manager.start({action:'publish',password:'x',expected:saved.raw},check);const job=await untilDone(manager)
  assert.equal(job.status,'failed');assert(state.commands.includes(scripts.initializeNginx));assert.equal(state.commands.includes(scripts.unlockRemote),!failRecovery)
  if(failRecovery)assert.match(job.error,/备份保留/);else assert(state.commands.includes(scripts.restoreNginx))
 }
}))
test('failed public verification diagnoses Nginx before rollback; diagnosis failure cannot block recovery',()=>fixture(async root=>{
 for(const failDiagnostic of [false,true]){
  const {state,deps}=fakeTransport({failVerification:true}),transport=await deps.connect(),execute=transport.execute
  deps.connect=async()=>({...transport,execute:async(script,args)=>{
   const result=await execute(script,args)
   if(script===scripts.diagnoseNginx){assert.equal(args[3],'8080');if(failDiagnostic)throw new Error('diagnosis timeout')}
   return result
  }})
  const manager=await createDeploymentManager(root,deps),before=await manager.load(),saved=await manager.save({config:{...target(),mode:'nginx'},expected:before.raw},check)
  await manager.start({action:'publish',password:'x',expected:saved.raw},check);const job=await untilDone(manager)
  assert.equal(job.status,'failed');assert.match(job.error,/simulated network failure/)
  assert(state.commands.indexOf(scripts.diagnoseNginx)<state.commands.indexOf(scripts.recoverRemote))
  assert(state.commands.includes(scripts.diagnoseNginx));assert(state.unlocked)
  assert.equal(state.current,'releases/20260918000000-aaaaaaaaaaaa')
 }
}))
test('rollback skips build and upload, verifies previous release and swaps history',()=>fixture(async root=>{
 const {state,deps}=fakeTransport();deps.build=()=>{throw new Error('must not build')};const manager=await createDeploymentManager(root,deps),saved=await manager.save({config:target(),expected:null},check)
 await manager.start({action:'rollback',password:'x',expected:saved.raw},check);assert.equal((await untilDone(manager)).status,'success');assert.equal(state.current,'releases/20260917000000-bbbbbbbbbbbb');assert.equal(state.previous,'releases/20260918000000-aaaaaaaaaaaa');assert(!state.uploaded)
}))
test('test connection has no prepare, upload, activation or build side effects',()=>fixture(async root=>{
 const {state,deps}=fakeTransport();deps.build=()=>{throw new Error('must not build')};const manager=await createDeploymentManager(root,deps),saved=await manager.save({config:target(),expected:null},check)
 await manager.start({action:'test',password:'x',expected:saved.raw},check);assert.equal((await untilDone(manager)).status,'success');assert.deepEqual(state.commands,[scripts.inspectRemote]);assert(!state.uploaded)
}))
test('concurrent jobs and stale configs are refused, revocation stops before remote writes',()=>fixture(async root=>{
 let unblock;const blocked=new Promise(r=>unblock=r);let revoked=false;const guard=()=>{if(revoked)throw new Error('revoked')};const {state,deps}=fakeTransport({blockBuild:()=>blocked});const manager=await createDeploymentManager(root,deps),saved=await manager.save({config:target(),expected:null},check)
 await assert.rejects(manager.start({action:'publish',password:'x',expected:'stale'},guard),e=>e.status===409)
 await manager.start({action:'publish',password:'x',expected:saved.raw},guard);await assert.rejects(manager.start({action:'publish',password:'x',expected:saved.raw},guard),e=>e.status===409);await assert.rejects(manager.save({config:target(),expected:saved.raw},check),e=>e.status===409)
 revoked=true;unblock();assert.equal((await untilDone(manager)).status,'failed');assert(!state.uploaded);assert(!state.commands.includes(scripts.prepareRemote))
}))
test('remote scripts preserve unrelated directories and atomically switch and recover managed links',()=>fixture(async root=>{
 const base=path.join(root,'remote'),owner='a'.repeat(32),lock='b'.repeat(24),a='20260918000000-aaaaaaaaaaaa',b='20260918000001-bbbbbbbbbbbb'
 const tools=path.join(root,'tools');await mkdir(tools);await writeFile(path.join(tools,'mv'),`#!${process.execPath}\nconst fs=require('node:fs');if(process.argv[2]!=='-Tf')process.exit(1);fs.renameSync(process.argv[3],process.argv[4]);\n`,{mode:0o700})
 const execute=(script,args)=>runProcess('sh',['-s','--',...args],{input:script,env:{...process.env,PATH:tools+':'+process.env.PATH}})
 await mkdir(base);await writeFile(path.join(base,'unrelated'),'safe');await assert.rejects(execute(scripts.prepareRemote,[base,owner,lock,a,'existing']));assert.equal(await readFile(path.join(base,'unrelated'),'utf8'),'safe');await rm(path.join(base,'unrelated'))
 await execute(scripts.prepareRemote,[base,owner,lock,a,'existing']);await writeFile(path.join(base,'releases',a,'index.html'),'one');await execute(scripts.activateRemote,[base,owner,lock,a,'']);await execute(scripts.finalizeRemote,[base,owner,lock,'']);assert.equal(await readlink(path.join(base,'current')),`releases/${a}`)
 await execute(scripts.prepareRemote,[base,owner,lock,b,'existing']);await writeFile(path.join(base,'releases',b,'index.html'),'two');await assert.rejects(execute(scripts.activateRemote,[base,owner,lock,b,'wrong']));assert.equal(await readlink(path.join(base,'current')),`releases/${a}`)
 await execute(scripts.activateRemote,[base,owner,lock,b,`releases/${a}`]);await execute(scripts.recoverRemote,[base,owner,lock,b,`releases/${a}`]);await execute(scripts.unlockRemote,[base,owner,lock]);assert.equal(await readlink(path.join(base,'current')),`releases/${a}`);await assert.rejects(stat(path.join(base,'.deploy-lock')),e=>e.code==='ENOENT')
 await assert.rejects(execute(scripts.prepareRemote,[base,'c'.repeat(32),lock,b,'existing']))
}))
