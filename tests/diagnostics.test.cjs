const {test}=require('node:test');
const assert=require('node:assert/strict');
const {importFile}=require('./helpers.cjs');
test('diagnóstico preserva erros e contagens sem corpus ou credenciais',async()=>{
 const {DiagnosticLog,downloadDiagnostic}=await importFile('lib/diagnostics.js');
 const log=new DiagnosticLog({privateValues:()=>['Canal privado']});
 log.record('export_failed',{messages:3,texto:'SEGREDO',title:'Canal privado'},new Error('Canal privado Bearer TOKEN email teste@example.com https://example.com/segredo?access_token=TOKEN'));
 const result=await downloadDiagnostic({log,job:{status:'paused',count:3,conversation:{title:'Canal privado',type:'canal'},options:{}},environment:{version:'test'},downloads:{download:async()=>{throw new Error('Download indisponível')}},urls:{createObjectURL:()=> 'blob:test',revokeObjectURL:()=>{}}});
 assert.equal(result.downloaded,false);assert.match(result.text,/diagnostic_download_failed/);assert.match(result.text,/export_failed/);
 for(const privateText of ['SEGREDO','Canal privado','TOKEN','teste@example.com','segredo?'])assert.ok(!result.text.includes(privateText));
 assert.equal(JSON.parse(result.text).collection.messages,3);
});
test('log disponível sem coleta e persiste histórico limitado',async()=>{
 const {DiagnosticLog,downloadDiagnostic}=await importFile('lib/diagnostics.js');let saved={};
 const storage={get:async()=>saved,set:async value=>{saved=structuredClone(value)}};
 const log=new DiagnosticLog({storage,limit:2});for(let i=0;i<4;i++)log.record('step',{messages:i});await log.flush();
 const restored=new DiagnosticLog({storage,limit:2});await restored.load();assert.equal(restored.entries.length,2);assert.equal(restored.dropped,2);
 const result=await downloadDiagnostic({log:restored,job:null,environment:{},downloads:{download:async()=>7},urls:{createObjectURL:()=> 'blob:test'},onStarted:async()=>{}});
 assert.equal(result.downloaded,true);assert.equal(JSON.parse(result.text).collection,null);await restored.flush();
});
