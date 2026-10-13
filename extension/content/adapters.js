(function () {
  "use strict";
  const C = ScoopCore;
  const text = el => el?.innerText?.trim() || el?.textContent?.trim() || "";
  function bodyText(el) {
    if (!el.querySelector('img.emoji, img[data-plain-text]')) return text(el);
    const clone = el.cloneNode(true);
    for (const image of clone.querySelectorAll('img.emoji, img[data-plain-text]')) image.replaceWith(document.createTextNode(image.getAttribute("data-plain-text") || image.alt || ""));
    for (const br of clone.querySelectorAll("br")) br.replaceWith(document.createTextNode("\n"));
    for (const block of clone.querySelectorAll("div,p")) block.appendChild(document.createTextNode("\n"));
    return clone.textContent.trim();
  }
  const locale = () => document.documentElement.lang || navigator.language || "pt-BR";
  function conversation() {
    const root = document.querySelector("#main") || document.querySelector('[role="main"]');
    const header = root?.querySelector("header");
    if (!root || !header) return null;
    const titleNode = header.querySelector('[data-testid="conversation-info-header-chat-title"]') || header.querySelector('span[title]') || header.querySelector('[dir="auto"]');
    const title = titleNode?.getAttribute("title") || text(titleNode);
    if (!title) return null;
    const channel = /channel|newsletter/.test(root.getAttribute("data-testid") || "") || !!root.querySelector('[data-testid*="newsletter"], [data-testid*="channel"], [data-icon*="newsletter"]') || /seguidores|followers|inscritos|subscribers/i.test(text(header));
    const avatar = header.querySelector("img")?.getAttribute("src") || "";
    return { root, header, title, type: channel ? "canal" : "grupo", identity: `${channel ? "canal" : "grupo"}:${title}:${avatar}` };
  }
  function rows(root) {
    const selectors = '[data-id], [data-testid="msg-container"], .message-in, .message-out, [data-testid="newsletter-message"]';
    return Array.from(root.querySelectorAll(selectors)).filter(el => {
      if (!el.getClientRects().length) return false;
      if (el.parentElement?.closest(selectors) && root.contains(el.parentElement.closest(selectors))) return false;
      return el.matches('.message-in,.message-out,[data-testid="msg-container"],[data-testid="newsletter-message"]') || !!el.querySelector('[data-pre-plain-text], .selectable-text, [data-testid*="msg-text"], img, video, audio, [data-icon*="document"]');
    });
  }
  function scrollBox(root, messages) {
    for (let el = messages[0]?.parentElement; el && root.contains(el); el = el.parentElement) {
      if (el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)) return el;
    }
    return Array.from(root.querySelectorAll("div")).filter(el => el.clientHeight > 100 && el.scrollHeight > el.clientHeight + 20 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)).sort((a, b) => b.clientHeight - a.clientHeight)[0] || null;
  }
  function baseMessage(row, info) {
    const pre = row.getAttribute("data-pre-plain-text") || row.querySelector("[data-pre-plain-text]")?.getAttribute("data-pre-plain-text") || "";
    const match = pre.match(/^\[([^\]]+)\]\s*(.*?):\s*$/s);
    const rawDate = match?.[1] || row.querySelector("time")?.getAttribute("datetime") || row.querySelector('[data-testid="msg-meta"]')?.getAttribute("title") || "";
    const sender = match?.[2] || text(row.querySelector('[data-testid="author"], [data-testid="msg-author"], [data-testid*="sender-name"]'));
    const bodyNodes = Array.from(row.querySelectorAll('.selectable-text, [data-testid="msg-text"]')).filter(el => !el.parentElement?.closest('.selectable-text, [data-testid="msg-text"]') && !el.closest('[data-testid*="quoted"], [data-testid*="reply"]'));
    const body = bodyNodes.map(bodyText).filter(Boolean).join("\n");
    const quoted = row.querySelector('[data-testid*="quoted"], [data-testid*="reply"]');
    const unquoted = selector => Array.from(row.querySelectorAll(selector)).find(el => !el.closest('[data-testid*="quoted"], [data-testid*="reply"]'));
    const image = Array.from(row.querySelectorAll('img[src]')).find(el => !el.closest('[data-testid*="avatar"], [data-testid*="quoted"], [data-testid*="reply"], .selectable-text, a, [role="link"], [data-testid*="link-preview"]') && !/emoji|avatar/.test(el.className || ""));
    const video = unquoted("video"), audio = unquoted("audio");
    const documentNode = unquoted('[data-icon*="document"], [data-testid*="document"]');
    const sticker = unquoted('[data-testid*="sticker"]') || (image && /sticker|figurinha/i.test(image.alt));
    const type = audio || unquoted('[data-testid*="audio"], [data-icon="audio-play"], [data-icon="ptt-play"]') ? "audio" : video || unquoted('[data-icon="video-play"]') ? "video" : sticker ? "figurinha" : documentNode ? "documento" : image ? "imagem" : "texto";
    const id = row.getAttribute("data-id") || row.querySelector("[data-id]")?.getAttribute("data-id") || "";
    const number = /^\+?[\d ()-]{8,}$/.test(sender) ? sender : "";
    return { id, conversa: info.title, tipo_conversa: info.type, data_hora: C.parseDate(rawDate, locale()), data_original: rawDate, remetente: sender, numero: number, texto: type === "texto" ? body : "", legenda: type === "texto" ? "" : body, tipo: type, resposta_a: quoted?.getAttribute("data-id") || text(quoted), encaminhada: !!row.querySelector('[data-icon*="forward"], [data-testid*="forward"]'), midias: [], status_midia: type === "texto" ? "nao_aplicavel" : "nao_solicitada" };
  }
  class GroupAdapter {
    read(row, info) { return baseMessage(row, info); }
  }
  class ChannelAdapter extends GroupAdapter {
    read(row, info) {
      const m = super.read(row, info);
      if (!m.data_original) {
        const d = row.querySelector("[data-timestamp]")?.getAttribute("data-timestamp") || row.getAttribute("data-timestamp");
        if (d && /^\d{10,13}$/.test(d)) { m.data_hora = new Date(+d * (d.length === 10 ? 1000 : 1)).toISOString(); m.data_original = d; }
      }
      return m;
    }
  }
  globalThis.ScoopAdapters = { conversation, rows, scrollBox, GroupAdapter, ChannelAdapter };
})();
