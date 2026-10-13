"use strict";
const $ = id => document.getElementById(id);
let current = null;
const labels = { running: "em andamento", paused: "pausada", stopping: "encerrando", finished: "encerrada", interrupted: "parcial" };
function error(text) { $("error").textContent = text || ""; $("error").hidden = !text; }
async function command(type, extra = {}) {
  error("");
  const result = await browser.runtime.sendMessage({ type, ...extra });
  if (!result?.ok) throw new Error(result?.error || "Não foi possível comunicar com a extensão.");
  return result;
}
function bytes(size) { if (!size) return "0 B"; const i = Math.min(3, Math.floor(Math.log(size) / Math.log(1024))); return `${(size / 1024 ** i).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${["B", "KB", "MB", "GB"][i]}`; }
function render(state) {
  current = state;
  const j = state.job, active = j && ["running", "paused", "stopping"].includes(j.status);
  $("conversation").textContent = (active ? j?.conversation.title : state.conversation?.title) || j?.conversation.title || "Abra um grupo ou canal no WhatsApp Web.";
  $("collection-settings").disabled = !!active || state.exportBusy;
  $("start-button").disabled = !!active || state.exportBusy;
  $("progress-section").hidden = !j;
  $("connect").textContent = state.driveConnected ? "Reconectar ao Google Drive" : "Conectar ao Google Drive";
  $("disconnect").hidden = !state.driveConnected;
  $("drive-status").textContent = state.driveConnected ? "Conta conectada durante esta sessão." : state.driveConfigured ? "Conecte sua conta para enviar arquivos." : "Login ainda não configurado pelo mantenedor. ZIP local está disponível.";
  $("redirect").textContent = state.redirect;
  if (!j) return;
  $("progress-title").textContent = `Sua coleta · ${j.conversation.title}`;
  $("status").textContent = labels[j.status] || j.status;
  $("phase").textContent = j.phase;
  $("messages-count").textContent = j.count.toLocaleString("pt-BR");
  $("media-count").textContent = j.mediaCount.toLocaleString("pt-BR");
  $("bytes-count").textContent = bytes(j.bytes);
  const fmt = value => value ? new Date(value).toLocaleString("pt-BR") : "data desconhecida";
  $("period").textContent = j.oldest ? `Período alcançado: ${fmt(j.oldest)} — ${fmt(j.newest)}` : "O período aparecerá quando houver datas reconhecidas.";
  $("failures").textContent = `${j.mediaFailures} falha(s) de mídia${j.unknownDates ? ` · ${j.unknownDates} mensagem(ns) sem data excluída(s) pelo filtro` : ""}`;
  $("notice").textContent = j.notice || "O total de mensagens não é conhecido antes da coleta.";
  $("pause").hidden = j.status !== "running"; $("resume").hidden = j.status !== "paused";
  $("stop").disabled = !["running", "paused"].includes(j.status) || state.exportBusy;
  $("export").disabled = ["running", "stopping"].includes(j.status) || state.exportBusy;
  $("finish-drive").hidden = !j.driveFolder; $("finish-drive").disabled = !!active || state.exportBusy;
  $("progress").hidden = !["running", "stopping"].includes(j.status) && !state.exportBusy;
  $("drive-link").hidden = !j.driveLink;
  if (j.driveLink) $("drive-link").href = j.driveLink;
}
function bind(id, action) {
  $(id).addEventListener("click", async () => { $(id).disabled = true; try { await action(); const r = await command("state"); render(r.state); } catch (e) { error(e.message); } finally { $(id).disabled = false; if (current) render(current); } });
}
$("destination").addEventListener("change", () => { $("drive-box").hidden = $("destination").value !== "drive"; });
$("settings").addEventListener("submit", async e => {
  e.preventDefault(); $("start-button").disabled = true;
  try { await command("start", { options: { start: $("start").value, end: $("end").value, media: $("media").checked, pseudonymize: $("pseudonymize").checked, destination: $("destination").value } }); }
  catch (e) { error(e.message); }
  finally { const result = await command("state"); render(result.state); }
});
for (const id of ["inspect", "pause", "resume", "stop", "export", "finish-drive", "disconnect", "restore"]) bind(id, () => command(id));
bind("clear", async () => { if (confirm("Apagar os dados temporários da coleta atual? Os arquivos já exportados serão preservados.")) await command("clear"); });
bind("save-google", () => command("configure-google", { clientId: $("client-id").value.trim() }));
bind("connect", async () => {
  if (!current?.driveConfigured) throw new Error("O mantenedor precisa cadastrar o aplicativo Google antes de oferecer este login. Use ZIP local por enquanto.");
  const granted = await browser.permissions.request({ origins: ["https://accounts.google.com/*", "https://www.googleapis.com/*", "https://oauth2.googleapis.com/*"], data_collection: ["personalCommunications", "personallyIdentifyingInfo", "websiteContent", "authenticationInfo"] });
  if (!granted) throw new Error("Permissão Google não autorizada.");
  await command("connect");
});
browser.runtime.onMessage.addListener(m => { if (m.target === "panel" && m.type === "state") render(m.state); });
(async () => { try { render((await command("state")).state); await command("inspect"); } catch (e) { error(e.message); } })();
