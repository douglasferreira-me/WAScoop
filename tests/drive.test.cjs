const { test } = require("node:test");
const assert = require("node:assert/strict");
const { importFile } = require("./helpers.cjs");
const response = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });
test("Drive autenticação negada pausa; erros transitórios têm tentativas limitadas", async () => {
  const { Drive, AuthRequired } = await importFile("lib/drive.js");
  let calls = 0;
  const d = new Drive({ identity: {}, tokenProvider: () => "test", sleeper: async () => {}, fetcher: async () => { calls++; return response(503); } });
  await assert.rejects(d.folder("Teste"), /503/); assert.equal(calls, 4);
  const denied = new Drive({ identity: {}, tokenProvider: () => "test", fetcher: async () => response(401) });
  await assert.rejects(denied.folder("Teste"), AuthRequired);
  await assert.rejects(d.request("https://outro.site/upload"), /Destino/);
});
test("upload retomável reconcilia posição e preserva associação", async () => {
  const { Drive } = await importFile("lib/drive.js");
  const url = "https://www.googleapis.com/upload/session", calls = [];
  const d = new Drive({ identity: {}, tokenProvider: () => "test", fetcher: async (target, init) => {
    calls.push({ target, range: init.headers["Content-Range"], body: init.body });
    if (init.headers["Content-Range"] === "bytes */6") return response(308, {}, { Range: "bytes=0-2" });
    assert.equal(init.headers["Content-Range"], "bytes 3-5/6"); return response(200, { id: "file1" });
  } });
  const result = await d.upload("a.bin", new Blob(["abcdef"]), "folder1", () => {}, url);
  assert.equal(result.id, "file1"); assert.equal(calls.length, 2); assert.equal(await calls[1].body.text(), "def");
});
test("criação de sessão e dois blocos de mídia sem perda", async () => {
  const { Drive } = await importFile("lib/drive.js");
  let puts = 0, stored;
  const d = new Drive({ identity: {}, tokenProvider: () => "test", fetcher: async (url, init) => {
    if (init.method === "POST") { assert.deepEqual(JSON.parse(init.body).parents, ["folder1"]); return response(200, {}, { Location: "https://www.googleapis.com/upload/session" }); }
    puts++; if (puts === 1) return response(308, {}, { Range: "bytes=0-1048575" }); return response(200, { id: "media1" });
  } });
  const result = await d.upload("video.mp4", new Blob([new Uint8Array(1048580)]), "folder1", () => {}, null, async url => { stored = url; });
  assert.equal(result.id, "media1"); assert.equal(puts, 2); assert.match(stored, /googleapis/);
});
test("OAuth valida state e audiência antes de aceitar token", async () => {
  const { Drive } = await importFile("lib/drive.js");
  const client = "123-test.apps.googleusercontent.com", redirect = "https://id.extensions.allizom.org/";
  const identity = { getRedirectURL: () => redirect, launchWebAuthFlow: async ({ url }) => { const q = new URL(url).searchParams; return `${redirect}#state=${q.get("state")}&access_token=abc&expires_in=3600`; } };
  const d = new Drive({ identity, clock: () => 1000, fetcher: async url => url.includes("/about?") ? response(200, { user: { permissionId: "account-1" } }) : response(200, { aud: client, scope: "https://www.googleapis.com/auth/drive.file", expires_in: "3600" }) });
  await d.connect(client); assert.ok(d.connected()); d.disconnect(); assert.equal(d.connected(), false);
  const wrong = new Drive({ identity: { ...identity, launchWebAuthFlow: async () => `${redirect}#state=wrong&access_token=abc` } });
  await assert.rejects(wrong.connect(client), /inválida/);
});
test("atualização do mesmo CSV usa PATCH, sem recriar arquivo nem alterar pasta",async()=>{
 const {Drive}=await importFile('lib/drive.js');let initial;
 const d=new Drive({identity:{},tokenProvider:()=> 'test',fetcher:async(url,init)=>{
  if(init.method==='PATCH'){initial={url,body:JSON.parse(init.body)};return response(200,{}, {Location:'https://www.googleapis.com/upload/update'});}
  assert.equal(init.method,'PUT');return response(200,{id:'csv-original'});
 }});
 await d.upload('mensagens.csv',new Blob(['csv novo']),'folder',()=>{},null,async()=>{},'csv-original');
 assert.match(initial.url,/\/csv-original\?/);assert.deepEqual(initial.body,{name:'mensagens.csv'});
});
test('renovação silenciosa não abre consentimento e impede troca de conta',async()=>{
 const {Drive,AuthRequired}=await importFile('lib/drive.js');let account='a',time=0;const prompts=[];
 const client='123.apps.googleusercontent.com',redirect='https://id.extensions.allizom.org/';
 const d=new Drive({clock:()=>time,identity:{getRedirectURL:()=>redirect,launchWebAuthFlow:async({url,interactive})=>{const q=new URL(url).searchParams;prompts.push([interactive,q.get('prompt')]);return redirect+'#state='+q.get('state')+'&access_token=test&expires_in=3600';}},fetcher:async url=>url.includes('tokeninfo')?response(200,{aud:client,scope:'https://www.googleapis.com/auth/drive.file',expires_in:3600}):url.includes('/about?')?response(200,{user:{permissionId:account}}):response(200,{id:'folder'})});
 await d.connect(client);time=4000000;await d.folder('a');assert.deepEqual(prompts,[[true,'select_account'],[false,'none']]);
 time=8000000;account='b';await assert.rejects(d.folder('a'),AuthRequired);assert.equal(d.connected(),false);
});
test('sessão retomável expirada é substituída mantendo o ID do CSV',async()=>{
 const {Drive}=await importFile('lib/drive.js');const sessions=[];let calls=0;
 const d=new Drive({identity:{},tokenProvider:()=> 'test',fetcher:async(url,init)=>{
  calls++;if(url.endsWith('/expired'))return response(410);
  if(init.method==='PATCH'){assert.match(url,/\/csv-id\?/);return response(200,{}, {Location:'https://www.googleapis.com/upload/new'});}
  return response(200,{id:'csv-id'});
 }});
 const result=await d.upload('mensagens.csv',new Blob(['texto']),'folder',()=>{},'https://www.googleapis.com/expired',async url=>sessions.push(url),'csv-id');
 assert.equal(result.id,'csv-id');assert.deepEqual(sessions,[null,'https://www.googleapis.com/upload/new']);assert.equal(calls,3);
});

