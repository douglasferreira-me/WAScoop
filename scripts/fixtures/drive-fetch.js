// Loaded only into the isolated test copy, never distributed in the add-on.
import { Drive } from "./lib/drive.js";
async function check(origin) {
    const configURL = browser.runtime.getURL("config.json");
    let originalError = "";
    try { const broken = { fetcher: globalThis.fetch }; await broken.fetcher(configURL); }
    catch (e) { originalError = e.message; }
    const native = new Drive();
    const configResponse = await native.fetcher(configURL);
    if (!configResponse.ok) throw new Error("Falha no fetch nativo do arquivo da extensão.");
    const originalMethod = window.fetch, originalFetch = window.fetch.bind(window), requests = [];
    try {
      // Route synthetic Google responses through real Firefox network calls.
      // No Google login or real credentials are used in this isolated profile.
      window.fetch = function(url, init = {}) {
        if (this !== window) throw new Error("fetch perdeu o contexto Window");
        const parsed = new URL(url);
        let route;
        if (parsed.hostname === "oauth2.googleapis.com" && parsed.pathname === "/tokeninfo") route = "tokeninfo";
        else if (parsed.hostname === "www.googleapis.com" && parsed.pathname === "/drive/v3/about") route = "about";
        else if (parsed.hostname === "www.googleapis.com" && parsed.pathname === "/drive/v3/files") route = "files";
        else if (parsed.hostname === "www.googleapis.com" && parsed.pathname.startsWith("/upload/")) route = init.method === "PUT" ? "session" : "upload";
        else throw new Error("Destino não simulado: acesso externo bloqueado no teste");
        requests.push({ route, method: init.method || "GET" });
        return originalFetch(origin + "/drive-test/" + route, init);
      };
      const redirect = "https://fixture.extensions.allizom.org/", client = "fixture.apps.googleusercontent.com";
      const identity = { getRedirectURL: () => redirect, launchWebAuthFlow: async ({url}) => redirect + "#state=" + new URL(url).searchParams.get("state") + "&access_token=fixture-token&expires_in=3600" };
      const drive = new Drive({ identity });
      await drive.connect(client);
      const folder = await drive.folder("Teste");
      const uploaded = await drive.upload("mensagens.csv", new Blob(["id,texto\r\n1,teste\r\n"], {type:"text/csv"}), folder.id);
      const updated = await drive.upload("mensagens.csv", new Blob(["id,texto\r\n1,atualizado\r\n"], {type:"text/csv"}), folder.id, () => {}, null, async () => {}, uploaded.id);
      return { originalError, nativeFetchOK: true, connected: drive.connected(), folder: folder.id, uploaded: uploaded.id, updated: updated.id, requests };
    } finally { window.fetch = originalMethod; }
}
const output = document.createElement("pre"); output.id = "scoop-drive-test-result"; document.body.append(output);
try { output.textContent = JSON.stringify(await check(new URL(import.meta.url).searchParams.get("origin"))); }
catch (e) { output.textContent = JSON.stringify({ error: e.message, stack: e.stack }); }
