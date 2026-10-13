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
  const excludedMedia = 'a:not([download]),[role="link"],.selectable-text,[data-testid*="link-preview"],[data-testid*="quoted"],[data-testid*="reply"]';
  function mediaTargets(row) {
    const candidates = row.querySelectorAll('button[aria-label], [role="button"][aria-label], [data-testid*="image"], [data-testid*="video"], [data-testid*="sticker"], [data-testid*="document"], video, audio, [data-icon="video-play"], [data-icon="video-play-filled"], [data-icon="audio-play"], [data-icon="ptt-play"],img[src]');
    const found = [];
    for (const el of candidates) {
      if (el.closest(excludedMedia)) continue;
      if (el.matches("img")) {
        if (/emoji|avatar/.test(el.className || "") || el.closest('[data-testid*="avatar"]')) continue;
        const opener = el.closest('[aria-label="Abrir imagem"],[aria-label="Open image"],[aria-label="Open photo"]');
        if (row.querySelector("a[href]") && !opener && !el.closest('[data-testid*="video"]')) continue;
      }
      const label = el.getAttribute("aria-label") || "";
      if (el.matches('button[aria-label], [role="button"][aria-label]') && !/^(abrir|open|reproduzir|play|baixar|download).*(imagem|image|foto|photo|v[ií]deo|audio|[áa]udio|voz|voice|document|arquivo|file)/i.test(label)) continue;
      const target = el.matches('img') ? el.closest('[aria-label="Abrir imagem"],[aria-label="Open image"],[aria-label="Open photo"]') || el : el.closest('button,[role="button"]') || el;
      if (!found.some(previous => previous === target || previous.contains(target))) found.push(target);
    }
    const playable = Array.from(row.querySelectorAll("audio,video")).filter(el => !el.closest(excludedMedia));
    return playable.length ? playable : found.filter(el => !found.some(other => other !== el && other.contains(el)));
  }
  function downloadControl(root) {
    if (!root) return null;
    return Array.from(root.querySelectorAll('[data-icon^="download"],[data-testid="download"],button[aria-label],[role="button"][aria-label],[title],a[download]')).find(el => {
      if (!el.getClientRects().length || el.closest('a:not([download]),[role="link"],.selectable-text')) return false;
      return /^download/.test(el.getAttribute("data-icon") || "") || el.getAttribute("data-testid") === "download" || /^(baixar|download)(?:\b|$)/i.test(el.getAttribute("aria-label") || el.getAttribute("title") || "") || el.matches('a[download][href^="blob:"]');
    }) || null;
  }
  function mediaViewer() {
    const chat = conversation()?.root;
    const visible = el => el?.getClientRects().length;
    const candidates = Array.from(document.querySelectorAll('[role="dialog"],[data-testid="media-viewer"],[data-animate-modal-popup="true"],[data-animate-modal-body="true"]'));
    for (const candidate of candidates) if (visible(candidate) && (candidate.querySelector('img,video,audio') || downloadControl(candidate))) return candidate;
    const closes = document.querySelectorAll('[data-icon="x"],[data-icon="x-viewer"],[aria-label="Fechar"],[aria-label="Close"],[title="Fechar"],[title="Close"]');
    for (const close of closes) {
      if (!visible(close) || chat?.contains(close)) continue;
      for (let el = close.parentElement; el && el !== document.body; el = el.parentElement) {
        if (chat && el.contains(chat)) break;
        if (el.querySelector('img,video,audio') && downloadControl(el)) return el;
      }
    }
    return null;
  }
  function interactions(row) {
    const nodes = row.querySelectorAll('[aria-label],[data-testid*="reaction"]');
    for (const node of nodes) {
      if (node.closest('[data-testid*="quoted"],[data-testid*="reply"]')) continue;
      const label = node.getAttribute("aria-label") || "";
      if (!/rea[çc][õo]es|reactions?/i.test(label + " " + (node.getAttribute("data-testid") || ""))) continue;
      const exact = label.match(/([\d][\d.,\s\u00a0]*)\s*(?:no total|in total|total\b|total reactions?|reactions? total|reactions? in total)/i);
      if (exact) return { total: Number(exact[1].replace(/\D/g, "")), precision: "exata" };
      const displayed = text(node).trim();
      const abbreviated = displayed.match(/^(\d+(?:[.,]\d+)?)\s*(mil|k|m|milh[õo]es?|million|b|bilh[õo]es?)$/i);
      if (abbreviated) {
        const unit = abbreviated[2].toLowerCase();
        const multiplier = /^(mil|k)$/.test(unit) ? 1000 : /^(b|bilh)/.test(unit) ? 1e9 : 1e6;
        return { total: Math.round(Number(abbreviated[1].replace(",", ".")) * multiplier), precision: "aproximada" };
      }
      if (/^\d[\d.,\s\u00a0]*$/.test(displayed)) return { total: Number(displayed.replace(/\D/g, "")), precision: "exata" };
    }
    return { total: "", precision: "indisponivel" };
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
    const targets = mediaTargets(row);
    const video = unquoted('video,[aria-label*="picture-in-picture" i],[data-icon*="video-play"], [data-icon="media-play"]') || targets.find(el => /video|v[ií]deo/i.test(el.getAttribute("aria-label") || el.getAttribute("data-testid") || "")), audio = unquoted("audio");
    const documentNode = unquoted('[data-icon*="document"], [data-testid*="document"]');
    const sticker = unquoted('[data-testid*="sticker"]') || (image && /sticker|figurinha/i.test(image.alt));
    const directImage = targets.find(el => /imagem|image|foto|photo/i.test(el.getAttribute("aria-label") || el.getAttribute("data-testid") || ""));
    const type = audio || unquoted('[data-testid*="audio"], [data-icon="audio-play"], [data-icon="ptt-play"]') ? "audio" : video || unquoted('[data-icon="video-play"]') ? "video" : sticker ? "figurinha" : documentNode ? "documento" : directImage || image && !row.querySelector("a[href]") ? "imagem" : "texto";
    const reactionCount = interactions(row);
    const links = C.extractLinks(body + "\n" + text(row), Array.from(row.querySelectorAll("a[href]")).map(el => el.getAttribute("href")));
    const id = row.getAttribute("data-id") || row.querySelector("[data-id]")?.getAttribute("data-id") || "";
    const number = /^\+?[\d ()-]{8,}$/.test(sender) ? sender : "";
    return { id, conversa: info.title, tipo_conversa: info.type, data_hora: C.parseDate(rawDate, locale()), data_original: rawDate, remetente: sender, numero: number, texto: type === "texto" ? body : "", legenda: type === "texto" ? "" : body, links, tipo: type, resposta_a: quoted?.getAttribute("data-id") || text(quoted), interacoes_total: reactionCount.total, interacoes_precisao: reactionCount.precision, interacoes_observadas_em: reactionCount.total === "" ? "" : new Date().toISOString(), encaminhada: !!row.querySelector('[data-icon*="forward"], [data-testid*="forward"]'), midias: [], status_midia: type === "texto" ? "nao_aplicavel" : "nao_solicitada" };
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
  globalThis.ScoopAdapters = { conversation, rows, scrollBox, interactions, mediaTargets, downloadControl, mediaViewer, GroupAdapter, ChannelAdapter };
})();
