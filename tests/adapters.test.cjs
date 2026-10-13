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
