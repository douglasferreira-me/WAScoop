const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const API = "https://www.googleapis.com/drive/v3/files";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
export class AuthRequired extends Error {}
export class Drive {
  // Firefox requires the Window receiver even when fetch is stored on this client.
  constructor({ identity = browser.identity, fetcher = globalThis.fetch.bind(globalThis), clock = Date.now, sleeper = ms => new Promise(r => setTimeout(r, ms)), tokenProvider, authorize = async () => {} } = {}) {
    this.identity = identity; this.fetcher = fetcher; this.clock = clock; this.sleeper = sleeper; this.tokenProvider = tokenProvider;
    this.token = null; this.expires = 0;
    this.authorize = authorize;
  }
  async connect(clientId, interactive = true) {
    if (!clientId?.endsWith(".apps.googleusercontent.com")) throw new Error("O mantenedor ainda não configurou o aplicativo Google. Use ZIP local.");
    const redirect = this.identity.getRedirectURL();
    const state = crypto.randomUUID();
    const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: "token", scope: "https://www.googleapis.com/auth/drive.file", state, prompt: interactive ? "select_account" : "none" });
    const returned = await this.identity.launchWebAuthFlow({ url: `${AUTH}?${query}`, interactive });
    const url = new URL(returned), expected = new URL(redirect);
    if (url.origin !== expected.origin || url.pathname !== expected.pathname) throw new Error("Redirecionamento Google inválido.");
    const params = new URLSearchParams(url.hash.slice(1));
    if (params.get("state") !== state) throw new Error("Resposta de login inválida.");
    if (params.get("error")) throw new Error(`Google: ${params.get("error")}`);
    const token = params.get("access_token");
    if (!token) throw new Error("Google não forneceu autorização.");
    // Verify issued token belongs to our app and carries exactly the needed scope.
    const response = await this.fetcher(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!response.ok) throw new Error("Não foi possível validar a autorização Google.");
    const info = await response.json();
    if ((info.aud || info.audience || info.issued_to) !== clientId || !String(info.scope || "").split(" ").includes("https://www.googleapis.com/auth/drive.file")) throw new Error("Autorização Google incompatível.");
    const accountResponse = await this.fetcher("https://www.googleapis.com/drive/v3/about?fields=user(permissionId)", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!accountResponse.ok) throw new Error("Não foi possível identificar a conta do Drive.");
    const account = (await accountResponse.json()).user?.permissionId;
    if (!account) throw new Error("A conta do Drive não forneceu identificação.");
    this.account = account; this.clientId = clientId;
    this.token = token; this.expires = this.clock() + Math.max(0, Number(info.expires_in || params.get("expires_in")) - 60) * 1000;
    return { connected: true, expires: this.expires };
  }
  connected() { return !!this.token && this.expires > this.clock(); }
  disconnect() { this.token = null; this.expires = 0; }
  async request(url, init = {}, accept308 = false) {
    if (!/^https:\/\/www\.googleapis\.com\//.test(url)) throw new Error("Destino de upload inválido.");
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.authorize();
      if (!this.tokenProvider && !this.connected() && this.clientId && this.token) {
        const account = this.account;
        try { await this.connect(this.clientId, false); if (this.account !== account) { this.disconnect(); throw new Error("Conta diferente."); } }
        catch { throw new AuthRequired("Reconecte ao Google Drive; os arquivos pendentes continuam locais."); }
      }
      const token = this.tokenProvider ? this.tokenProvider() : this.connected() ? this.token : null;
      if (!token) throw new AuthRequired("Conecte novamente ao Google Drive para continuar.");
      let response;
      try { response = await this.fetcher(url, { ...init, signal: AbortSignal.timeout(45000), headers: { ...init.headers, Authorization: `Bearer ${token}` } }); }
      catch (e) { if (attempt === 3) throw e; await this.sleeper(500 * 2 ** attempt); continue; }
      if (response.status === 401) { this.disconnect(); throw new AuthRequired("A autorização Google expirou. Conecte novamente."); }
      if (response.ok || (accept308 && response.status === 308)) return response;
      const retriable = response.status === 429 || response.status >= 500;
      if (!retriable || attempt === 3) { const error = new Error(`Google Drive retornou ${response.status}. Nenhum arquivo local foi descartado.`); error.status = response.status; throw error; }
      const retryAfter = Number(response.headers.get("Retry-After"));
      await this.sleeper(Math.min(10000, retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt));
    }
  }
  async folder(name, parent) {
    const metadata = { name, mimeType: "application/vnd.google-apps.folder", ...(parent ? { parents: [parent] } : {}) };
    const r = await this.request(API + "?fields=id,webViewLink", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(metadata) });
    return r.json();
  }
  async upload(name, blob, folder, onProgress = () => {}, savedSession = null, onSession = async () => {}, fileId = null) {
    let url = savedSession;
    if (!url) {
      const r = await this.request(UPLOAD + (fileId ? "/" + encodeURIComponent(fileId) : "") + "?uploadType=resumable&fields=id", { method: fileId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", "X-Upload-Content-Type": blob.type || "application/octet-stream", "X-Upload-Content-Length": String(blob.size) }, body: JSON.stringify({ name, ...(!fileId ? { parents: [folder] } : {}) }) });
      url = r.headers.get("Location");
      if (!url) throw new Error("Google não criou sessão de upload.");
      await onSession(url);
    }
    let offset = 0;
    if (savedSession) {
      let status;
      try { status = await this.request(url, { method: "PUT", headers: { "Content-Range": `bytes */${blob.size}` }, body: new Blob() }, true); }
      catch (e) {
        if (![404, 410].includes(e.status)) throw e;
        await onSession(null);
        return this.upload(name, blob, folder, onProgress, null, onSession, fileId);
      }
      if (status.ok) return status.json();
      offset = this.nextOffset(status);
    }
    const chunkSize = 1024 * 1024;
    while (offset < blob.size) {
      const end = Math.min(offset + chunkSize, blob.size);
      let response;
      try {
        response = await this.request(url, { method: "PUT", headers: { "Content-Type": blob.type || "application/octet-stream", "Content-Range": `bytes ${offset}-${end - 1}/${blob.size}` }, body: blob.slice(offset, end) }, true);
      } catch (e) {
        if (e instanceof AuthRequired) throw e;
        // Reconcile server offset after ambiguous network failures.
        const status = await this.request(url, { method: "PUT", headers: { "Content-Range": `bytes */${blob.size}` }, body: new Blob() }, true);
        if (status.ok) return status.json();
        const next = this.nextOffset(status);
        if (next <= offset) throw e;
        offset = next; continue;
      }
      if (response.ok) { onProgress(blob.size); return response.json(); }
      const next = this.nextOffset(response);
      if (next <= offset) throw new Error("Upload não avançou; arquivo preservado para nova tentativa.");
      offset = next; onProgress(offset);
    }
    throw new Error("Upload incompleto.");
  }
  nextOffset(response) {
    const match = response.headers.get("Range")?.match(/bytes=0-(\d+)/);
    return match ? +match[1] + 1 : 0;
  }
}
