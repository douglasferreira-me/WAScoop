/* Browser-only XLSX writer: stream SpreadsheetML into the bundled ZIP library.
 * No formulas, remote code, shared-string corpus or additional runtime required.
 * Format: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/structure-of-a-spreadsheetml-document
 */
(function (root) {
  "use strict";
  const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
  const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const MAX_ROWS = 1048575, MAX_TEXT = 32767;
  const messageColumns = [
    ["id", "Mensagem ID", 28], ["data_hora", "Data/hora (UTC)", 23, "date"], ["remetente", "Remetente", 26],
    ["texto", "Texto", 65], ["legenda", "Legenda", 48], ["tipo", "Tipo de mensagem", 20],
    ["interacoes_total", "Interações totais", 18, "number"], ["interacoes_precisao", "Precisão das interações", 24],
    ["links", "Links", 55], ["midias_ids", "Mídias IDs", 25], ["midias", "Arquivos de mídia", 48],
    ["status_midia", "Estado das mídias", 23], ["resposta_a", "Resposta à mensagem ID", 28],
    ["encaminhada", "Encaminhada", 18], ["numero", "Número do remetente", 25], ["conversa", "Conversa", 32],
    ["tipo_conversa", "Tipo de conversa", 22], ["data_original", "Data observada na página", 32],
    ["interacoes_observadas_em", "Interações observadas em (UTC)", 32, "date"],
    ["data_hora_iso", "Data/hora ISO original", 30], ["link_mensagem", "Link permanente da mensagem", 60]
  ];
  const mediaColumns = [
    ["id", "Mídia ID", 23], ["messageId", "Mensagem ID", 28], ["path", "Arquivo de mídia", 48],
    ["mime", "Formato (MIME)", 26], ["size", "Tamanho (bytes)", 20, "number"], ["sha256", "SHA-256", 66],
    ["source", "Origem da captura", 27], ["driveId", "Arquivo ID no Drive", 32], ["upload", "Estado do envio", 30]
  ];
  function escapeXML(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function spreadsheetText(value) {
    // Preserve literal _xNNNN_ strings and XML-forbidden controls using OOXML escapes.
    return escapeXML(String(value ?? "").replace(/_x[\da-f]{4}_/gi, s => "_x005F_" + s.slice(1))
      .replace(/[\u0000-\u0008\u000b-\u001f\ufffe\uffff\ud800-\udfff]/gu, c => `_x${c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}_`));
  }
  function joined(value) { return Array.isArray(value) ? value.join(" | ") : String(value ?? ""); }
  function *textParts(value, size = MAX_TEXT) {
    for (let offset = 0; offset < value.length;) {
      let end = Math.min(offset + size, value.length);
      if (end < value.length && /[\ud800-\udbff]/.test(value[end - 1])) end--;
      yield value.slice(offset, end); offset = end;
    }
  }
  function visibleText(value) {
    const text = joined(value);
    return text.length <= MAX_TEXT ? text : textParts(text, 512).next().value + " … [conteúdo completo em Textos longos]";
  }
  function columnName(index) {
    let name = "";
    for (index++; index; index = Math.floor((index - 1) / 26)) name = String.fromCharCode(65 + (index - 1) % 26) + name;
    return name;
  }
  function dateValue(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return null;
    const date = +new Date(value);
    // Excel's 1900 date system includes its fictitious leap day. Corpus dates are modern.
    return Number.isFinite(date) && date >= Date.UTC(1900, 2, 1) && date <= Date.UTC(9999, 11, 31, 23, 59, 59, 999)
      ? date / 86400000 + 25569 : null;
  }
  function cell(ref, value, kind = "text", alternate = false, override) {
    let style = alternate ? 3 : 2;
    if (value === "" || value === null || value === undefined) return `<c r="${ref}" s="${override ?? style}"/>`;
    if (typeof value === "boolean") return `<c r="${ref}" s="${override ?? style}" t="b"><v>${value ? 1 : 0}</v></c>`;
    if (kind === "date") {
      const serial = dateValue(value);
      if (serial !== null) return `<c r="${ref}" s="${override ?? (alternate ? 7 : 6)}"><v>${serial}</v></c>`;
    }
    if (kind === "number" && value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value))) {
      return `<c r="${ref}" s="${override ?? (alternate ? 5 : 4)}"><v>${Number(value)}</v></c>`;
    }
    if (override !== undefined) style = override;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${spreadsheetText(visibleText(value))}</t></is></c>`;
  }
  function stream(iterator) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      async pull(controller) {
        try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); }
        catch (error) { controller.error(error); }
      },
      cancel() { return iterator.return?.(); }
    });
  }
  const styles = XML + `<styleSheet xmlns="${NS}">
    <numFmts count="2"><numFmt numFmtId="164" formatCode="dd/mm/yyyy hh:mm:ss"/><numFmt numFmtId="165" formatCode="#,##0"/></numFmts>
    <fonts count="5">
      <font><sz val="11"/><color rgb="FF172D29"/><name val="Calibri"/></font>
      <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
      <font><b/><sz val="20"/><color rgb="FF075E54"/><name val="Calibri"/></font>
      <font><b/><sz val="11"/><color rgb="FF075E54"/><name val="Calibri"/></font>
      <font><u/><sz val="11"/><color rgb="FF087F5B"/><name val="Calibri"/></font>
    </fonts>
    <fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FF075E54"/><bgColor indexed="64"/></patternFill></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FFF0F7F4"/><bgColor indexed="64"/></patternFill></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FFE2F2EA"/><bgColor indexed="64"/></patternFill></fill>
    </fills>
    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="15">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
      <xf numFmtId="165" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
      <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
      <xf numFmtId="164" fontId="0" fillId="3" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
      <xf numFmtId="0" fontId="3" fillId="4" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="165" fontId="3" fillId="4" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
      <xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="4" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
      <xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  </styleSheet>`;
  function sheetStart(columns, freeze = true) {
    const pane = freeze ? '<pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="C2" sqref="C2"/>' : '<selection activeCell="A1" sqref="A1"/>';
    return XML + `<worksheet xmlns="${NS}" xmlns:r="${REL}"><sheetViews><sheetView showGridLines="0" workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols>` +
      columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c[2]}" customWidth="1"/>`).join("") + '</cols><sheetData>';
  }
  async function create(store, job, options) {
    const { message, progress = () => {}, maxRows = MAX_ROWS } = options;
    if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAX_ROWS) throw new Error("Limite de linhas XLSX inválido.");
    zip.configure({ useWebWorkers: false, useCompressionStream: false });
    const writer = new zip.ZipWriter(new zip.BlobWriter(MIME)), sheets = [];
    const timestamp = new Date(job.startedAt), stats = { messages: 0, media: 0, longFields: 0, datesUnknown: 0, types: new Map() };
    const add = (path, xml) => writer.add(path, new zip.TextReader(xml), { level: 6, lastModDate: timestamp });
    async function *messages() {
      const names = new Map();
      for await (const row of store.records("messages", job.key)) {
        const m = message(row.message, names); m.data_hora_iso = m.data_hora || ""; yield m;
      }
    }
    async function *media() {
      for await (const row of store.records("media", job.key)) if (row.complete) yield { ...row, upload: row.uploadError || (row.driveId ? "enviado" : "local") };
    }
    async function *longTexts() {
      for await (const m of messages()) for (const [field] of messageColumns) {
        const value = joined(m[field]);
        if (value.length <= MAX_TEXT) continue;
        let part = 0;
        for (const text of textParts(value)) yield { id: m.id, campo: field, parte: ++part, texto: text };
      }
    }
    async function addSheets(base, columns, iterator, onRecord, linkField) {
      let next = await iterator.next(), part = 0;
      try {
        do {
          const descriptor = { name: base + (++part > 1 ? ` ${part}` : ""), id: sheets.length + 1 }, links = [];
          sheets.push(descriptor);
          async function *xml() {
            yield sheetStart(columns);
            yield '<row r="1" ht="38" customHeight="1">' + columns.map((c, i) => cell(columnName(i) + "1", c[1], "text", false, 1)).join("") + '</row>';
            let count = 0;
            while (!next.done && count < maxRows) {
              const record = next.value, row = ++count + 1, alternate = count % 2 === 0;
              onRecord?.(record);
              yield `<row r="${row}" ht="54" customHeight="1">` + columns.map(([field, , , kind], i) => {
                const ref = columnName(i) + row, value = record[field];
                // Only controlled relative media paths become hyperlinks. Never message URLs.
                const linked = linkField === field && /^midias\/[^/\\]+$/.test(value || "") && !/[\u0000-\u001f]/.test(value) && !/(^|\/)\.\.?($|\/)/.test(value);
                if (linked) links.push({ ref, target: value });
                return cell(ref, value, kind, alternate, linked ? (alternate ? 12 : 11) : undefined);
              }).join("") + '</row>';
              if (count % 250 === 0) progress(`${base}: ${stats.messages} mensagens`);
              next = await iterator.next();
            }
            yield `</sheetData><autoFilter ref="A1:${columnName(columns.length - 1)}${count + 1}"/>`;
            if (links.length) yield '<hyperlinks>' + links.map((link, i) => `<hyperlink ref="${link.ref}" r:id="rId${i + 1}" tooltip="Abra após extrair o ZIP; mantenha a pasta midias ao lado da planilha."/>`).join("") + '</hyperlinks>';
            yield '<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>';
          }
          await writer.add(`xl/worksheets/sheet${descriptor.id}.xml`, stream(xml()), { level: 6, lastModDate: timestamp });
          if (links.length) await add(`xl/worksheets/_rels/sheet${descriptor.id}.xml.rels`, XML + `<Relationships xmlns="${PKG_REL}">` + links.map((link, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/hyperlink" Target="${escapeXML(link.target)}" TargetMode="External"/>`).join("") + '</Relationships>');
        } while (!next.done);
      } finally { await iterator.return?.(); }
    }
    try {
      // Reserve the first sheet for the overview, generated after streaming the corpus.
      sheets.push({ name: "Resumo", id: 1 });
      progress("Preparando planilha XLSX");
      await addSheets("Mensagens", messageColumns, messages(), m => {
        stats.messages++; if (dateValue(m.data_hora) === null) stats.datesUnknown++;
        const type = m.tipo || "não identificado"; stats.types.set(type, (stats.types.get(type) || 0) + 1);
        for (const [field] of messageColumns) if (joined(m[field]).length > MAX_TEXT) stats.longFields++;
      });
      await addSheets("Mídias", mediaColumns, media(), () => { stats.media++; }, "path");
      if (stats.longFields) await addSheets("Textos longos", [["id", "Mensagem ID", 28], ["campo", "Campo original", 28], ["parte", "Parte (ordem)", 18, "number"], ["texto", "Conteúdo completo em partes", 90]], longTexts());
      const version = browser.runtime.getManifest().version;
      const overview = [
        ["Whatsapp Scoop", "Resumo da coleta"],
        ["Conversa", job.conversation.title], ["Tipo de conversa", job.conversation.type], ["Versão", version],
        ["Produzido por", "douglasferreira · https://douglasferreira.me"],
        ["Início da coleta (UTC)", job.startedAt, "date"], ["Fim da coleta (UTC)", job.finishedAt || "", "date"],
        ["Estado", ({ finished: "Encerrada", interrupted: "Parcial / interrompida", paused: "Pausada", running: "Em andamento" })[job.status] || job.status],
        ["Motivo do término", ({ interrompida_pelo_usuario: "Encerrada pelo pesquisador", intervalo: "Limite do período solicitado", limite_observado: "Limite observado da rolagem; histórico integral não garantido", sessao_perdida: "Sessão ou aba indisponível", falha_preparacao_drive: "Falha ao preparar o Google Drive" })[job.reason] || job.reason || "Coleta ainda em andamento"],
        ["Data inicial solicitada", job.options.start || "Sem filtro"], ["Data final solicitada", job.options.end || "Sem filtro"],
        ["Primeira data observada (UTC)", job.oldest || "", "date"], ["Última data observada (UTC)", job.newest || "", "date"],
        ["Mensagens na planilha", stats.messages, "number"], ["Mídias recuperadas", stats.media, "number"],
        ["Falhas de mídia", job.mediaFailures || 0, "number"], ["Volume das mídias (bytes)", job.bytes || 0, "number"],
        ["Mensagens sem data reconhecida", stats.datesUnknown, "number"],
        ["Sem data excluídas pelo filtro", job.unknownDates || 0, "number"],
        ["Campos acima do limite de célula", stats.longFields, "number"],
        ["Pseudônimos", job.options.pseudonymize ? "Aplicados aos remetentes. Textos e mídias não são anonimizados." : "Não aplicados"],
        ["", ""], ["Como usar", "Use as setas dos cabeçalhos para filtrar e ordenar as mensagens. Cabeçalho e duas primeiras colunas ficam fixos."],
        ["Leitura dos textos", "Selecione a célula para ler todo o texto; aumente a altura da linha quando necessário."],
        ["Referências às mídias", "Mídias IDs e Arquivos de mídia correspondem na mesma ordem. Na aba Mídias, o caminho abre o arquivo após extrair o ZIP."],
        ["Interações", "Total de reações observado, sem emojis ou participantes. Precisão indica exata, aproximada ou indisponível; vazio não é zero."],
        ["Datas", "Datas numéricas em UTC, prontas para ordenar. A coluna ISO e a data observada preservam a referência original."],
        ["Limites do XLSX", "Acima de 32.767 caracteres, o campo completo fica em Textos longos: una as partes pela ordem. Grandes tabelas são divididas em abas numeradas."],
        ["Integridade do corpus", "CSV e XLSX representam a mesma coleta. Textos no XLSX são células de texto, nunca fórmulas. O CSV preserva todos os campos sem limite de célula."],
        ["Resumo fixo", "Estas contagens descrevem a exportação; não mudam ao editar ou filtrar a planilha."],
        ["Limitação da coleta", "Somente o histórico acessível à sessão. Não há garantia de integralidade nem classificação automática de desinformação."],
        ["Arquivos técnicos", ".system/indice_midias.json e .system/relatorio_coleta.json. Pastas com ponto podem ficar ocultas no computador."],
        ["Mensagens por tipo", "Quantidade coletada"]
      ];
      for (const [type, count] of [...stats.types].sort(([a], [b]) => a.localeCompare(b))) overview.push([visibleText(type), count, "number"]);
      let summary = sheetStart([["", "", 36], ["", "", 104]], false);
      for (let i = 0; i < overview.length; i++) {
        const [label, value, kind] = overview[i], row = i + 1;
        summary += `<row r="${row}" ht="${i === 0 ? 34 : kind ? 25 : 42}" customHeight="1">` + cell("A" + row, label, "text", false, i === 0 ? 9 : 8) + cell("B" + row, value, kind, false, i === 0 ? 9 : kind === "number" ? 10 : kind === "date" ? 14 : 13) + '</row>';
      }
      await add("xl/worksheets/sheet1.xml", summary + '</sheetData><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>');
      await add("xl/styles.xml", styles);
      await add("xl/workbook.xml", XML + `<workbook xmlns="${NS}" xmlns:r="${REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>` + sheets.map(s => `<sheet name="${escapeXML(s.name)}" sheetId="${s.id}" r:id="rId${s.id}"/>`).join("") + '</sheets></workbook>');
      await add("xl/_rels/workbook.xml.rels", XML + `<Relationships xmlns="${PKG_REL}">` + sheets.map(s => `<Relationship Id="rId${s.id}" Type="${REL}/worksheet" Target="worksheets/sheet${s.id}.xml"/>`).join("") + `<Relationship Id="styles" Type="${REL}/styles" Target="styles.xml"/></Relationships>`);
      await add("_rels/.rels", XML + `<Relationships xmlns="${PKG_REL}"><Relationship Id="workbook" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
      await add("[Content_Types].xml", XML + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map(s => `<Override PartName="/xl/worksheets/sheet${s.id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") + '</Types>');
      progress("Planilha XLSX pronta");
      return await writer.close();
    } catch (error) { try { await writer.close(); } catch { /* Preserve the original error. */ } throw error; }
  }
  const api = { create };
  root.ScoopWorkbook = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
