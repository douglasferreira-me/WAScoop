import { errorInfo } from "./lib/diagnostics.js";
import { t, statusText, locale, setLanguage, translateDocument } from "./lib/i18n.js";
const applyLanguage = translateDocument(document);
let lastError = "", diagnosticNotice = "";
const $ = id => document.getElementById(id);
let current = null;
const labels = { running: "em andamento", paused: "pausada", stopping: "encerrando", finished: "encerrada", interrupted: "parcial" };
function error(text) { lastError = text || ""; $("error").textContent = statusText(lastError); $("error").hidden = !text; }
async function command(type, extra = {}) {
  error("");
  const result = await browser.runtime.sendMessage({ type, ...extra });
  if (!result?.ok) throw new Error(result?.error || "Não foi possível comunicar com a extensão.");
  return result;
}
function bytes(size) { if (!size) return "0 B"; const i = Math.min(3, Math.floor(Math.log(size) / Math.log(1024))); return `${(size / 1024 ** i).toLocaleString(locale(), { maximumFractionDigits: 1 })} ${["B", "KB", "MB", "GB"][i]}`; }
function render(state) {
  current = state;
  const j = state.job, active = j && ["running", "paused", "stopping"].includes(j.status);
  if (active) {
    $("mode").value = j.options.mode || "history"; $("destination").value = j.options.destination;
    $("media").checked = !!j.options.media; $("workbook").checked = !!j.options.workbook;
    $("pseudonymize").checked = !!j.options.pseudonymize;
    $("local-limit").value = j.options.localLimitMB || 512; $("release-media").checked = !!j.options.releaseUploadedMedia;
    modeControls();
  }
  $("drive-box").hidden = $("destination").value !== "drive" && !j?.driveFolder;
  $("conversation").textContent = (active ? j?.conversation.title : state.conversation?.title) || j?.conversation.title || t("Abra um grupo ou canal no WhatsApp Web.");
  $("collection-settings").disabled = !!active || state.exportBusy;
  $("start-button").disabled = !!active || state.exportBusy;
  $("progress-section").hidden = !j;
  $("connect").textContent = t(state.driveConnected ? "Reconectar ao Google Drive" : "Conectar ao Google Drive");
  $("disconnect").hidden = !state.driveConnected;
  $("drive-status").textContent = t(state.driveConnected ? "Conta conectada nesta sessão." : state.driveConfigured ? "Aplicativo configurado. Conecte uma conta autorizada para teste." : "Este pacote não tem aplicativo Google configurado. Use ZIP local ou configure um ID próprio nas opções avançadas.");
  $("redirect").textContent = state.redirect;
  $("google-source").textContent = t(state.googleClientSource === "custom" ? "Usando um Client ID próprio salvo neste navegador." : state.googleClientSource === "bundled" ? "Usando o Client ID padrão incluído na extensão." : "Nenhum aplicativo Google configurado.");
  if (document.activeElement !== $("client-id")) $("client-id").value = state.googleClientOverride || "";
  $("reset-google").disabled = !state.googleClientOverride;
  if (!j) return;
  $("progress-title").textContent = t("Sua coleta · {title}", { title: j.conversation.title });
  $("status").textContent = t((j.status === "finished" && j.incompleteCount ? "encerrada com pendências" : labels[j.status]) || j.status);
  $("phase").textContent = statusText(j.phase);
  $("messages-count").textContent = j.count.toLocaleString(locale());
  $("media-count").textContent = j.mediaCount.toLocaleString(locale());
  $("bytes-count").textContent = bytes(j.bytes);
  const fmt = value => value ? new Date(value).toLocaleString(locale()) : t("data desconhecida");
  $("period").textContent = j.oldest ? t("Período alcançado: {start} — {end}", { start: fmt(j.oldest), end: fmt(j.newest) }) : t("O período aparecerá quando houver datas reconhecidas.");
  $("failures").textContent = t("{n} mensagem(ns) com campos pendentes · {m} falha(s) de mídia", { n: j.incompleteCount || 0, m: j.mediaFailures }) + (j.unknownDates ? t(" · {n} mensagem(ns) sem data excluída(s) pelo filtro", { n: j.unknownDates }) : "");
  $("sync-status").textContent = j.options.mode === "monitor" ? t("Última verificação: {check} · {pending} mídia(s) pendente(s) · {bytes} locais. {upload}Última sincronização: {sync}.{notice}", { check: j.lastCheck ? fmt(j.lastCheck) : t("aguardando"), pending: j.pendingUploads || 0, bytes: bytes(j.localBytes || 0), upload: j.uploading ? t("Enviando ao Drive.") + " " : "", sync: j.lastSync ? fmt(j.lastSync) : t("aguardando"), notice: j.uploadNotice ? " " + statusText(j.uploadNotice) : "" }) : "";
  $("notice").textContent = statusText(j.notice || "O total de mensagens não é conhecido antes da coleta.") + (j.status === "paused" ? " " + t("Use Continuar na conversa original ou Encerrar e exportar para liberar uma nova coleta.") : "");
  $("pause").hidden = j.status !== "running"; $("resume").hidden = j.status !== "paused";
  $("stop").disabled = !["running", "paused"].includes(j.status) || state.exportBusy;
  $("export").disabled = ["running", "stopping"].includes(j.status) || state.exportBusy;
  $("finish-drive").hidden = !j.driveFolder; $("finish-drive").disabled = (j.options.mode !== "monitor" && !!active) || j.status === "stopping" || state.exportBusy; $("finish-drive").textContent = t(j.options.mode === "monitor" ? "Sincronizar agora" : "Finalizar envio ao Drive");
  $("progress").hidden = !["running", "stopping"].includes(j.status) && !state.exportBusy;
  $("drive-link").hidden = !j.driveLink;
  if (j.driveLink) $("drive-link").href = j.driveLink;
}
function diagnostic(text) { diagnosticNotice = text; $("diagnostic-status").textContent = statusText(text); }
function bind(id, action) {
  $(id).addEventListener("click", async () => { $(id).disabled = true; try { await action(); const r = await command("state"); render(r.state); } catch (e) { error(e.message); } finally { $(id).disabled = false; if (current) render(current); } });
}
function modeControls() {
  const monitor = $("mode").value === "monitor";
  $("monitor-help").hidden = !monitor; $("monitor-options").hidden = !monitor; $("history-dates").hidden = monitor;
  if (monitor) $("media").checked = true;
  $("media").disabled = monitor;
  $("release-media").disabled = !monitor || $("destination").value !== "drive";
}
$("mode").addEventListener("change", () => { if ($("mode").value === "monitor") $("destination").value = "drive"; $("drive-box").hidden = $("destination").value !== "drive"; modeControls(); });
bind("copy-redirect", () => navigator.clipboard.writeText($("redirect").textContent));
$("destination").addEventListener("change", () => { $("drive-box").hidden = $("destination").value !== "drive"; modeControls(); });
$("settings").addEventListener("submit", async e => {
  e.preventDefault(); $("start-button").disabled = true;
  try { await command("start", { options: { mode: $("mode").value, localLimitMB: Number($("local-limit").value), releaseUploadedMedia: $("release-media").checked && $("destination").value === "drive", start: $("start").value, end: $("end").value, media: $("media").checked, workbook: $("workbook").checked, pseudonymize: $("pseudonymize").checked, destination: $("destination").value } }); }
  catch (e) { error(e.message); }
  finally { try { const result = await command("state"); render(result.state); } catch (e) { $("start-button").disabled = false; error(e.message + " Baixe o log de diagnóstico."); } }
});
for (const id of ["inspect", "pause", "resume", "stop", "export", "finish-drive", "disconnect", "restore"]) bind(id, () => command(id));
bind("clear", async () => { if (confirm(t("Apagar os dados temporários da coleta atual? Os arquivos já exportados serão preservados."))) await command("clear"); });
bind("save-google", () => command("configure-google", { clientId: $("client-id").value.trim() }));
bind("reset-google", async () => { await command("configure-google", { clientId: "" }); $("client-id").value = ""; });
bind("connect", async () => {
  if (!current?.driveConfigured) throw new Error("Este pacote não tem aplicativo Google configurado. Use ZIP local ou configure um ID próprio nas opções avançadas.");
  const granted = await browser.permissions.request({ origins: ["https://accounts.google.com/*", "https://www.googleapis.com/*", "https://oauth2.googleapis.com/*"], data_collection: ["personalCommunications", "personallyIdentifyingInfo", "websiteContent", "authenticationInfo"] });
  if (!granted) throw new Error("Permissão Google não autorizada.");
  await command("connect");
});
$("download-log").addEventListener("click", async () => {
  $("download-log").disabled = true;
  try {
    const result = await browser.runtime.sendMessage({ type: "download-log" });
    if (!result?.ok || !result.text) throw new Error(result?.error || "O serviço de diagnóstico não respondeu.");
    $("log-text").value = result.text; $("log-fallback").hidden = false;
    $("log-fallback").open = !result.downloaded;
    diagnostic(result.downloaded ? "Log enviado ao gerenciador de downloads. Você também pode copiar o texto abaixo." : "O download do log falhou. Use Ver ou copiar o log para enviá-lo.");
  } catch (e) {
    // This fallback also works if background initialization itself fails.
    $("log-text").value = JSON.stringify({ schema: "whatsapp-scoop-panel-fallback-v1", generatedAt: new Date().toISOString(), version: browser.runtime.getManifest().version, error: errorInfo(e), notice: "O painel não conseguiu obter o log do serviço de fundo. Sem dados da conversa." }, null, 2);
    $("log-fallback").hidden = false; $("log-fallback").open = true;
    diagnostic("Não foi possível baixar o log. Copie o diagnóstico do painel abaixo.");
  } finally { $("download-log").disabled = false; }
});
$("copy-log").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText($("log-text").value); diagnostic("Log copiado. Cole-o ao pedir ajuda."); }
  catch { $("log-text").focus(); $("log-text").select(); diagnostic("Texto selecionado. Use Ctrl+C ou ⌘C para copiar."); }
});
browser.runtime.onMessage.addListener(m => { if (m.target === "panel" && m.type === "state") render(m.state); });
function languageChanged(value) {
  setLanguage(value); $("language").value = value === "en" ? "en" : "pt-BR";
  applyLanguage(); if (current) render(current); error(lastError); diagnostic(diagnosticNotice);
}
$("language").addEventListener("change", async () => {
  languageChanged($("language").value);
  try { await browser.storage.local.set({ uiLanguage: $("language").value }); } catch (e) { error(e.message); }
});
browser.storage.onChanged.addListener((changes, area) => { if (area === "local" && changes.uiLanguage) languageChanged(changes.uiLanguage.newValue); });
(async () => { try { languageChanged((await browser.storage.local.get("uiLanguage")).uiLanguage); render((await command("state")).state); await command("inspect"); } catch (e) { error(e.message); } })();
