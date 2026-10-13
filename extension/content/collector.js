(function () {
  "use strict";
  const C = ScoopCore, A = ScoopAdapters;
  let session = null;
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  const send = data => browser.runtime.sendMessage({ ...data, source: "collector" });
  function toBase64(blob) {
    return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(",")[1]); reader.onerror = () => reject(reader.error); reader.readAsDataURL(blob); });
  }
  async function getBlob(url) {
    if (!url?.startsWith("blob:https://web.whatsapp.com/")) throw new Error("Arquivo original não exposto como mídia local pelo WhatsApp.");
    const r = await fetch(url); if (!r.ok) throw new Error("Mídia indisponível."); return r.blob();
  }
  // Firefox-specific, short-lived interception of the viewer's own download.
  // This observes only a Blob created by the download action, not private stores.
  async function downloadOriginal(row, type, targetIndex = 0) {
    const targets = A.mediaTargets(row);
    const target = targets[targetIndex];
    const scope = target?.matches("audio,video") ? target : target?.querySelector("audio,video");
    const playable = scope || (targets.length <= 1 ? row.querySelector("audio,video") : null);
    if ((playable?.currentSrc || playable?.src)?.startsWith("blob:")) return { blob: await getBlob(playable.currentSrc || playable.src), name: "", source: "blob_reproducao" };
    if (typeof exportFunction !== "function" || !window.wrappedJSObject) throw new Error("Captura do download requer Firefox.");
    const w = window.wrappedJSObject, URLObject = w.URL, anchorProto = w.HTMLAnchorElement.prototype;
    const originalCreate = URLObject.createObjectURL, originalClick = anchorProto.click, originalRevoke = URLObject.revokeObjectURL;
    let captured = null, name = "", generated = new Map(), viewerOpened = false, openedViewer = null, armed = false, deferredRevokes = new Set();
    const hookedCreate = exportFunction(function (blob) {
      const url = originalCreate.call(URLObject, blob);
      if (armed && blob?.size) generated.set(url, blob);
      return url;
    }, w);
    const hookedClick = exportFunction(function () {
      const url = this.href;
      if (armed && (this.hasAttribute("download") || generated.has(url)) && url?.startsWith("blob:https://web.whatsapp.com/")) {
        name = this.download;
        captured = generated.get(url) || url;
        return; // Preserve one original in the export, without a second browser download.
      }
      return originalClick.call(this);
    }, w);
    const hookedRevoke = exportFunction(function (url) {
      if (armed && (generated.has(url) || captured === url)) { deferredRevokes.add(url); return; }
      return originalRevoke.call(URLObject, url);
    }, w);
    const captureClick = event => {
      const anchor = event.target?.closest?.("a[download]");
      if (!armed || !anchor?.href?.startsWith("blob:https://web.whatsapp.com/")) return;
      name = anchor.download; captured = generated.get(anchor.href) || anchor.href;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    document.addEventListener("click", captureClick, true);
    URLObject.revokeObjectURL = hookedRevoke;
    URLObject.createObjectURL = hookedCreate;
    anchorProto.click = hookedClick;
    const clickable = el => {
      if (!el || el.closest('a:not([download]),[role="link"],.selectable-text,[data-testid*="link-preview"], [data-testid*="quoted"], [data-testid*="reply"]')) throw new Error("Mídia indisponível: links e prévias não são abertos pela coleta.");
      return el.matches('img,video,audio') ? el : el.closest('button,[role="button"]') || el;
    };
    try {
      let button = A.downloadControl(target || row);
      if (!button) {
        if (!target) throw new Error("Controle de mídia original não encontrado.");
        clickable(target).click(); viewerOpened = true;
        for (let n = 0; n < 20; n++) {
          await delay(150);
          const loaded = target.matches("audio,video") ? target : target.querySelector("audio,video");
          if ((loaded?.currentSrc || loaded?.src)?.startsWith("blob:")) { viewerOpened = false; return { blob: await getBlob(loaded.currentSrc || loaded.src), name: "", source: "blob_reproducao" }; }
          const viewer = A.mediaViewer();
          if (viewer) openedViewer = viewer;
          button = A.downloadControl(viewer);
          if (button) break;
        }
      }
      if (!button) throw new Error(`WhatsApp não disponibilizou o botão de baixar original (tipo=${type}; controles=${targets.length}; visualizador=${!!openedViewer}).`);
      armed = true; clickable(button).click();
      for (let n = 0; n < 60 && !captured; n++) await delay(150);
      if (!captured) throw new Error("Download original não capturado; nenhuma miniatura foi usada.");
      return { blob: typeof captured === "string" ? await getBlob(captured) : captured, name, source: "download_visualizador" };
    } finally {
      document.removeEventListener("click", captureClick, true);
      // Do not overwrite a hook another script installed in the meantime.
      if (URLObject.createObjectURL === hookedCreate) URLObject.createObjectURL = originalCreate;
      if (anchorProto.click === hookedClick) anchorProto.click = originalClick;
      if (URLObject.revokeObjectURL === hookedRevoke) URLObject.revokeObjectURL = originalRevoke;
      for (const url of deferredRevokes) originalRevoke.call(URLObject, url);
      generated.clear();
      if (viewerOpened) {
        const viewer = openedViewer || A.mediaViewer();
        const close = viewer?.querySelector('[data-icon="x"], [data-icon="x-viewer"], [aria-label="Close"], [aria-label="Fechar"]');
        if (close) clickable(close).click();
        // Never dismiss the conversation when a viewer was not actually opened.
      }
    }
  }
  async function pause(reason) {
    if (!session) return;
    session.paused = true;
    await send({ type: "paused", job: session.job, reason });
  }
  async function verify() {
    const info = A.conversation();
    if (!info) { await pause("Sessão ou conversa indisponível. Abra novamente o WhatsApp Web."); return null; }
    if (info.identity !== session.identity) { await pause("A conversa mudou. Volte à conversa original para continuar."); return null; }
    return info;
  }
  async function collect(s) {
    if (s.loopRunning) return;
    s.loopRunning = true;
    try {
      let info = await verify();
      if (!info) return;
      let rows = A.rows(info.root), box = A.scrollBox(info.root, rows);
      if (!box && !rows.length) { await pause("Estrutura de mensagens incompatível ou histórico ainda não carregado."); return; }
      if (box && !s.initialized) { box.scrollTop = box.scrollHeight; await delay(1200); }
      s.initialized = true;
      let unchanged = 0, previousSignature = "", attempts = 0;
      while (!s.stopped) {
        if (s.paused) { await delay(300); continue; }
        info = await verify(); if (!info) continue;
        rows = A.rows(info.root); box = A.scrollBox(info.root, rows);
        if (!rows.length) { await pause("Nenhuma mensagem reconhecida. Coleta preservada para exportação parcial."); continue; }
        const adapter = info.type === "canal" ? new A.ChannelAdapter() : new A.GroupAdapter();
        const messages = s.timeline.observe(rows.map(row => adapter.read(row, info)));
        const signature = messages.map(m => m.id).join("|");
        const payload = [];
        for (let i = 0; i < messages.length; i++) {
          if (s.stopped || s.paused) break;
          const m = messages[i];
          if (m._afterBoundary) continue;
          if (m.data_hora && +new Date(m.data_hora) > s.startedAt) continue;
          if (!C.inRange(m.data_hora, s.options.start, s.options.end)) { if (!m.data_hora) s.unknownDates.add(m.id); continue; }
          if (s.seen.has(m.id)) continue;
          s.inMessage = true;
          const media = [], mediaIds = [];
          if (s.options.media && m.tipo !== "texto") {
            if (!await verify()) break;
            const attachmentCount = Math.max(1, A.mediaTargets(rows[i]).length);
            for (let attachment = 0; attachment < attachmentCount; attachment++) {
              if (s.stopped) break;
              try {
                const original = await downloadOriginal(rows[i], m.tipo, attachment);
                if (!original.blob.size) throw new Error("Arquivo vazio.");
                // Chunk native messaging-sized transfers; no large base64 batch.
                const mediaId = `${m.id}:${attachment}`, size = original.blob.size;
                const opened = await send({ type: "media-start", job: s.job, mediaId, messageId: m.id, mime: original.blob.type || "application/octet-stream", originalName: original.name, captureSource: original.source, size });
                if (!opened.ok) throw new Error(opened.error);
                for (let offset = 0; offset < size; offset += 256 * 1024) {
                  const chunk = original.blob.slice(offset, offset + 256 * 1024);
                  const transferred = await send({ type: "media-chunk", job: s.job, mediaId, offset, data: await toBase64(chunk) });
                  if (!transferred.ok) throw new Error(transferred.error);
                }
                const result = await send({ type: "media-end", job: s.job, mediaId });
                if (!result.ok) throw new Error(result.error);
                media.push(result.path); mediaIds.push(result.id); m.status_midia = m._mediaError ? "parcial" : "obtida";
                if (result.paused) s.paused = true;
              } catch (e) {
                m.status_midia = media.length ? "parcial" : "falha"; m._mediaError = e.message;
                (m._mediaErrors ||= []).push({ anexo: attachment + 1, erro: e.message });
                try { await send({ type: "media-abort", job: s.job, mediaId: `${m.id}:${attachment}` }); } catch { /* Session loss is handled by the outer loop. */ }
              }
            }
          }
          m.midias = media; m.midias_ids = mediaIds;
          payload.push(m);
        }
        const result = await send({ type: "batch", job: s.job, messages: payload, unknownDates: s.unknownDates.size, fallbackIds: messages.some(m => m._fallback) });
        if (!result.ok) throw new Error(result.error);
        for (const m of payload) s.seen.add(m.id);
        s.inMessage = false;
        if (result.paused) { s.paused = true; continue; }
        if (s.stopped) break;
        const reachedDate = s.options.start && messages.some(m => m.data_hora && +new Date(m.data_hora) < +new Date(`${s.options.start}T00:00:00`));
        if (reachedDate) { s.stopped = true; await send({ type: "finished", job: s.job, reason: "intervalo", unknownDates: s.unknownDates.size }); break; }
        if (signature === previousSignature) unchanged++; else unchanged = 0;
        previousSignature = signature;
        if ((!box || box.scrollTop <= 2) && unchanged >= 5) {
          s.stopped = true;
          await send({ type: "finished", job: s.job, reason: "limite_observado", unknownDates: s.unknownDates.size }); break;
        }
        if (++attempts > 100000) { await pause("Limite de ciclos atingido; exporte o material ou continue uma nova coleta."); continue; }
        if (!box) { await delay(1000); continue; }
        if (unchanged >= 8 && box.scrollTop > 2) { await pause("A rolagem parou de revelar mensagens. Coleta parcial preservada."); continue; }
        box.scrollTop = Math.max(0, box.scrollTop - Math.max(200, box.clientHeight * 0.65));
        box.dispatchEvent(new Event("scroll", { bubbles: true }));
        await delay(900 + Math.min(unchanged * 300, 1500));
      }
      if (s.stopped && !s.finishSent) {
        s.finishSent = true;
        await send({ type: "collector-stopped", job: s.job });
      }
    } catch (e) { await pause(`Coleta interrompida: ${e.message}`); }
    finally { s.loopRunning = false; s.inMessage = false; }
  }
  browser.runtime.onMessage.addListener(async message => {
    if (message.target !== "collector") return;
    if (message.type === "settle") {
      const deadline = Date.now() + 30000;
      while (session?.inMessage) { if (Date.now() > deadline) throw new Error("A mídia atual ainda está sendo preservada. Aguarde e tente exportar novamente."); await delay(100); }
      return { ok: true };
    }
    if (message.type === "inspect") {
      const info = A.conversation(); return info ? { title: info.title, type: info.type, identity: info.identity } : null;
    }
    if (message.type === "start") {
      if (session && !session.stopped) throw new Error("Já há uma coleta nesta aba.");
      const info = A.conversation(); if (!info) throw new Error("Abra um grupo ou canal no WhatsApp Web.");
      session = { job: message.job, identity: info.identity, options: message.options, startedAt: message.startedAt, timeline: new C.Timeline(), seen: new Set(), unknownDates: new Set(), paused: false, stopped: false, finishSent: false };
      collect(session); return { ok: true };
    }
    if (message.type === "pause") { if (session) session.paused = true; return { ok: true }; }
    if (message.type === "resume") {
      if (!session || session.stopped) throw new Error("Sessão de coleta perdida. Exporte o material preservado e inicie outra coleta.");
      if (!await verify()) throw new Error("Volte à conversa original para continuar.");
      session.paused = false;
      if (!session.loopRunning) collect(session);
      return { ok: true };
    }
    if (message.type === "stop") {
      if (!session) throw new Error("Sessão de coleta perdida.");
      session.stopped = true; session.paused = false;
      if (!session.loopRunning) send({ type: "collector-stopped", job: session.job });
      return { ok: true };
    }
  });
})();
