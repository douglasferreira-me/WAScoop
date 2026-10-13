const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
function page(content, header = "<span title='Grupo teste'>Grupo teste</span>") {
  const dom = new JSDOM(`<html lang="pt-BR"><body><div id="main"><header>${header}</header>${content}</div></body></html>`, { runScripts: "outside-only" });
  dom.window.HTMLElement.prototype.getClientRects = () => [{}];
  dom.window.eval(fs.readFileSync("extension/lib/core.js", "utf8"));
  dom.window.eval(fs.readFileSync("extension/content/adapters.js", "utf8"));
  return dom.window;
}
test("grupo: lê identificador, metadados e legenda sem duplicar wrappers", () => {
  const w = page('<div data-id="wa1"><div class="message-in"><div data-pre-plain-text="[09:00, 13/10/2026] Ana: "><span class="selectable-text">Olá, pesquisa 🧪</span></div></div></div>');
  const A = w.ScoopAdapters, info = A.conversation(), rows = A.rows(info.root);
  assert.equal(rows.length, 1);
  const m = new A.GroupAdapter().read(rows[0], info);
  assert.equal(m.id, "wa1"); assert.equal(m.remetente, "Ana"); assert.equal(m.texto, "Olá, pesquisa 🧪"); assert.ok(m.data_hora);
});
test("canal: reconhece seguidores, timestamp e mídia com legenda", () => {
  const w = page('<div data-testid="newsletter-message" data-id="ch1" data-timestamp="1791882000"><img src="blob:https://web.whatsapp.com/test"><span class="selectable-text">Legenda</span></div>', '<span title="Canal teste">Canal teste</span><span>100 seguidores</span>');
  const A = w.ScoopAdapters, info = A.conversation();
  assert.equal(info.type, "canal");
  const m = new A.ChannelAdapter().read(A.rows(info.root)[0], info);
  assert.equal(m.tipo, "imagem"); assert.equal(m.legenda, "Legenda"); assert.equal(m.texto, ""); assert.equal(m.data_hora, new Date(1791882000 * 1000).toISOString());
});
test("campos ausentes ficam vazios sem inventar remetente ou data", () => {
  const w = page('<div class="message-in"><span class="selectable-text">sem metadados</span></div>');
  const A = w.ScoopAdapters, info = A.conversation();
  const m = new A.GroupAdapter().read(A.rows(info.root)[0], info);
  assert.equal(m.data_hora, ""); assert.equal(m.remetente, ""); assert.equal(m.id, "");
});
test("emoji e imagem citada não transformam mensagem textual em mídia", () => {
  const w = page('<div data-id="text1"><div data-testid="quoted-message"><img src="blob:https://web.whatsapp.com/quoted"></div><span class="selectable-text">Olá <img class="emoji" src="emoji.png" alt="🧪"></span></div>');
  const A = w.ScoopAdapters, info = A.conversation();
  const m = new A.GroupAdapter().read(A.rows(info.root)[0], info);
  assert.equal(m.tipo, "texto"); assert.match(m.texto, /Olá/); assert.match(m.texto, /🧪/);
});
test('prévia de link mantém mensagem textual e não solicita download de imagem', () => {
  const w = page('<div data-id="link1"><a href="https://example.com"><img src="blob:https://web.whatsapp.com/preview"></a><span class="selectable-text">Leia https://example.com</span></div>');
  const A = w.ScoopAdapters, info = A.conversation();
  const m = new A.ChannelAdapter().read(A.rows(info.root)[0], info);
  assert.equal(m.tipo, 'texto'); assert.match(m.texto, /Leia/);
});
test('coletor não clica em link de mídia e restaura interceptadores', async () => {
  const w = page('<div data-id="unsafe"><a href="https://example.com"><img data-testid="image" src="blob:https://web.whatsapp.com/preview"></a></div>');
  let clicks=0;w.document.querySelector('a').addEventListener('click',e=>{e.preventDefault();clicks++});
  w.wrappedJSObject=w;w.exportFunction=fn=>fn;w.URL.createObjectURL=()=> 'blob:test';
  const original=w.HTMLAnchorElement.prototype.click;
  w.browser={runtime:{onMessage:{addListener:()=>{}},sendMessage:async()=>({ok:true})}};
  const source=fs.readFileSync('extension/content/collector.js','utf8').replace('  async function pause(reason)', '  globalThis.testDownloadOriginal = downloadOriginal;\n  async function pause(reason)');
  w.eval(source);
  await assert.rejects(w.testDownloadOriginal(w.document.querySelector('[data-id]'),'imagem'),/Controle de mídia original não encontrado/);
  assert.equal(clicks,0);assert.equal(w.HTMLAnchorElement.prototype.click,original);
});
test('foto direta com Abrir imagem é capturável, junto de link na legenda', () => {
  const w = page('<div data-id="photo"><button aria-label="Abrir imagem"><img src="blob:https://web.whatsapp.com/original"></button><span class="selectable-text">Legenda <a href="https://example.com/full?a=1&amp;b=2">link curto</a></span></div>');
  const A=w.ScoopAdapters, info=A.conversation(), row=A.rows(info.root)[0];
  const m=new A.ChannelAdapter().read(row,info);
  assert.equal(m.tipo,'imagem');assert.equal(A.mediaTargets(row).length,1);
  assert.deepEqual(Array.from(m.links),['https://example.com/full?a=1&b=2']);
});
test('links de destino e links escritos ficam preservados sem abrir prévias', () => {
  const w=page('<div data-id="link"><div data-testid="link-preview"><img src="preview.jpg"><a href="https://example.com/destino?q=%C3%A1">Título</a></div><span class="selectable-text">Texto https://t.co/abc. (https://example.com/a_(b))</span></div>');
  const A=w.ScoopAdapters, info=A.conversation(),row=A.rows(info.root)[0];const m=new A.ChannelAdapter().read(row,info);
  assert.equal(m.tipo,'texto');assert.equal(A.mediaTargets(row).length,0);
  assert.deepEqual(Array.from(m.links),['https://example.com/destino?q=%C3%A1','https://t.co/abc','https://example.com/a_(b)']);
});
test('visualizador sem role dialog reconhece mídia, fechar e baixar', () => {
  const w=page('<div data-id="video"><button aria-label="Modo picture-in-picture"></button><img src="blob:https://web.whatsapp.com/poster"></div>');
  const A=w.ScoopAdapters, info=A.conversation(), row=A.rows(info.root)[0];
  assert.equal(new A.ChannelAdapter().read(row,info).tipo,'video');
  const viewer=w.document.createElement('section');viewer.innerHTML='<img src="original"><button aria-label="Baixar"><span data-icon="download-filled"></span></button><button aria-label="Fechar"></button>';w.document.body.append(viewer);
  assert.equal(A.mediaViewer(),viewer);assert.ok(A.downloadControl(viewer));
});
test('interações usam total acessível sem somar visualizações ou emojis', () => {
  const w=page('<div data-id="r"><span class="selectable-text">Mensagem</span><button aria-label="Reações 👍, ❤, 😂, 3.405 no total. Mostrar reações">3,4 mil</button><button>4,4 mil</button></div>');
  const A=w.ScoopAdapters, info=A.conversation();const m=new A.ChannelAdapter().read(A.rows(info.root)[0],info);
  assert.equal(m.interacoes_total,3405);assert.equal(m.interacoes_precisao,'exata');assert.ok(m.interacoes_observadas_em);
});
test('contagem abreviada é aproximada; contagem ausente permanece vazia', () => {
  const w=page('<div data-id="r"><button aria-label="Mostrar reações">3,4 mil</button></div><div data-id="empty"><span class="selectable-text">Sem dado</span></div>');
  const A=w.ScoopAdapters,info=A.conversation(),rows=A.rows(info.root);
  const approximate=A.interactions(w.document.querySelector('[data-id="r"]'));assert.equal(approximate.total,3400);assert.equal(approximate.precision,'aproximada');
  const missing=A.interactions(w.document.querySelector('[data-id="empty"]'));assert.equal(missing.total,'');assert.equal(missing.precision,'indisponivel');
});
