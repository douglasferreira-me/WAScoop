const { test } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { importFile, message } = require("./helpers.cjs");
require("../extension/lib/core.js");
require("../extension/lib/workbook.js");
global.zip = require("@zip.js/zip.js");
global.browser = { runtime: { getManifest: () => ({ version: "0.3.0" }) } };
const parser = new (new JSDOM()).window.DOMParser();
const job = options => ({ key: "xlsx", conversation: { title: "Pesquisa 🧪", type: "canal" }, startedAt: "2026-10-13T12:00:00Z", status: "interrupted", reason: "interrompida_pelo_usuario", count: 3, mediaCount: 1, mediaFailures: 1, bytes: 4, options: { pseudonymize: true, workbook: true, ...options } });
const store = (messages, media = []) => ({ async *records(name) { for (const row of name === "messages" ? messages.map(message => ({ message })) : media) yield row; } });
async function read(blob) {
  const reader = new zip.ZipReader(new zip.BlobReader(blob)), files = new Map();
  for (const entry of await reader.getEntries()) files.set(entry.filename, await entry.getData(new zip.TextWriter()));
  await reader.close();
  const document = name => {
    const xml = parser.parseFromString(files.get(name), "application/xml");
    assert.equal(xml.querySelector("parsererror"), null, name); return xml;
  };
  // Parse every package XML, not just the visible sheet.
  for (const name of files.keys()) if (name.endsWith(".xml") || name.endsWith(".rels")) document(name);
  return { files, document };
}
function rows(doc) { return [...doc.querySelectorAll("sheetData > row")]; }
function value(row, column) {
  const cell = row.querySelector(`c[r="${column}${row.getAttribute("r")}"]`);
  return (cell?.getAttribute("t") === "inlineStr" ? cell.querySelector("t").textContent : cell?.querySelector("v")?.textContent) ?? "";
}

test("XLSX mantém textos, datas, números e vínculos sem fórmulas ou identificação original", async () => {
  const { xlsxBlob, csvBlob } = await importFile("lib/export.js");
  const m = { ...message("m1", '=HYPERLINK("https://example.com", "aspas")\nOlá, 🧪 & <pesquisa>'), numero: "+5511999999999", interacoes_total: 0, interacoes_precisao: "exata", links: ["https://example.com/?a=1&b=2"], midias_ids: ["MID-000001"], midias: ["midias/MID-000001.png"] };
  const unknown = { ...message("m2", "Data e interações desconhecidas", ""), remetente: "Bia", interacoes_total: "", interacoes_precisao: "indisponivel" };
  const s = store([m, unknown], [{ complete: true, id: "MID-000001", messageId: "m1", path: "midias/MID-000001.png", mime: "image/png", size: 4, sha256: "abcd", source: "api_wa_js" }, { complete: false, id: "MID-000002" }]);
  const progress = [], archive = await read(await xlsxBlob(s, job(), phase => progress.push(phase)));
  const workbook = archive.document("xl/workbook.xml");
  assert.deepEqual([...workbook.querySelectorAll("sheet")].map(s => s.getAttribute("name")), ["Resumo", "Mensagens", "Mídias"]);
  const sheet = archive.document("xl/worksheets/sheet2.xml"), records = rows(sheet);
  assert.equal(value(records[1], "D"), m.texto); assert.equal(records[1].querySelector('c[r="D2"]').getAttribute("t"), "inlineStr");
  assert.equal(sheet.querySelector("f"), null); assert.equal(value(records[1], "C"), "participante_0001"); assert.equal(value(records[1], "O"), "");
  assert.equal(value(records[2], "C"), "participante_0002"); assert.equal(value(records[2], "B"), ""); assert.equal(value(records[2], "G"), "");
  assert.equal(Number(value(records[1], "B")), Date.parse(m.data_hora) / 86400000 + 25569); assert.equal(value(records[1], "T"), m.data_hora);
  assert.equal(value(records[1], "G"), "0"); assert.equal(records[1].querySelector('c[r="G2"]').getAttribute("t"), null);
  assert.equal(value(records[1], "I"), m.links[0] + " | https://example.com"); assert.equal(value(records[1], "J"), "MID-000001"); assert.equal(value(records[1], "K"), "midias/MID-000001.png");
  assert.equal(sheet.querySelector("autoFilter").getAttribute("ref"), "A1:T3"); assert.equal(sheet.querySelector("pane").getAttribute("state"), "frozen");
  const media = rows(archive.document("xl/worksheets/sheet3.xml"));
  assert.equal(media.length, 2); assert.equal(value(media[1], "A"), "MID-000001"); assert.equal(value(media[1], "B"), "m1"); assert.equal(Number(value(media[1], "E")), 4);
  const rel = archive.document("xl/worksheets/_rels/sheet3.xml.rels").querySelector("Relationship");
  assert.equal(rel.getAttribute("Target"), m.midias[0]);
  const summary = rows(archive.document("xl/worksheets/sheet1.xml"));
  assert.equal(value(summary.find(r => value(r, "A") === "Mensagens na planilha"), "B"), "2");
  assert.equal(value(summary.find(r => value(r, "A") === "Estado"), "B"), "Parcial / interrompida");
  const csv = await (await csvBlob(s, job())).text(); assert.match(csv, /participante_0001/); assert.match(csv, /MID-000001/);
  assert.equal(progress.at(-1), "Planilha XLSX pronta");
});

