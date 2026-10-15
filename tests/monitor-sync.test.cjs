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
 await sync.run(job,{force:true});const csvs=writes.filter(w=>w.name==='mensagens.csv');assert.equal(csvs.length,3);assert.equal(csvs[1].id,'file-2');assert.equal(csvs[2].id,'file-2');assert.match(csvs[2].bytes,/Nova/);assert.equal(writes.filter(w=>w.name.startsWith('MID')).length,1);
 assert.ok(writes[0].session);assert.equal(job.syncedRevision,3);
 const archive=await zipBlob(store,job);const reader=new zip.ZipReader(new zip.BlobReader(archive));const entries=await reader.getEntries();assert.ok(entries.some(e=>e.filename==='MIDIAS_NO_DRIVE.txt'));assert.ok(!entries.some(e=>e.filename.startsWith('midias/')));await reader.close();
 drive.account='b';await assert.rejects(sync.run(job,{force:true}),/conta/);
});

test('monitoramento atualiza o mesmo workbook opcional durante a coleta, com novas mensagens',async()=>{
 require('../extension/lib/workbook.js');
 const {Store}=await importFile('lib/store.js'),{DriveSync}=await importFile('lib/drive-sync.js');const store=new Store();await store.open();
 const job={key:'monitor-workbook',conversation:{title:'Canal',type:'canal'},startedAt:new Date().toISOString(),status:'running',count:1,mediaCount:0,mediaFailures:0,revision:1,options:{mode:'monitor',workbook:true},driveFolder:'folder',driveSystemFolder:'system'};
 await store.put('messages',{key:job.key+':a',job:job.key,message:message('a','Primeira')});
 let number=0;const writes=[];const drive={upload:async(name,blob,folder,progress,session,save,id)=>{writes.push({name,id,blob});return{id:id||'file-'+(++number)};}};
 const sync=new DriveSync(store,drive,async()=>{});await sync.run(job);
 const first=writes.find(w=>w.name==='workbook.xlsx');assert.ok(first,'workbook criado antes de encerrar');
 await store.put('messages',{key:job.key+':b',job:job.key,message:message('b','Segunda')});job.revision++;job.count++;job.lastSyncAttempt=0;
 await sync.run(job);
 const books=writes.filter(w=>w.name==='workbook.xlsx');assert.equal(books.length,2);assert.equal(books[1].id,(await store.get('uploads',job.key+':workbook.xlsx')).id);assert.ok(books[1].id);assert.equal(books[0].id,undefined);
 const reader=new zip.ZipReader(new zip.BlobReader(books[1].blob));const entries=await reader.getEntries();const xml=await entries.find(e=>e.filename==='xl/worksheets/sheet2.xml').getData(new zip.TextWriter());assert.match(xml,/Primeira/);assert.match(xml,/Segunda/);await reader.close();
 await sync.run(job);assert.equal(writes.filter(w=>w.name==='workbook.xlsx').length,2,'sem mudanças não gera outro workbook');
 job.options.workbook=false;job.revision++;job.lastSyncAttempt=0;await sync.run(job);assert.equal(writes.filter(w=>w.name==='workbook.xlsx').length,2,'XLSX continua opcional');
});

test('falha isolada de mídia preserva fila e permite atualizar CSV; retomada atualiza índice sem mensagem nova',async()=>{
 const {Store}=await importFile('lib/store.js'),{DriveSync}=await importFile('lib/drive-sync.js');const store=new Store();await store.open();
 const job={key:'monitor-media-failure',conversation:{title:'Canal',type:'canal'},startedAt:new Date().toISOString(),status:'running',count:1,mediaCount:1,mediaFailures:0,revision:1,options:{mode:'monitor'},driveFolder:'folder',driveMediaFolder:'media',driveSystemFolder:'system',pendingUploads:1};
 await store.put('messages',{key:job.key+':a',job:job.key,message:message('a','Mensagem preservada')});
 await store.put('media',{key:job.key+':m',job:job.key,id:'MID-000001',path:'midias/MID-000001.png',size:5,blob:new Blob(['MEDIA']),complete:true});
 let fail=true;const writes=[];const drive={upload:async(name,blob,folder,progress,session,save,id)=>{if(name.startsWith('MID')&&fail)throw Error('Falha de mídia isolada');writes.push({name,blob,id});return{id:id||name};}};
 const sync=new DriveSync(store,drive,async()=>{});await assert.rejects(sync.run(job),/Falha de mídia isolada/);
 assert.match(await writes.find(w=>w.name==='mensagens.csv').blob.text(),/Mensagem preservada/);assert.equal(job.pendingUploads,1);assert.ok((await store.get('media',job.key+':m')).blob);assert.equal(job.syncedRevision,1);
 fail=false;job.lastSyncAttempt=0;await sync.run(job);assert.equal(job.syncedRevision,2);assert.equal(job.pendingUploads,0);
 const indexes=writes.filter(w=>w.name==='indice_midias.json');assert.equal(indexes.length,2);assert.match(await indexes[1].blob.text(),/MID-000001.png/);assert.equal(writes.filter(w=>w.name==='mensagens.csv')[1].id,'mensagens.csv');
});