test('fetch padrão mantém o contexto global exigido pelo Firefox em todas as etapas do Drive', async () => {
 const {Drive}=await importFile('lib/drive.js');
 const original=globalThis.fetch, calls=[];
 const client='123.apps.googleusercontent.com',redirect='https://test.extensions.allizom.org/';
 try {
  globalThis.fetch=async function(url,init){
   assert.equal(this,globalThis,"fetch deve receber Window/globalThis, nunca a instância Drive");calls.push(url);
   if(url.includes('tokeninfo'))return response(200,{aud:client,scope:'https://www.googleapis.com/auth/drive.file',expires_in:3600});
   if(url.includes('/about?'))return response(200,{user:{permissionId:'account'}});
   if(url.includes('/upload/')&&init.method==='POST')return response(200,{}, {Location:'https://www.googleapis.com/upload/session'});
   return response(200,{id:'file'});
  };
  const identity={getRedirectURL:()=>redirect,launchWebAuthFlow:async({url})=>redirect+'#state='+new URL(url).searchParams.get('state')+'&access_token=fixture&expires_in=3600'};
  const drive=new Drive({identity});await drive.connect(client);assert.ok(drive.connected());
  await drive.folder('Teste');await drive.upload('a.bin',new Blob(['abc']),'folder');assert.equal(calls.length,5);
 } finally {globalThis.fetch=original;}
});
