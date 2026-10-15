// Only this fixed function runs in the page world. Never accepts executable code.
export async function pageMediaAction(action, args) {
  const fail = (code, message) => ({ ok: false, code, error: message });
  try {
    const cache = globalThis.__WhatsappScoopMedia ||= new Map();
    if (action === "release") { cache.delete(args.token); if (globalThis.__WhatsappScoopCurrentToken === args.token) globalThis.__WhatsappScoopCurrentToken = null; return { ok: true }; }
    if (action === "chunk") {
      const record = cache.get(args.token);
      if (!record) return fail("expired", "Transferência de mídia expirou.");
      if (!Number.isSafeInteger(args.offset) || args.offset < 0 || args.offset >= record.blob.size) return fail("offset", "Posição da mídia inválida.");
      const bytes = new Uint8Array(await record.blob.slice(args.offset, args.offset + 256 * 1024).arrayBuffer());
      let raw = ""; for (let i = 0; i < bytes.length; i += 8192) raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return { ok: true, data: btoa(raw), size: bytes.length };
    }
    if (!["begin", "links", "monitor"].includes(action)) return fail("action", "Operação de mídia inválida.");
    if (args.attachment > 0) return fail("album", "Anexo adicional requer controle próprio da mensagem.");
    const W = globalThis.WPP;
    const deadline = Date.now() + 15000;
    while (!W?.isReady && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 150));
    if (!W?.isReady) return fail("not_ready", "API da sessão WhatsApp ainda não está pronta.");
    const chat = W.chat.getActiveChat();
    if (!chat) return fail("chat", "API não reconheceu a conversa aberta.");
    const title = chat.name || chat.formattedTitle || chat.contact?.name || "";
    const normalize = s => String(s).normalize("NFKC").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
    if (!title || normalize(title) !== normalize(args.title)) return fail("chat_changed", "API e painel apontam para conversas diferentes. Atualize a conversa.");
    if (args.chatId && (chat.id?._serialized || chat.id?.toString?.()) !== args.chatId) return fail("chat_changed", "O identificador da conversa mudou.");
    const models = chat.msgs?.getModelsArray?.() || chat.msgs?.models || [];
    if (action === "monitor") {
      const chatId = chat.id?._serialized || chat.id?.toString?.();
      if (!chatId || !/@newsletter$/.test(chatId)) return fail("channel", "Monitoramento requer um canal reconhecido pela API.");
      if (args.chatId && args.chatId !== chatId) return fail("chat_changed", "O identificador do canal mudou.");
      const valid = models.filter(m => (m.id?._serialized || m.id?.id) && Number.isSafeInteger(Number(m.serverId)) && Number(m.serverId) > 0);
      if (models.length && !valid.length) return fail("server_id", "Este canal não disponibilizou identificadores para monitoramento seguro.");
      const latest = valid.reduce((max, m) => Math.max(max, Number(m.serverId)), 0);
      if (args.baseline === undefined) return { ok: true, baseline: latest, chatId, messages: [], cursor: latest };
      const newer = valid.filter(m => Number(m.serverId) > args.after).sort((a, b) => Number(a.serverId) - Number(b.serverId)).slice(0, 100);
      const recent = valid.filter(m => Number(m.serverId) > args.baseline && Number(m.serverId) <= args.after).sort((a, b) => Number(b.serverId) - Number(a.serverId)).slice(0, 50);
      const selected = [...newer, ...recent];
      const ids = selected.map(m => m.id?._serialized || m.id?.id || m.id?.toString?.()).filter(Boolean);
      const details = { links: {}, messages: {} };
      for (let offset = 0; offset < ids.length; offset += 100) {
        const part = await pageMediaAction("links", { ...args, ids: ids.slice(offset, offset + 100) });
        if (!part.ok) return part;
        Object.assign(details.links, part.links); Object.assign(details.messages, part.messages);
      }
      return { ok: true, chatId, baseline: args.baseline, cursor: newer.reduce((max, m) => Math.max(max, Number(m.serverId)), args.after), more: newer.length === 100, messages: selected.map((m, i) => ({ id: ids[i], serverId: Number(m.serverId), ...(details.messages[ids[i]] || {}), tipo: details.messages[ids[i]]?.tipo || "evento", _hasMedia: !!m.mediaData || ["image", "video", "audio", "ptt", "document", "sticker"].includes(m.type), link_mensagem: details.links[ids[i]] || "", _nativeConfirmed: true, _nativeType: details.messages[ids[i]]?.tipo || "", resposta_a: m.quotedStanzaID || "", encaminhada: !!m.isForwarded })).filter(m => m.id) };
    }
    if (action === "links") {
      const metadata = chat.newsletterMetadata || W.whatsapp?.NewsletterStore?.get?.(chat.id)?.newsletterMetadata;
      const code = metadata?.inviteCode || metadata?.newsletterInviteLinkMetadataMixin?.inviteCode || args.channelCode;
      const links = {}, messages = {};
      for (const id of (args.ids || []).slice(0, 100)) {
        const matched = models.filter(m => m.id?.toString?.() === id || m.id?._serialized === id || m.id?.id === id);
        if (matched.length !== 1) continue;
        const msg = matched[0], serverId = msg.serverId;
        const type = ({ chat: "texto", image: "imagem", video: "video", audio: "audio", ptt: "audio", document: "documento", sticker: "figurinha" })[msg.type] || "";
        const seconds = Number(msg.t);
        const date = Number.isFinite(seconds) && seconds > 0 && seconds < 253402300800 ? new Date(seconds * 1000).toISOString() : "";
        messages[id] = { data_original: date ? String(msg.t) : "", tipo: type, texto: type === "texto" && typeof msg.body === "string" ? msg.body : "", legenda: type && type !== "texto" && typeof msg.caption === "string" ? msg.caption : "", data_hora: date };

        if (/^[A-Za-z0-9]{10,64}$/.test(code || "") && /^[1-9]\d*$/.test(String(serverId ?? "")) && Number.isSafeInteger(Number(serverId))) links[id] = `https://whatsapp.com/channel/${code}/${serverId}`;
      }
      return { ok: true, links, messages };
    }
    const matches = models.filter(m => m.id?.toString?.() === args.id || m.id?._serialized === args.id || m.id?.id === args.id);
    if (matches.length !== 1) return fail("message", "API não encontrou um identificador único para esta mensagem no histórico carregado.");
    const msg = matches[0];
    globalThis.__WhatsappScoopCurrentToken = args.token;
    if (!msg.mediaData) return fail("no_media", "Mensagem sem arquivo de mídia na API.");
    let blob;
    try { blob = await W.chat.downloadMedia(msg.id.toString()); }
    catch {
      // Channel collections may expose a message that is absent from MsgStore.
      // Use the same native download/cache methods used by the pinned WA-JS.
      const md = msg.mediaData;
      const cached = async () => {
        const direct = md.mediaBlob?.forceToBlob?.(); if (direct?.size) return direct;
        const memory = md.filehash ? W.whatsapp.MediaBlobCache?.get?.(md.filehash) : null; if (memory?.size) return memory;
        let value = null;
        if (md.filehash && typeof W.whatsapp.LruMediaStore?.get === "function") { try { value = await W.whatsapp.LruMediaStore.get(md.filehash); } catch { /* Cache miss. */ } }
        if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return new Blob([value], { type: md.mimetype || "application/octet-stream" });
        return null;
      };
      blob = await cached();
      if (!blob && typeof msg.downloadMedia === "function") {
        await msg.downloadMedia({ downloadEvenIfExpensive: true, rmrReason: 1, isUserInitiated: true });
        blob = await cached();
      }
    }
    if (!blob?.size || typeof blob.slice !== "function") return fail("empty", "API não disponibilizou os bytes originais da mídia.");
    if (globalThis.__WhatsappScoopCurrentToken !== args.token) return fail("cancelled", "Transferência de mídia cancelada.");
    // One transfer at a time; never retain corpus-sized page caches.
    cache.clear(); cache.set(args.token, { blob });
    return { ok: true, size: blob.size, mime: blob.type || msg.mediaData.mimetype || "application/octet-stream", name: msg.filename || "", source: "api_wa_js" };
  } catch (e) { return fail("download", "Falha ao recuperar mídia pela API da sessão: " + (e?.code || e?.name || "erro")); }
}
export class ApiMedia {
  constructor(scripting) { this.scripting = scripting; this.prepared = new Map(); }
  async execute(tabId, action, args) {
    let timer;
    const execution = this.scripting.executeScript({ target: { tabId }, world: "MAIN", func: pageMediaAction, args: [action, args] });
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("A API de mídia demorou além do limite. Coleta local preservada.")), 60000); });
    let results;
    try { results = await Promise.race([execution, timeout]); } finally { clearTimeout(timer); }
    const response = results.find(r => r.frameId === 0)?.result;
    if (!response?.ok) throw new Error(response?.error || "API de mídia não respondeu.");
    return response;
  }
  async prepare(tabId) {
    if (!this.prepared.has(tabId)) {
      const existing = await this.scripting.executeScript({ target: { tabId }, world: "MAIN", func: () => !!globalThis.WPP?.isReady && typeof globalThis.WPP?.chat?.downloadMedia === "function" });
      if (existing.find(r => r.frameId === 0)?.result) return;
      const loading = this.scripting.executeScript({ target: { tabId }, world: "MAIN", files: ["vendor/wppconnect-wa.js"] });
      this.prepared.set(tabId, loading);
      try { await loading; } catch (e) { this.prepared.delete(tabId); throw e; }
    }
    await this.prepared.get(tabId);
  }
  forget(tabId) { this.prepared.delete(tabId); }
}
