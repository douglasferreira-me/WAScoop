import { english } from "./translations.js";
let language = "pt-BR";
export function setLanguage(value) { language = value === "en" ? "en" : "pt-BR"; }
export function getLanguage() { return language; }
export function locale() { return language === "en" ? "en-US" : "pt-BR"; }
export function t(source, values = {}) {
  const text = language === "en" ? english[source] || source : source;
  return text.replace(/\{(\w+)\}/g, (match, key) => values[key] === undefined ? match : String(values[key]));
}
const templates = Object.keys(english).filter(key => key.includes("{")).map(key => {
  const names = [];
  const pattern = key.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return "([\\s\\S]+?)"; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, names, regex: new RegExp("^" + pattern + "$") };
});
export function statusText(source, depth = 0) {
  if (!source || language !== "en") return source || "";
  if (english[source]) return english[source];
  if (depth < 3) for (const entry of templates) {
    const match = source.match(entry.regex);
    if (match) return t(entry.key, Object.fromEntries(entry.names.map((name, i) => [name, statusText(match[i + 1], depth + 1)])));
  }
  // Compound notices consist of fixed application messages; user corpus fields
  // never pass through this function. Unknown technical errors remain verbatim.
  let result = source;
  for (const key of Object.keys(english).filter(k => k.length > 15 && !k.includes("{")).sort((a, b) => b.length - a.length)) result = result.split(key).join(english[key]);
  return result;
}
export function translateDocument(doc) {
  const nodes = [], attributes = [];
  const walker = doc.createTreeWalker(doc.body, 4);
  let node;
  while ((node = walker.nextNode())) {
    const source = node.nodeValue.trim();
    if (source && english[source]) nodes.push({ node, source, before: node.nodeValue.match(/^\s*/)[0], after: node.nodeValue.match(/\s*$/)[0] });
  }
  for (const el of doc.querySelectorAll("[placeholder],[aria-label],[title]")) for (const name of ["placeholder", "aria-label", "title"]) {
    const source = el.getAttribute(name); if (source && english[source]) attributes.push({ el, name, source });
  }
  return () => {
    doc.documentElement.lang = language;
    for (const row of nodes) if (row.node.isConnected) row.node.nodeValue = row.before + t(row.source) + row.after;
    for (const row of attributes) row.el.setAttribute(row.name, t(row.source));
  };
}
