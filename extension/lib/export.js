const C = globalThis.ScoopCore;
export function publicMessage(m, job, names) {
  const record = job.options.pseudonymize ? C.pseudonymize(m, names) : { ...m };
  record.links = Array.from(new Set([...(record.links || []), ...C.extractLinks((record.texto || "") + "\n" + (record.legenda || ""))]));
  return record;
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
export async function reportFiles(store, job) {
  const index = [];
  for await (const row of store.records("media", job.key)) {
    if (row.complete) index.push({ midia_id: row.id || "", mensagem_id: row.messageId, arquivo: row.path, bytes: row.size, mime: row.mime, sha256: row.sha256, origem_captura: row.source || "desconhecida", drive_id: row.driveId || "", upload: row.uploadError || (row.driveId ? "enviado" : "local") });
  }
  const report = {
    ferramenta: "Whatsapp Scoop", versao: browser.runtime.getManifest().version, autor: "douglasferreira", site: "https://douglasferreira.me",
    conversa: job.conversation.title, tipo: job.conversation.type, inicio_coleta: job.startedAt, fim_coleta: job.finishedAt || null,
    estado: job.status, motivo_termino: job.reason || "coleta_em_andamento", escopo: "histórico acessível à sessão WhatsApp Web, sem garantia de integralidade",
    intervalo_solicitado: { inicio: job.options.start || null, fim: job.options.end || null }, periodo_observado: { inicio: job.oldest || null, fim: job.newest || null },
    mensagens: job.count, midias_obtidas: job.mediaCount, midias_com_falha: job.mediaFailures, bytes: job.bytes,
    pseudonimizacao: job.options.pseudonymize ? "identificadores dos remetentes; texto e mídia não são anonimizados" : "não aplicada",
    datas_desconhecidas_excluidas_pelo_filtro: job.unknownDates || 0,
    identificadores_inferidos: !!job.fallbackIds,
    observacoes: [...(job.notes || []), "Datas interpretadas conforme idioma da interface e fuso do navegador.", "Campos ausentes não foram inventados.", "Áudio/vídeo com origem blob_reproducao preservam os bytes acessíveis no navegador; compare com o download manual para avaliar eventual transformação pelo WhatsApp.", "CSV aplica apóstrofo inicial a células que poderiam ser interpretadas como fórmulas; remova-o para recuperar o valor original."],
    falhas: job.failures || [], arquivos: index,
    citacao: `douglasferreira. Whatsapp Scoop, versão ${browser.runtime.getManifest().version}. https://github.com/douglasferreira-me/WAScoop. Coleta em ${job.startedAt}.`
  };
  return { index: new Blob([JSON.stringify(index, null, 2)], { type: "application/json" }), report: new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }) };
}
export async function zipBlob(store, job, progress) {
  zip.configure({ useWebWorkers: false, useCompressionStream: false });
  const writer = new zip.ZipWriter(new zip.BlobWriter("application/zip"));
  const timestamp = new Date(job.startedAt);
  const add = (name, blob) => writer.add(name, new zip.BlobReader(blob), { level: 0, lastModDate: timestamp });
  try {
    await writer.add("mensagens.csv", csvStream(store, job), { level: 0, lastModDate: timestamp });
    let n = 0;
    for await (const row of store.records("media", job.key)) {
      if (!row.complete) continue;
      await add(row.path, row.blob); progress(++n);
    }
    const files = await reportFiles(store, job);
    await add("indice_midias.json", files.index); await add("relatorio_coleta.json", files.report);
    return await writer.close();
  } catch (e) { try { await writer.close(); } catch { /* Preserve original error. */ } throw e; }
}
