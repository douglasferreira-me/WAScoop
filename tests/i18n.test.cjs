const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {JSDOM}=require('jsdom');const {importFile}=require('./helpers.cjs');
test('painel alterna Português/English sem recriar controles ou traduzir os dados coletados',async()=>{
 const {setLanguage,t,statusText,translateDocument,locale}=await importFile('lib/i18n.js');
 const dom=new JSDOM(fs.readFileSync('extension/panel.html','utf8'));const doc=dom.window.document;const apply=translateDocument(doc);const media=doc.getElementById('media');media.checked=true;
 setLanguage('en');apply();assert.equal(doc.documentElement.lang,'en');assert.equal(doc.getElementById('start-button').textContent,'Start collection');assert.equal(doc.getElementById('media'),media);assert.equal(media.checked,true);assert.equal(locale(),'en-US');
 assert.equal(t('Sua coleta · {title}',{title:'Conversa aberta'}),'Your collection · Conversa aberta');
 assert.equal(statusText('Preparando ZIP: 12 mídias'),'Preparing ZIP: 12 media files');assert.equal(statusText('Monitoramento interrompido: Reconecte à conta que criou a pasta desta coleta.'),'Listening interrupted: Reconnect to the account that created this collection folder.');
 assert.equal(statusText('Erro técnico XYZ'),'Erro técnico XYZ');
 setLanguage('pt-BR');apply();assert.equal(doc.getElementById('start-button').textContent,'Iniciar coleta');assert.equal(media.checked,true);assert.equal(doc.documentElement.lang,'pt-BR');
 dom.window.close();
});
test('todos os textos estáticos em português do painel têm tradução',async()=>{
 const {english}=await importFile('lib/translations.js');const dom=new JSDOM(fs.readFileSync('extension/panel.html','utf8'));const doc=dom.window.document;const walker=doc.createTreeWalker(doc.body,4);let node;const missing=[];
 while((node=walker.nextNode())){const source=node.nodeValue.trim();if(source&&/[áãçéêíóú]|\b(De|Até|Produzido|mensagens|processados|beta)\b/.test(source)&&!['beta','Português'].includes(source)&&!english[source])missing.push(source);}
 assert.deepEqual(missing,[]);dom.window.close();
});
