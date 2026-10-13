/* Shared pure functions; deliberately usable in Firefox and Node tests. */
(function (root) {
  "use strict";
  const columns = ["id", "conversa", "tipo_conversa", "data_hora", "data_original", "remetente", "numero", "texto", "legenda", "tipo", "resposta_a", "encaminhada", "midias", "status_midia"];
  function safeName(value) {
    return String(value || "conversa").normalize("NFKC").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/g, "").slice(0, 100) || "conversa";
  }
  function hashText(s) {
    let h = 2166136261;
    for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function parseDate(raw, locale = "pt-BR") {
    if (!raw) return "";
    const iso = String(raw).match(/^\d{4}-\d{2}-\d{2}T/);
    if (iso) { const d = new Date(raw); return Number.isNaN(+d) ? "" : d.toISOString(); }
    const dates = String(raw).match(/(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    const time = String(raw).match(/(\d{1,2}):(\d{2})(?:\s*(AM|PM))?/i);
    if (!dates) return "";
    let a = +dates[1], b = +dates[2], year = +dates[3];
    if (year < 100) year += 2000;
    const us = /^en-US$/i.test(locale);
    const day = us ? b : a, month = us ? a : b;
    let hour = time ? +time[1] : 0, minute = time ? +time[2] : 0;
    if (time?.[3]) { hour %= 12; if (time[3].toUpperCase() === "PM") hour += 12; }
    const d = new Date(year, month - 1, day, hour, minute);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day || hour > 23 || minute > 59) return "";
    return d.toISOString();
  }
  function inRange(date, start, end) {
    if (!date) return !start && !end;
    const t = +new Date(date);
    const lo = start ? +new Date(`${start}T00:00:00`) : -Infinity;
    const hi = end ? +new Date(`${end}T23:59:59.999`) : Infinity;
    return t >= lo && t <= hi;
  }
  function fingerprint(m) {
    return JSON.stringify([m.data_original, m.data_hora, m.remetente, m.numero, m.texto, m.legenda, m.tipo, m.resposta_a]);
  }
  // Merge an older viewport with the previously observed chronology. An overlap
  // anchors identical messages by their positions, rather than by content alone.
  class Timeline {
    constructor() { this.sequence = []; this.counter = 0; }
    observe(batch) {
      const keys = batch.map(m => m.id ? `wa:${m.id}` : `fp:${fingerprint(m)}`);
      const oldKeys = this.sequence.map(x => x.key);
      let overlap = 0, offset = 0;
      outer: for (let n = Math.min(keys.length, oldKeys.length); n > 0; n--) {
        for (let i = 0; i <= keys.length - n; i++) {
          if (keys.slice(i, i + n).every((k, j) => k === oldKeys[j])) { overlap = n; offset = i; break outer; }
        }
      }
      const stable = new Map(this.sequence.filter(x => x.key.startsWith("wa:")).map(x => [x.key, x.id]));
      const hadHistory = this.sequence.length > 0;
      const resolved = batch.map((m, i) => {
        const id = m.id || (overlap && i >= offset && i < offset + overlap ? this.sequence[i - offset].id : `local-${++this.counter}`);
        const afterBoundary = hadHistory && overlap > 0 && i >= offset + overlap && !stable.has(keys[i]);
        return { ...m, id: stable.get(keys[i]) || id, _key: keys[i], _fallback: !m.id, _afterBoundary: afterBoundary };
      });
      if (!this.sequence.length) this.sequence = resolved.map(m => ({ key: m._key, id: m.id }));
      else if (overlap) this.sequence.unshift(...resolved.slice(0, offset).map(m => ({ key: m._key, id: m.id })));
      else this.sequence.unshift(...resolved.filter(m => !stable.has(m._key)).map(m => ({ key: m._key, id: m.id })));
      return resolved;
    }
  }
  function csvCell(value) {
    const s = String(value ?? "");
    // Spreadsheet-safe export. Apostrophe is documented and reversible.
    const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    return '"' + safe.replace(/"/g, '""') + '"';
  }
  function csvLine(m) { return columns.map(c => csvCell(Array.isArray(m[c]) ? m[c].join(" | ") : m[c])).join(",") + "\r\n"; }
  function csvHeader() { return "\uFEFF" + columns.map(csvCell).join(",") + "\r\n"; }
  function pseudonymize(m, lookup) {
    const identity = m.numero || m.remetente;
    if (!identity) return { ...m };
    if (!lookup.has(identity)) lookup.set(identity, `participante_${String(lookup.size + 1).padStart(4, "0")}`);
    return { ...m, remetente: lookup.get(identity), numero: "" };
  }
  function mediaExtension(mime) {
    return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "application/pdf": "pdf" })[mime?.split(";")[0]] || "bin";
  }
  const api = { columns, safeName, hashText, parseDate, inRange, fingerprint, Timeline, csvCell, csvLine, csvHeader, pseudonymize, mediaExtension };
  root.ScoopCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
