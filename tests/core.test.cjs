const { test } = require("node:test");
const assert = require("node:assert/strict");
const C = require("../extension/lib/core.js");
const { message } = require("./helpers.cjs");

test("identificadores estáveis deduplicam rolagem com sobreposição", () => {
  const timeline = new C.Timeline();
  const first = timeline.observe([message("b", "igual"), message("c", "igual")]);
  const second = timeline.observe([message("a", "antiga"), message("b", "igual")]);
  assert.equal(first[0].id, second[1].id);
  assert.deepEqual(timeline.sequence.map(m => m.id), ["a", "b", "c"]);
  assert.notEqual(first[0].id, first[1].id);
});
test("fallback preserva repetições na mesma tela e ancora tela anterior", () => {
  const t = new C.Timeline();
  const first = t.observe([message("", "igual"), message("", "igual"), message("", "fim")]);
  assert.notEqual(first[0].id, first[1].id);
  const second = t.observe([message("", "antiga"), message("", "igual"), message("", "igual")]);
  assert.equal(second[1].id, first[0].id); assert.equal(second[2].id, first[1].id);
  assert.equal(t.sequence.length, 4);
});
test("mensagem nova anexada após o primeiro viewport é marcada fora do corte", () => {
  const t = new C.Timeline(); t.observe([message("a", "início"), message("b", "fim")]);
  const observed = t.observe([message("a", "início"), message("b", "fim"), message("c", "nova")]);
  assert.equal(observed[2]._afterBoundary, true); assert.equal(observed[1]._afterBoundary, false);
});
test("datas usam idioma e rejeitam calendário impossível", () => {
  assert.equal(C.parseDate("09:15, 13/10/2026", "pt-BR"), new Date(2026, 9, 13, 9, 15).toISOString());
  assert.equal(C.parseDate("1:15 PM, 10/13/2026", "en-US"), new Date(2026, 9, 13, 13, 15).toISOString());
  assert.equal(C.parseDate("10:00, 31/02/2026"), "");
  assert.equal(C.parseDate("ontem"), "");
  assert.equal(C.inRange("", "2026-10-01", ""), false);
  assert.equal(C.inRange("", "", ""), true);
  const lastMinute = new Date(2026, 9, 13, 23, 59).toISOString();
  assert.equal(C.inRange(lastMinute, "2026-10-13", "2026-10-13"), true);
});
test("CSV preserva aspas, vírgulas, novas linhas e protege fórmulas", () => {
  assert.equal(C.csvCell('Olá, "mundo"\n🧪'), '"Olá, ""mundo""\n🧪"');
  assert.equal(C.csvCell("=1+1"), '"\'=1+1"');
  assert.equal(C.csvCell("+5511999999999"), '"\'+5511999999999"');
  assert.ok(C.csvHeader().startsWith("\uFEFF"));
  assert.ok(C.csvLine({ ...message("a", "oi"), midias: ["midias/a.jpg", "midias/b.jpg"] }).includes("midias/a.jpg | midias/b.jpg"));
});
test("pseudônimos preservam texto e têm estabilidade por coleta", () => {
  const names = new Map(); const m = message("a", "Texto mencionando Ana");
  const a = C.pseudonymize(m, names), b = C.pseudonymize(m, names);
  assert.equal(a.remetente, "participante_0001"); assert.equal(a.remetente, b.remetente);
  assert.equal(a.texto, m.texto); assert.equal(m.remetente, "Ana");
  assert.equal(C.pseudonymize({ ...m, remetente: "Bia" }, names).remetente, "participante_0002");
  assert.equal(C.safeName("../../arquivo: inválido"), ".._.._arquivo_ inválido");
});
test('links preservam parâmetros, texto Unicode e URLs com parênteses', () => {
  const C = require('../extension/lib/core.js');
  assert.deepEqual(C.extractLinks('Veja (https://example.com/a_(b)). https://example.com/á?q=1&v=2', ['https://example.com/destino?x=1&y=2']), ['https://example.com/destino?x=1&y=2','https://example.com/a_(b)','https://example.com/á?q=1&v=2']);
  const line=C.csvLine({links:['https://example.com/?q="aspas"&a=1'],midias_ids:['MID-000001','MID-000002'],midias:['midias/MID-000001.png','midias/MID-000002.mp4']});
  assert.match(C.csvHeader(),/"links"/);assert.match(C.csvHeader(),/"midias_ids"/);assert.match(line,/MID-000001 \| MID-000002/);assert.match(line,/midias\/MID-000002.mp4/);
});