test("XLSX preserva números de telefone como texto e escapa controles e sequências OOXML", async () => {
  const { xlsxBlob } = await importFile("lib/export.js");
  const m = { ...message("001", "_x0041_\r\ncontrole\u0001 & 🧪"), numero: "+5511999999999" };
  const archive = await read(await xlsxBlob(store([m]), job({ pseudonymize: false })));
  const records = rows(archive.document("xl/worksheets/sheet2.xml"));
  assert.equal(value(records[1], "A"), "001"); assert.equal(value(records[1], "O"), m.numero);
  assert.equal(records[1].querySelector('c[r="O2"]').getAttribute("t"), "inlineStr");
  const xml = archive.files.get("xl/worksheets/sheet2.xml");
  assert.match(xml, /_x005F_x0041_/); assert.match(xml, /_x000D_/); assert.match(xml, /_x0001_/); assert.match(xml, /🧪/);
});

test("XLSX divide tabelas e preserva campos longos inteiros sem partir emojis", async () => {
  const { publicMessage } = await importFile("lib/export.js");
  const long = "a".repeat(32766) + "🧪" + "b".repeat(32768);
  const messages = [message("m1", long), message("m2", "segundo"), message("m3", "terceiro")];
  const archive = await read(await ScoopWorkbook.create(store(messages), job(), { maxRows: 2, message: (m, names) => publicMessage(m, job(), names) }));
  const names = [...archive.document("xl/workbook.xml").querySelectorAll("sheet")].map(s => s.getAttribute("name"));
  assert.deepEqual(names, ["Resumo", "Mensagens", "Mensagens 2", "Mídias", "Textos longos", "Textos longos 2"]);
  assert.equal(rows(archive.document("xl/worksheets/sheet2.xml")).length, 3);
  assert.equal(rows(archive.document("xl/worksheets/sheet3.xml")).length, 2);
  const parts = [...rows(archive.document("xl/worksheets/sheet5.xml")).slice(1), ...rows(archive.document("xl/worksheets/sheet6.xml")).slice(1)];
  assert.equal(parts.map(r => value(r, "D")).join(""), long);
  assert.deepEqual(parts.map(r => Number(value(r, "C"))), [1, 2, 3]);
  assert.ok(parts.every(r => value(r, "D").length <= 32767));
  assert.match(value(rows(archive.document("xl/worksheets/sheet2.xml"))[1], "D"), /Textos longos/);
});

test("ZIP padrão não gera XLSX; JSONs vão para .system e exportação vazia permanece legível", async () => {
  const { zipBlob } = await importFile("lib/export.js");
  const original = ScoopWorkbook.create;
  ScoopWorkbook.create = () => { throw new Error("XLSX não deveria ser chamado"); };
  try {
    const blob = await zipBlob(store([]), job({ workbook: false }));
    const reader = new zip.ZipReader(new zip.BlobReader(blob)), entries = await reader.getEntries();
    assert.deepEqual(entries.map(e => e.filename), ["mensagens.csv", ".system/indice_midias.json", ".system/relatorio_coleta.json"]);
    const report = JSON.parse(await entries.find(e => e.filename.endsWith("relatorio_coleta.json")).getData(new zip.TextWriter()));
    assert.equal(report.formatos.xlsx, null); await reader.close();
    const legacy = new zip.ZipReader(new zip.BlobReader(await zipBlob(store([]), job({ workbook: undefined }))));
    assert.ok(!(await legacy.getEntries()).some(e => e.filename === "mensagens.xlsx")); await legacy.close();
  } finally { ScoopWorkbook.create = original; }
  const archive = await read(await ScoopWorkbook.create(store([]), job(), { message: m => m }));
  assert.equal(rows(archive.document("xl/worksheets/sheet2.xml")).length, 1);
  assert.equal(archive.document("xl/worksheets/sheet2.xml").querySelector("autoFilter").getAttribute("ref"), "A1:T1");
});
