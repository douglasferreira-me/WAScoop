const fs = require("node:fs");
const path = require("node:path");
exports.importFile = async name => {
  const source = fs.readFileSync(path.join(__dirname, "..", "extension", name), "utf8");
  return import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
};
exports.message = (id, texto, date = "2026-10-10T12:00:00.000Z") => ({ id, conversa: "Grupo de teste", tipo_conversa: "grupo", data_hora: date, data_original: "09:00, 10/10/2026", remetente: "Ana", numero: "", texto, legenda: "", tipo: "texto", resposta_a: "", encaminhada: false, midias: [], status_midia: "nao_aplicavel" });
