const fs = require("node:fs");
const path = require("node:path");
const moduleUrls = new Map();
function moduleUrl(filename) {
  filename = path.resolve(filename);
  if (moduleUrls.has(filename)) return moduleUrls.get(filename);
  let source = fs.readFileSync(filename, "utf8");
  source = source.replace(/(from\s+["'])(\.[^"']+)(["'])/g, (_, before, relative, after) => before + moduleUrl(path.resolve(path.dirname(filename), relative)) + after);
  const url = "data:text/javascript;base64," + Buffer.from(source).toString("base64");
  moduleUrls.set(filename, url); return url;
}
exports.importFile = async name => import(moduleUrl(path.join(__dirname, "..", "extension", name)));
exports.message = (id, texto, date = "2026-10-10T12:00:00.000Z") => ({ id, conversa: "Grupo de teste", tipo_conversa: "grupo", data_hora: date, data_original: "09:00, 10/10/2026", remetente: "Ana", numero: "", texto, legenda: "", tipo: "texto", resposta_a: "", encaminhada: false, midias: [], status_midia: "nao_aplicavel" });
