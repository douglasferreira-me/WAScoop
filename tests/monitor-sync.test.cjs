const {test}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
require('fake-indexeddb/auto');require('../extension/lib/core.js');global.browser={runtime:{getManifest:()=>({version:'test'})}};global.zip=require('@zip.js/zip.js');
const {importFile,message}=require('./helpers.cjs');
test('hash de mídia em blocos coincide com SHA-256 padrão sem ler arquivo inteiro',async()=>{
 const {hashBlob}=await importFile('lib/hash.js');const bytes=crypto.randomBytes(2300000);let largest=0;
 const blob=new Blob([bytes]);const original=blob.slice.bind(blob);blob.arrayBuffer=()=>{throw Error('Leitura integral proibida');};blob.slice=(a,b)=>{largest=Math.max(largest,b-a);return original(a,b);};
 assert.equal(await hashBlob(blob),crypto.createHash('sha256').update(bytes).digest('hex'));assert.ok(largest<=1048576);
});
test('fila preserva bytes na falha e após retomada atualiza único CSV, liberando mídia só após confirmação',async()=>{
 const {Store}=await importFile('lib/store.js'),{DriveSync}=await importFile('lib/drive-sync.js'),{zipBlob}=await importFile('lib/export.js');const store=new Store();await store.open();
 const job={key:'monitor-sync',conversation:{title:'Canal',type:'canal'},startedAt:new Date().toISOString(),status:'running',count:1,mediaCount:1,mediaFailures:0,bytes:5,localBytes:5,pendingUploads:1,revision:1,options:{mode:'monitor',releaseUploadedMedia:true},driveFolder:'folder',driveMediaFolder:'media',driveAccount:'a'};
 await store.put('messages',{key:job.key+':a',job:job.key,message:{...message('m','Texto'),midias:['midias/MID-000001.bin'],midias_ids:['MID-000001']}});
 const key=job.key+':m:0';await store.put('media',{key,job:job.key,id:'MID-000001',messageId:'m',path:'midias/MID-000001.bin',size:5,blob:new Blob(['MEDIA']),complete:true});
 let fail=true,number=0;const writes=[];const drive={account:'a',folder:async()=>({id:'system'}),upload:async(name,blob,folder,progress,session,save,id)=>{
  await save('https://www.googleapis.com/session/'+name);
  if(fail)throw Error('Sem rede');writes.push({name,id,bytes:await blob.text(),session});return {id:id||'file-'+(++number)};
 }};
 const sync=new DriveSync(store,drive,async()=>{});await assert.rejects(sync.run(job,{force:true}),/Sem rede/);assert.equal(await(await store.get('media',key)).blob.text(),'MEDIA');assert.equal(job.localBytes,5);
 fail=false;await sync.run(job,{force:true});const media=await store.get('media',key);assert.equal(media.blob,null);assert.ok(media.driveId);assert.equal(job.pendingUploads,0);assert.equal(job.localBytes,0);
 await store.put('messages',{key:job.key+':b',job:job.key,message:message('new','Nova')});job.count++;job.revision++;
 await sync.run(job,{force:true});const csvs=writes.filter(w=>w.name==='mensagens.csv');assert.equal(csvs.length,2);assert.equal(csvs[1].id,'file-2');assert.match(csvs[1].bytes,/Nova/);assert.equal(writes.filter(w=>w.name.startsWith('MID')).length,1);
 assert.ok(writes[0].session);assert.equal(job.syncedRevision,2);
 const archive=await zipBlob(store,job);const reader=new zip.ZipReader(new zip.BlobReader(archive));const entries=await reader.getEntries();assert.ok(entries.some(e=>e.filename==='MIDIAS_NO_DRIVE.txt'));assert.ok(!entries.some(e=>e.filename.startsWith('midias/')));await reader.close();
 drive.account='b';await assert.rejects(sync.run(job,{force:true}),/conta/);
});
