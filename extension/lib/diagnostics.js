const STORAGE_KEY = "scoop-diagnostic-history-v1";
const COUNTERS = new Set(["messages", "media", "mediaFailures", "bytes", "batchSize", "unknownDates", "downloadId", "durationMs", "rows"]);
const FLAGS = new Set(["mediaEnabled", "pseudonymize", "dateFilter", "fallbackIds", "scrollFound", "configured", "connected"]);
const LABELS = new Set(["operation", "status", "destination", "conversationType", "source", "mime"]);

export function redact(value, privateValues = []) {
  let text = String(value ?? "");
  for (const secret of privateValues) if (typeof secret === "string" && secret) text = text.split(secret).join("[dado removido]");
  return text
    .replace(/\bBearer\s+[^\s,"']+/gi, "Bearer [removido]")
    .replace(/\b(access_token|refresh_token|client_secret|authorization|password|senha|api[_-]?key)\b\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi, "$1=[removido]")
    .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token removido]")
    .replace(/blob:[^\s)"<>]+/gi, "[blob local]")
    .replace(/https?:\/\/[^\s)"<>]+/gi, url => { try { return new URL(url).origin + "/[caminho removido]"; } catch { return "[URL removida]"; } })
    .replace(/moz-extension:\/\/[a-z0-9-]+\//gi, "moz-extension://[extensao]/")
    .replace(/file:\/\/[^\s)"<>]+/gi, "[arquivo local]")
    .replace(/(?:\/(?:Users|home|private\/var\/folders)\/|[a-z]:\\(?:Users|Documents and Settings)\\)[^\s)"<>]+/gi, "[caminho local]")
    .replace(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[email removido]")
    .replace(/(?:\+\d[\d ().-]{7,}\d|\b\d{8,}\b)/g, "[numero removido]");
}
export function errorInfo(error, privateValues = []) {
  try {
    return { name: redact(error?.name || "Error", privateValues).slice(0, 80), message: redact(error?.message || String(error), privateValues).slice(0, 1200), stack: redact(error?.stack || "", privateValues).split("\n").slice(0, 12).join("\n").slice(0, 2400) };
  } catch { return { name: "Error", message: "Erro sem detalhes disponíveis", stack: "" }; }
}
function safeData(data, privateValues) {
  const result = {};
  for (const [key, value] of Object.entries(data || {})) {
    if (COUNTERS.has(key) && Number.isFinite(value)) result[key] = Math.max(0, value);
    else if (FLAGS.has(key) && typeof value === "boolean") result[key] = value;
    else if (LABELS.has(key) && typeof value === "string") result[key] = redact(value, privateValues).slice(0, 100);
  }
  return result;
}
export function jobSummary(job) {
  if (!job) return null;
  return { status: job.status, destination: job.options?.destination, conversationType: job.conversation?.type, messages: job.count || 0, media: job.mediaCount || 0, mediaFailures: job.mediaFailures || 0, bytes: job.bytes || 0, mediaEnabled: !!job.options?.media, pseudonymize: !!job.options?.pseudonymize, dateFilter: !!(job.options?.start || job.options?.end), fallbackIds: !!job.fallbackIds };
}
export class DiagnosticLog {
  constructor({ storage, privateValues = () => [], clock = () => new Date().toISOString(), limit = 500 } = {}) {
    this.storage = storage; this.privateValues = privateValues; this.clock = clock; this.limit = limit;
    this.entries = []; this.dropped = 0; this.persistent = !!storage; this.timer = null; this.writing = Promise.resolve();
  }
  async load() {
    if (!this.storage) return;
    try {
      const saved = (await this.storage.get(STORAGE_KEY))[STORAGE_KEY];
      const old = Array.isArray(saved?.entries) ? saved.entries.filter(e => typeof e?.at === "string" && typeof e?.event === "string").map(e => ({ at: e.at.slice(0, 40), event: e.event.slice(0, 80), data: safeData(e.data, this.privateValues()), ...(e.error ? { error: errorInfo(e.error, this.privateValues()) } : {}) })) : [];
      this.entries = [...old, ...this.entries].slice(-this.limit); this.dropped += saved?.dropped || 0;
    } catch { this.persistent = false; }
  }
  record(event, data = {}, error) {
    const values = this.privateValues();
    this.entries.push({ at: this.clock(), event: String(event).replace(/[^a-z0-9_-]/gi, "").slice(0, 80), data: safeData(data, values), ...(error ? { error: errorInfo(error, values) } : {}) });
    if (this.entries.length > this.limit) { this.dropped += this.entries.length - this.limit; this.entries.splice(0, this.entries.length - this.limit); }
    if (this.storage && !this.timer) this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 1000);
  }
  async flush() {
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    if (!this.storage) return;
    const snapshot = structuredClone({ entries: this.entries, dropped: this.dropped });
    this.writing = this.writing.catch(() => {}).then(() => this.storage.set({ [STORAGE_KEY]: snapshot })).then(() => { this.persistent = true; }).catch(() => { this.persistent = false; });
    await this.writing;
  }
  document(job, environment) {
    return { schema: "whatsapp-scoop-diagnostic-v1", generatedAt: this.clock(), environment, collection: jobSummary(job), historyPersisted: this.persistent, droppedEvents: this.dropped, privacy: "Sem textos, legendas, nomes, números de participantes, arquivos de mídia, credenciais ou identificadores de conversas. O arquivo é local e só é compartilhado se você o enviar.", events: structuredClone(this.entries) };
  }
}
export async function downloadDiagnostic({ log, job, environment, downloads, urls = URL, onStarted = async () => {} }) {
  log.record("diagnostic_requested"); await log.flush();
  const filename = `Whatsapp-Scoop-diagnostico-${log.clock().replace(/[:.]/g, "-")}.json`;
  const serialize = () => JSON.stringify(log.document(job, environment), null, 2);
  let text = serialize(), url;
  try {
    url = urls.createObjectURL(new Blob([text], { type: "application/json;charset=utf-8" }));
    const id = await downloads.download({ url, filename, saveAs: true });
    await onStarted(id, url);
    log.record("diagnostic_download_started", { downloadId: id });
    return { ok: true, downloaded: true, text, filename };
  } catch (e) {
    if (url) urls.revokeObjectURL(url);
    log.record("diagnostic_download_failed", {}, e); await log.flush(); text = serialize();
    return { ok: true, downloaded: false, text, filename, error: errorInfo(e, log.privateValues()).message };
  }
}
