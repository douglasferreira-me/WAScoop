import { ApiMedia } from "./lib/api-media.js";
import { DiagnosticLog, downloadDiagnostic, jobSummary } from "./lib/diagnostics.js";
import { Store } from "./lib/store.js";
import { Drive, AuthRequired } from "./lib/drive.js";
import { csvBlob, xlsxBlob, reportFiles, zipBlob } from "./lib/export.js";
const googlePermissions = { origins: ["https://accounts.google.com/*", "https://www.googleapis.com/*", "https://oauth2.googleapis.com/*"], data_collection: ["personalCommunications", "personallyIdentifyingInfo", "websiteContent", "authenticationInfo"] };
async function assertGooglePermissions() {
  if (!await browser.permissions.contains(googlePermissions)) throw new AuthRequired("Autorize novamente o envio ao Google Drive pelo botão Conectar.");
}
const C = globalThis.ScoopCore, store = new Store(), drive = new Drive({ authorize: assertGooglePermissions });
let job = null, inspectCache = null, exportBusy = false, storageError = null;
const diagnostics = new DiagnosticLog({ storage: browser.storage.local, privateValues: () => [job?.conversation?.title, job?.conversation?.identity] });
const diagnosticReady = diagnostics.load();
const ready = store.open().catch(e => { storageError = e; diagnostics.record("storage_unavailable", { operation: "initialize" }, e); });
const apiMedia = new ApiMedia(browser.scripting);
const pendingMedia = new Map(), downloadUrls = new Map();
const config = fetch(browser.runtime.getURL("config.json")).then(r => r.json());
const now = () => new Date().toISOString();
const serial = new Map();
function enqueue(id, action) {
  const next = (serial.get(id) || Promise.resolve()).catch(() => {}).then(action);
  serial.set(id, next); next.finally(() => { if (serial.get(id) === next) serial.delete(id); }).catch(() => {}); return next;
}
async function state() {
  await ready;
  const settings = await browser.storage.local.get("googleClientId");
  const cfg = await config;
  return { job: job ? { ...job, options: { ...job.options }, failures: undefined } : null, conversation: inspectCache, driveConnected: drive.connected(), driveConfigured: !!(settings.googleClientId || cfg.googleClientId), redirect: browser.identity?.getRedirectURL?.() || "", exportBusy };
}
async function publish() { try { await browser.runtime.sendMessage({ target: "panel", type: "state", state: await state() }); } catch { /* Panel can be closed. */ } }
async function save() { if (job) { await store.put("jobs", job); await publish(); } }
async function collector(type, extra = {}) {
  if (!job) throw new Error("Nenhuma coleta ativa.");
  return browser.tabs.sendMessage(job.tabId, { target: "collector", type, ...extra });
}
async function pause(reason) {
  if (!job) return;
  job.status = "paused"; job.notice = reason; diagnostics.record("collection_paused", jobSummary(job), new Error(reason));
  try { await collector("pause"); } catch { /* Lost tab is already represented by pause. */ }
  await save();
}
async function inspect() {
  const tabs = await browser.tabs.query({ url: "https://web.whatsapp.com/*" });
  const candidates = tabs.sort((a, b) => Number(b.active) - Number(a.active));
  inspectCache = null;
  for (const tab of candidates) {
    try {
      const info = await browser.tabs.sendMessage(tab.id, { target: "collector", type: "inspect" });
      if (info) { inspectCache = { ...info, tabId: tab.id }; break; }
    } catch { /* Reload after installing the extension. */ }
  }
  await publish(); return inspectCache;
}
function assertOptions(options) {
  for (const key of ["start", "end"]) if (options[key] && !/^\d{4}-\d{2}-\d{2}$/.test(options[key])) throw new Error("Intervalo de datas inválido.");
  if (options.start && options.end && options.start > options.end) throw new Error("A data inicial deve ser anterior à final.");
  if (!["zip", "drive"].includes(options.destination)) throw new Error("Destino inválido.");
}
async function start(options) {
  if (exportBusy || (job && ["running", "paused", "stopping"].includes(job.status))) throw new Error("Encerre a coleta atual antes de iniciar outra.");
  assertOptions(options);
  const conversation = await inspect(); if (!conversation) throw new Error("Abra um grupo ou canal no WhatsApp Web e recarregue a página após instalar a extensão.");
  if (options.destination === "drive" && !drive.connected()) throw new Error("Conecte ao Google Drive antes de iniciar.");
  const key = crypto.randomUUID();
  pendingMedia.clear();
  job = { key, tabId: conversation.tabId, conversation, options, startedAt: now(), status: "running", phase: "Coletando histórico", count: 0, mediaCount: 0, mediaFailures: 0, bytes: 0, failures: [], notes: [], oldest: null, newest: null };
  if (options.destination === "drive") {
    try {
      const folder = await drive.folder(`Whatsapp Scoop - ${C.safeName(conversation.title)} - ${job.startedAt.slice(0, 10)}`);
      job.driveFolder = folder.id; job.driveLink = folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
      if (options.media) job.driveMediaFolder = (await drive.folder("midias", folder.id)).id;
    } catch (e) { job.status = "interrupted"; job.finishedAt = now(); job.reason = "falha_preparacao_drive"; job.notice = e.message; await save(); throw e; }
  }
  diagnostics.record("collection_started", jobSummary(job));
  await save();
  try { await collector("start", { job: key, options, startedAt: +new Date(job.startedAt) }); }
  catch (e) { await pause(e.message); throw e; }
}
async function uploadMedia(record) {
  if (record.driveId) return;
  try {
    const response = await drive.upload(record.path.split("/").pop(), record.blob, job.driveMediaFolder, () => {}, record.uploadSession, async url => { record.uploadSession = url; await store.put("media", record); });
    record.driveId = response.id; record.uploadError = null; record.uploadSession = null; await store.put("media", record);
  } catch (e) {
    diagnostics.record("media_upload_failed", { operation: "drive_upload" }, e);
    record.uploadError = e.message; await store.put("media", record);
    if (["running", "paused", "stopping"].includes(job.status)) await pause(e.message);
    else { job.notice = e.message; await save(); }
    throw e;
  }
}
async function resume() {
  if (!job || job.status !== "paused") throw new Error("Nenhuma coleta pausada.");
  if (job.options.destination === "drive") {
    if (!drive.connected()) throw new AuthRequired("Reconecte ao Google Drive.");
    for await (const record of store.records("media", job.key)) if (record.complete && !record.driveId) await uploadMedia(record);
  }
  diagnostics.record("collection_resumed", jobSummary(job));
  await collector("resume"); job.status = "running"; job.notice = ""; await save();
}
async function processBatch(message) {
  if (!job || message.job !== job.key) throw new Error("Coleta inválida.");
  for (const m of message.messages) {
    const sort = m.data_hora || "9999-sem-data";
    const key = `${job.key}:${sort}:${m.id}`;
    if (await store.get("messages", key)) continue;
    await store.put("messages", { key, job: job.key, message: m });
    job.count++;
    if (m.data_hora) { if (!job.oldest || m.data_hora < job.oldest) job.oldest = m.data_hora; if (!job.newest || m.data_hora > job.newest) job.newest = m.data_hora; }
    for (const failure of m._mediaErrors || (m._mediaError ? [{ erro: m._mediaError }] : [])) {
      diagnostics.record("media_capture_failed", { operation: "media" }, new Error(failure.erro)); job.mediaFailures++;
      job.failures.push({ mensagem_id: m.id, etapa: "midia", ...failure });
    }
  }
  diagnostics.record("batch_saved", { batchSize: message.messages.length, messages: job.count, mediaFailures: job.mediaFailures });
  job.unknownDates = message.unknownDates; job.fallbackIds ||= message.fallbackIds;
  await save(); return { ok: true, paused: job.status === "paused" };
}
async function mediaStart(m) {
  if (pendingMedia.size >= 1) throw new Error("Transferência de mídia já em andamento.");
  if (!Number.isSafeInteger(m.size) || m.size < 1) throw new Error("Tamanho de mídia inválido.");
  pendingMedia.set(m.mediaId, { ...m, parts: [], received: 0 }); return { ok: true };
}
async function mediaChunk(m) {
  const p = pendingMedia.get(m.mediaId); if (!p || m.offset !== p.received) throw new Error("Transferência de mídia fora de ordem.");
  const raw = atob(m.data), bytes = Uint8Array.from(raw, c => c.charCodeAt(0));
  if (bytes.length > 256 * 1024 || p.received + bytes.length > p.size) throw new Error("Bloco de mídia inválido.");
  p.parts.push(bytes); p.received += bytes.length; return { ok: true };
}
async function mediaEnd(m) {
  const p = pendingMedia.get(m.mediaId); pendingMedia.delete(m.mediaId);
  if (!p || p.received !== p.size) throw new Error("Transferência de mídia incompleta.");
  const blob = new Blob(p.parts, { type: p.mime }); p.parts = [];
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  const suffix = p.originalName?.match(/\.([a-zA-Z0-9]{1,8})$/)?.[1]?.toLowerCase() || C.mediaExtension(p.mime);
  const mediaKey = `${job.key}:${p.mediaId}`;
  const existing = await store.get("media", mediaKey);
  const mediaId = existing?.id || `MID-${String(job.mediaCount + 1).padStart(6, "0")}`;
  const path = existing?.path || `midias/${mediaId}.${suffix}`;
  const record = { id: mediaId, key: mediaKey, job: job.key, messageId: p.messageId, blob, path, mime: p.mime, size: p.size, sha256, source: p.captureSource, complete: true };
  if (!existing) { await store.put("media", record); job.mediaCount++; job.bytes += p.size; }
  if (job.options.destination === "drive") {
    job.phase = "Enviando mídia ao Drive"; await publish();
    try { await uploadMedia(existing || record); } catch { /* Local blob saved; collector will pause after its batch. */ }
    job.phase = "Coletando histórico";
  }
  await save(); return { ok: true, path, id: mediaId, paused: job.status === "paused" };
}
async function obtainApiMedia(m) {
  const activeJob = job;
  const token = crypto.randomUUID(), mediaId = `${m.messageId}:${m.attachment || 0}`;
  try {
    job.phase = "Recuperando mídia pela API da sessão"; await publish();
    await apiMedia.prepare(activeJob.tabId);
    const meta = await apiMedia.execute(activeJob.tabId, "begin", { token, id: m.messageId, attachment: m.attachment || 0, title: activeJob.conversation.title });
    await mediaStart({ mediaId, messageId: m.messageId, size: meta.size, mime: meta.mime, originalName: meta.name, captureSource: meta.source });
    for (let offset = 0; offset < meta.size;) {
      if (job !== activeJob) throw new Error("A coleta mudou durante o download.");
      const chunk = await apiMedia.execute(activeJob.tabId, "chunk", { token, offset });
      if (!Number.isSafeInteger(chunk.size) || chunk.size < 1 || chunk.size > 256 * 1024 || atob(chunk.data).length !== chunk.size) throw new Error("Bloco inválido retornado pela API de mídia.");
      await mediaChunk({ mediaId, offset, data: chunk.data }); offset += chunk.size;
    }
    const result = await enqueue(activeJob.key, () => mediaEnd({ mediaId }));
    diagnostics.record("api_media_saved", { bytes: meta.size, mime: meta.mime, source: meta.source });
    return result;
  } catch (e) {
    pendingMedia.delete(mediaId); diagnostics.record("api_media_failed", { operation: "session_api" }, e); throw e;
  } finally { try { await apiMedia.execute(activeJob.tabId, "release", { token }); } catch { /* Reload/closed page releases memory. */ } if (job === activeJob && job.status === "running") { job.phase = "Coletando histórico"; await publish(); } }
}
async function exportLocal() {
  if (!job || exportBusy || ["running", "stopping"].includes(job.status)) throw new Error("Pause ou encerre a coleta antes de exportar.");
  if (job.status === "paused") { try { const settled = await collector("settle"); if (!settled?.ok) throw new Error(settled?.error || "Transferência ainda em andamento."); } catch (e) { if (pendingMedia.size || /ainda está sendo preservada|Transferência ainda em andamento/.test(e.message)) throw e; diagnostics.record("collector_unavailable_at_export", {}, e); } }
  diagnostics.record("archive_preparing", jobSummary(job));
  exportBusy = true; job.phase = "Preparando ZIP"; await publish();
  try {
    const blob = await zipBlob(store, job, n => { job.phase = `Preparando ZIP: ${n} mídias`; publish(); }, phase => { job.phase = phase; publish(); });
    const url = URL.createObjectURL(blob);
    let id;
    try { id = await browser.downloads.download({ url, filename: `Whatsapp-Scoop-${C.safeName(job.conversation.title)}-${job.startedAt.slice(0, 10)}.zip`, saveAs: true }); }
    catch (e) { URL.revokeObjectURL(url); throw e; }
    downloadUrls.set(id, { url, kind: "archive" }); diagnostics.record("archive_download_started", { downloadId: id, bytes: blob.size }); job.notice = "ZIP enviado ao gerenciador de downloads do Firefox.";
  } catch (e) { diagnostics.record("export_failed", { operation: job.options.destination }, e); job.notice = "Exportação falhou. Tente novamente ou baixe o log de diagnóstico."; throw e; } finally { exportBusy = false; job.phase = "Coleta preservada"; await save(); }
}
async function finishDrive() {
  if (!job || exportBusy || ["running", "stopping"].includes(job.status)) throw new Error("Encerre a coleta antes de finalizar o Drive.");
  if (!job.driveFolder) throw new Error("Esta coleta não tem uma pasta no Drive.");
  exportBusy = true; job.phase = "Finalizando pasta no Drive"; await publish();
  try {
    for await (const m of store.records("media", job.key)) if (m.complete && !m.driveId) await uploadMedia(m);
    if (!job.driveSystemFolder) { job.driveSystemFolder = (await drive.folder(".system", job.driveFolder)).id; await save(); }
    const files = await reportFiles(store, job);
    const exports = [["mensagens.csv", await csvBlob(store, job), job.driveFolder]];
    if (job.options.workbook) exports.push(["mensagens.xlsx", await xlsxBlob(store, job, phase => { job.phase = phase; publish(); }), job.driveFolder]);
    exports.push([".system/indice_midias.json", files.index, job.driveSystemFolder], [".system/relatorio_coleta.json", files.report, job.driveSystemFolder]);
    for (const [name, blob, folder] of exports) {
      job.finalUploads ||= {};
      const old = job.finalUploads[name];
      if (old?.id) continue;
      const result = await drive.upload(name.split("/").pop(), blob, folder, () => {}, old?.session, async url => { job.finalUploads[name] = { session: url }; await save(); });
      job.finalUploads[name] = { id: result.id }; await save();
    }
    job.notice = `CSV${job.options.workbook ? ", XLSX" : ""}, mídias e arquivos técnicos enviados ao Drive.`;
  } catch (e) { diagnostics.record("export_failed", { operation: job.options.destination }, e); job.notice = "Exportação falhou. Tente novamente ou baixe o log de diagnóstico."; throw e; } finally { exportBusy = false; job.phase = "Coleta preservada"; await save(); }
}
async function finalize(reason) {
  job.finishedAt = now(); job.status = reason === "intervalo" || reason === "limite_observado" ? "finished" : "interrupted"; job.reason = reason;
  job.phase = "Coleta encerrada"; job.notice = reason === "limite_observado" ? "Limite observado da rolagem. Não há garantia de histórico integral." : "Coleta encerrada; consulte o relatório.";
  await save();
  if (job.options.destination === "zip") await exportLocal();
  else { try { await finishDrive(); } catch (e) { job.notice = e.message; await save(); } }
}
browser.browserAction.onClicked.addListener(() => browser.sidebarAction.open());
browser.permissions.onRemoved.addListener(removed => {
  if (removed.origins?.some(origin => googlePermissions.origins.includes(origin)) || removed.data_collection?.length) {
    drive.disconnect();
    if (job?.options.destination === "drive" && job.status === "running") pause("Permissão de envio ao Google Drive removida.");
    else publish();
  }
});
browser.downloads.onChanged.addListener(delta => {
  const tracked = downloadUrls.get(delta.id);
  if (!tracked || !delta.state || !["complete", "interrupted"].includes(delta.state.current)) return;
  URL.revokeObjectURL(tracked.url); downloadUrls.delete(delta.id);
  diagnostics.record("download_" + delta.state.current, { operation: tracked.kind, downloadId: delta.id }, delta.error ? new Error(delta.error.current) : undefined);
  if (delta.state.current === "interrupted" && tracked.kind === "archive" && job) { job.notice = "Download interrompido. Tente Exportar ZIP novamente ou baixe o log de diagnóstico."; save(); }
});
browser.tabs.onRemoved.addListener(id => { apiMedia.forget(id); if (job?.tabId === id && ["running", "paused"].includes(job.status)) { pendingMedia.clear(); pause("A aba foi fechada. Exporte o material preservado e inicie outra coleta."); } });
browser.tabs.onUpdated.addListener((id, change) => { if (change.status === "loading") apiMedia.forget(id); if (job?.tabId === id && change.status === "loading" && ["running", "paused"].includes(job.status)) { pendingMedia.clear(); pause("A página foi recarregada. Exporte a coleta parcial antes de iniciar outra."); } });
browser.runtime.onMessage.addListener(async (m, sender) => {
  if (m.target === "panel") return;
  try {
    if (m.type === "download-log" && sender.url?.startsWith(browser.runtime.getURL(""))) {
      await diagnosticReady;
      const [info, platform] = await Promise.allSettled([browser.runtime.getBrowserInfo(), browser.runtime.getPlatformInfo()]);
      return await downloadDiagnostic({ log: diagnostics, job, environment: { extensionVersion: browser.runtime.getManifest().version, browser: info.status === "fulfilled" ? info.value : null, platform: platform.status === "fulfilled" ? platform.value : null }, downloads: browser.downloads, onStarted: async (id, url) => downloadUrls.set(id, { url, kind: "diagnostic" }) });
    }
    await ready;
    if (storageError) throw storageError;
    if (m.source === "collector") {
      if (!job || sender.tab?.id !== job.tabId || m.job !== job.key) throw new Error("Origem de coleta inválida.");
      if (m.type === "batch") return await enqueue(job.key, () => processBatch(m));
      if (m.type === "api-media") return await obtainApiMedia(m);
      if (m.type === "media-start") return await mediaStart(m);
      if (m.type === "media-chunk") return await mediaChunk(m);
      if (m.type === "media-end") return await enqueue(job.key, () => mediaEnd(m));
      if (m.type === "media-abort") { pendingMedia.delete(m.mediaId); return { ok: true }; }
      if (m.type === "paused") { await pause(m.reason); return { ok: true }; }
      if (m.type === "finished") { await enqueue(job.key, () => finalize(m.reason)); return { ok: true }; }
      if (m.type === "collector-stopped") {
        if (job.status === "stopping") await enqueue(job.key, () => finalize("interrompida_pelo_usuario"));
        return { ok: true };
      }
    }
    if (!sender.url?.startsWith(browser.runtime.getURL(""))) throw new Error("Comando fora da extensão.");
    if (m.type === "state") return { ok: true, state: await state() };
    if (m.type === "inspect") return { ok: true, conversation: await inspect() };
    if (m.type === "start") await start(m.options);
    else if (m.type === "pause") await pause("Pausada pelo usuário.");
    else if (m.type === "resume") await resume();
    else if (m.type === "stop") {
      if (!job || !["running", "paused"].includes(job.status)) throw new Error("Nenhuma coleta para encerrar.");
      job.status = "stopping"; job.phase = "Encerrando transferência em andamento"; await save();
      try { await collector("stop"); }
      catch { await enqueue(job.key, () => finalize("sessao_perdida")); }
    }
    else if (m.type === "export") await exportLocal();
    else if (m.type === "finish-drive") await finishDrive();
    else if (m.type === "connect") {
      await assertGooglePermissions();
      const settings = await browser.storage.local.get("googleClientId"), cfg = await config;
      await drive.connect(settings.googleClientId || cfg.googleClientId); await publish();
    }
    else if (m.type === "disconnect") { drive.disconnect(); if (job?.options.destination === "drive" && job.status === "running") await pause("Google Drive desconectado."); await publish(); }
    else if (m.type === "configure-google") {
      if (m.clientId && !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(m.clientId)) throw new Error("Client ID inválido.");
      await browser.storage.local.set({ googleClientId: m.clientId || "" }); drive.disconnect(); await publish();
    }
    else if (m.type === "clear") {
      if (exportBusy || job && ["running", "stopping", "paused"].includes(job.status)) throw new Error("Encerre a coleta antes de apagar os dados temporários.");
      if (job) await store.deleteJob(job.key); job = null; await publish();
    }
    else if (m.type === "restore") {
      if (job && ["running", "paused", "stopping"].includes(job.status)) throw new Error("Encerre a coleta atual primeiro.");
      const jobs = await store.all("jobs"); job = jobs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null; await publish();
    }
    return { ok: true };
  } catch (e) { diagnostics.record("command_failed", { operation: String(m.type).replace(/[^a-z-]/g, "").slice(0, 40) }, e); return { ok: false, error: e.message }; }
});
await ready;
diagnostics.record("extension_started");
for (const old of storageError ? [] : await store.all("jobs")) {
  if (["running", "paused", "stopping"].includes(old.status)) { old.status = "interrupted"; old.reason = "navegador_reiniciado"; old.finishedAt = now(); old.notice = "Sessão interrompida; é possível exportar os dados preservados."; await store.put("jobs", old); }
}
