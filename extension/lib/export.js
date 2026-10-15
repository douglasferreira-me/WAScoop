const C = globalThis.ScoopCore;
export function publicMessage(m, job, names) {
  const record = job.options.pseudonymize ? C.pseudonymize(m, names) : { ...m };
  record.links = Array.from(new Set([...(record.links || []), ...C.extractLinks((record.texto || "") + "\n" + (record.legenda || ""))]));
  return C.assessCapture(record);
}
export function csvStream(store, job) {
  const iterator = store.records("messages", job.key), names = new Map(), encoder = new TextEncoder();
  let header = false;
  return new ReadableStream({
    async pull(controller) {
      try {
        if (!header) { header = true; controller.enqueue(encoder.encode(C.csvHeader())); return; }
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(C.csvLine(publicMessage(next.value.message, job, names))));
      } catch (e) { controller.error(e); }
    },
    cancel() { return iterator.return?.(); }
  });
}
export async function csvBlob(store, job) {
  const blob = await new Response(csvStream(store, job)).blob();
  return new Blob([blob], { type: "text/csv;charset=utf-8" });
}
export function xlsxBlob(store, job, progress) {
  return globalThis.ScoopWorkbook.create(store, job, { message: (m, names) => publicMessage(m, job, names), progress });
}
export async function reportFiles(store, job) {
  const index = [];
  for await (const row of store.records("media", job.key)) {
    if (row.complete) index.push({ midia_id: row.id || "", mensagem_id: row.messageId, arquivo: row.path, bytes: row.size, mime: row.mime, sha256: row.sha256, origem_captura: row.source || "desconhecida", drive_id: row.driveId || "", drive_url: row.driveId ? `https://drive.google.com/file/d/${row.driveId}/view` : "", copia_local_liberada: !!row.localReleased, upload: row.uploadError || (row.driveId ? "enviado" : "local") });
  }
  let incompleteCount = 0;
  for await (const row of store.records("messages", job.key)) if (C.assessCapture(row.message).status_captura === "incompleta") incompleteCount++;
  const report = {
    ferramenta: "Whatsapp Scoop", versao: browser.runtime.getManifest().version, autor: "douglasferreira", site: "https://douglasferreira.me",
    conversa: job.conversation.title, tipo: job.conversation.type, inicio_coleta: job.startedAt, fim_coleta: job.finishedAt || null,
    estado: job.status, motivo_termino: job.reason || "coleta_em_andamento", modo: job.options.mode || "history", escopo: job.options.mode === "monitor" ? "mensagens novas observadas após ativação, sem garantia de captura durante interrupções" : "histórico acessível à sessão WhatsApp Web, sem garantia de integralidade",
    monitoramento: job.options.mode === "monitor" ? { ultima_verificacao: job.lastCheck || null, ultima_sincronizacao: job.lastSync || null, midias_pendentes: job.pendingUploads || 0, bytes_locais: job.localBytes || 0, limite_local_mb: job.options.localLimitMB, canal_id: job.monitorChatId, cursor: job.monitorCursor } : null,
    intervalo_solicitado: { inicio: job.options.start || null, fim: job.options.end || null }, periodo_observado: { inicio: job.oldest || null, fim: job.newest || null },
    mensagens: job.count, mensagens_incompletas: incompleteCount, qualidade_metadados: incompleteCount ? "com_pendencias" : "sem_pendencias_identificadas", midias_obtidas: job.mediaCount, midias_com_falha: job.mediaFailures, bytes: job.bytes,
    pseudonimizacao: job.options.pseudonymize ? "identificadores dos remetentes; texto e mídia não são anonimizados" : "não aplicada",
    datas_desconhecidas_excluidas_pelo_filtro: job.unknownDates || 0,
    identificadores_inferidos: !!job.fallbackIds,
    registros_vazios_nao_contados: job.emptyRecords || 0,
    formatos: { csv: "mensagens.csv", xlsx: job.options.workbook ? "workbook.xlsx" : null, indice_midias: ".system/indice_midias.json", relatorio: ".system/relatorio_coleta.json" },
    observacoes: [...(job.notes || []), "Datas interpretadas conforme idioma da interface e fuso do navegador.", "Campos ausentes não foram inventados.", "Áudio/vídeo com origem blob_reproducao preservam os bytes acessíveis no navegador; compare com o download manual para avaliar eventual transformação pelo WhatsApp.", "CSV aplica apóstrofo inicial a células que poderiam ser interpretadas como fórmulas; remova-o para recuperar o valor original.", "XLSX mantém textos como texto, datas em UTC e contagens numéricas. Campos acima de 32.767 caracteres ficam completos em partes na aba Textos longos. O resumo é um retrato da exportação e não muda ao filtrar."],
    falhas: job.failures || [], arquivos: index,
    citacao: `douglasferreira. Whatsapp Scoop, versão ${browser.runtime.getManifest().version}. https://github.com/douglasferreira-me/WAScoop. Coleta em ${job.startedAt}.`
  };
  return { index: new Blob([JSON.stringify(index, null, 2)], { type: "application/json" }), report: new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }) };
}
export async function zipBlob(store, job, progress = () => {}, workbookProgress = () => {}) {
  zip.configure({ useWebWorkers: false, useCompressionStream: false });
  const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
  const timestamp = new Date(job.startedAt);
  const add = (name, blob) => writer.add(name, new zip.BlobReader(blob), { level: 0, lastModDate: timestamp });
  try {
    await writer.add("mensagens.csv", csvStream(store, job), { level: 0, lastModDate: timestamp });
    if (job.options.workbook) await add("workbook.xlsx", await xlsxBlob(store, job, workbookProgress));
    let n = 0, remote = 0;
    for await (const row of store.records("media", job.key)) {
      if (!row.complete) continue;
      if (row.blob) { await add(row.path, row.blob); progress(++n); } else if (row.driveId) remote++; else throw new Error("Mídia sem cópia local e sem confirmação no Drive.");
    }
    if (remote) await add("MIDIAS_NO_DRIVE.txt", new Blob([`${remote} mídia(s) tiveram suas cópias locais liberadas após envio ao Drive. Consulte .system/indice_midias.json: cada MID do CSV tem drive_url e drive_id. Este ZIP não contém essas mídias.\nPasta: ${job.driveLink || ""}`]));
    const files = await reportFiles(store, job);
    await add(".system/indice_midias.json", files.index); await add(".system/relatorio_coleta.json", files.report);
    return await writer.close();
  } catch (e) { try { await writer.close(); } catch { /* Preserve original error. */ } throw e; }
}
