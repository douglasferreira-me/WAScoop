const {test}=require('node:test');const assert=require('node:assert/strict');const {importFile}=require('./helpers.cjs');
test('API recupera mídia da conversa ativa por ID curto e transfere bytes preservados',async()=>{
 const {pageMediaAction}=await importFile('lib/api-media.js');
 const bytes=new Uint8Array([0,1,2,255]);const model={id:{id:'ABC',toString:()=> 'false_123@newsletter_ABC'},mediaData:{mimetype:'image/png'}};
 global.WPP={isReady:true,chat:{getActiveChat:()=>({name:'Canal teste 🇧🇷',msgs:{getModelsArray:()=>[model]}}),downloadMedia:async id=>{assert.equal(id,'false_123@newsletter_ABC');return new Blob([bytes],{type:'image/png'})}}};
 const meta=await pageMediaAction('begin',{token:'t',id:'ABC',title:'Canal teste',attachment:0});assert.equal(meta.ok,true);assert.equal(meta.source,'api_wa_js');
 const chunk=await pageMediaAction('chunk',{token:'t',offset:0});assert.deepEqual([...Buffer.from(chunk.data,'base64')],[0,1,2,255]);
 await pageMediaAction('release',{token:'t'});assert.equal((await pageMediaAction('chunk',{token:'t',offset:0})).ok,false);
});
test('API impede baixar mídia de outra conversa e não escolhe ID ambíguo',async()=>{
 const {pageMediaAction}=await importFile('lib/api-media.js');let downloads=0;
 global.WPP={isReady:true,chat:{getActiveChat:()=>({name:'Outro canal',msgs:{getModelsArray:()=>[]}}),downloadMedia:async()=>{downloads++}}};
 const changed=await pageMediaAction('begin',{token:'t',id:'ABC',title:'Canal teste',attachment:0});assert.equal(changed.code,'chat_changed');assert.equal(downloads,0);
 global.WPP.chat.getActiveChat=()=>({name:'Canal teste',msgs:{getModelsArray:()=>[{id:{id:'ABC'}},{id:{id:'ABC'}}]}});
 const ambiguous=await pageMediaAction('begin',{token:'t',id:'ABC',title:'Canal teste',attachment:0});assert.equal(ambiguous.code,'message');assert.equal(downloads,0);
});
test('API de canal usa cache original após download nativo sem MsgStore',async()=>{
 const {pageMediaAction}=await importFile('lib/api-media.js');let blob=null,triggered=0;
 const model={id:{id:'ABC',toString:()=> 'full'},mediaData:{mimetype:'video/mp4',mediaBlob:{forceToBlob:()=>blob}},downloadMedia:async()=>{triggered++;blob=new Blob(['VIDEO'],{type:'video/mp4'})}};
 global.WPP={isReady:true,whatsapp:{},chat:{getActiveChat:()=>({name:'Canal',msgs:{models:[model]}}),downloadMedia:async()=>{throw new Error('MsgStore ausente')}}};
 const meta=await pageMediaAction('begin',{token:'t',id:'ABC',title:'Canal',attachment:0});assert.equal(meta.ok,true);assert.equal(triggered,1);assert.equal(meta.mime,'video/mp4');await pageMediaAction('release',{token:'t'});
});
