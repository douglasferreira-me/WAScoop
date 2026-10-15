/* Real Firefox + synthetic local conversation, in an isolated disposable profile.
 * Only fixture origins and saveAs dialog are changed in the test package.
 * This does NOT assert compatibility with a logged-in WhatsApp account.
 */
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const { Builder } = require("selenium-webdriver");
const firefox = require("selenium-webdriver/firefox");
const zip = require("@zip.js/zip.js");
const fixture = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>body{font:16px system-ui}#main{width:650px}header{padding:15px}.box{height:400px;overflow-y:auto;border:1px solid #aaa}.row{height:80px;border-bottom:1px solid #ddd}img{height:40px}audio,video{height:40px;width:100px}</style></head><body><div id="main"><header><span title="Grupo sintético">Grupo sintético</span></header><div class="box"></div></div><script>
let start=25;const box=document.querySelector('.box');
const types={26:'imagem',17:'documento',7:'audio',3:'video',1:'figurinha',0:'imagem'};
function viewer(id){const dialog=document.createElement('div');dialog.setAttribute('data-animate-modal-body','true');dialog.innerHTML='<img src="original">';if(id!==0){const b=document.createElement('button');b.innerHTML='<span data-icon="download-filled">Baixar</span>';b.onclick=()=>{const blob=new Blob(['ORIGINAL-'+id],{type:id===17?'application/pdf':'image/png'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=id===17?'documento.pdf':'foto.png';a.click();};dialog.append(b);}const close=document.createElement('button');close.setAttribute('aria-label','Fechar');close.textContent='Fechar';close.onclick=()=>dialog.remove();dialog.append(close);document.body.append(dialog);}
function render(){box.innerHTML='<div style="height:'+(start===25?5000:start?1400:0)+'px"></div>';for(let i=start;i<Math.min(35,start+15);i++){const row=document.createElement('div');row.className='row message-in';row.dataset.id='fixture-'+i;let body='<div data-pre-plain-text="[09:'+String(i).padStart(2,'0')+', 10/10/2026] Ana: "><span class="selectable-text">Mensagem '+i+', &quot;pesquisa&quot; 🧪</span></div>';const type=types[i];if(type==='audio'||type==='video'){body+='<'+type+' src="'+URL.createObjectURL(new Blob(['ORIGINAL-'+i],{type:type==='audio'?'audio/mpeg':'video/mp4'}))+'"></'+type+'>';}else if(type==='documento'){body+='<button data-testid="document"><span data-icon="document">Documento</span></button>';}else if(type){body+='<button aria-label="Abrir imagem"><img alt="'+(type==='figurinha'?'figurinha':'foto')+'" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></button>';}if(i===26)body+='<button aria-label="Abrir imagem"><img alt="segunda foto" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></button>';body+='<button aria-label="Reações 👍, ❤, 3.405 no total. Mostrar reações">3,4 mil</button>';body+='<a href="https://example.com/message/'+i+'?a=1&amp;b=2">Fonte</a>';if(i===29&&document.querySelector('header span[title]').title.includes('Canal'))body='';row.innerHTML=body;row.querySelectorAll('button:not([aria-label^="Reações"])').forEach(b=>b.addEventListener('click',()=>viewer(i)));box.append(row);}const placeholder=document.createElement('div');placeholder.dataset.id='placeholder';placeholder.className='message-in';box.append(placeholder);}
window.WPP={isReady:true,chat:{getActiveChat:()=>({id:{_serialized:'123@newsletter'},name:document.querySelector('header span[title]').title,newsletterMetadata:{inviteCode:'0029Vb8kT6E3AzNNDpBkN22J'},msgs:{getModelsArray:()=>Array.from(document.querySelectorAll('[data-id]')).filter(r=>r.dataset.id!=='placeholder').map(r=>({id:{id:r.dataset.id,toString:()=>r.dataset.id},type:({imagem:'image',video:'video',audio:'audio',documento:'document',figurinha:'sticker'})[types[Number(r.dataset.id.split('-')[1])]]||'chat',body:'Mensagem '+Number(r.dataset.id.split('-')[1])+' via API',t:Date.parse('2026-10-10T12:'+String(Number(r.dataset.id.split('-')[1])).padStart(2,'0')+':00Z')/1000,serverId:201+Number(r.dataset.id.split('-')[1]),mediaData:types[Number(r.dataset.id.split('-')[1])] ? {} : null}))}}),downloadMedia:async id=>{const i=Number(id.split('-')[1]);if(i===0)throw new Error('deliberately unavailable');return new Blob(['ORIGINAL-'+i],{type:i===17?'application/pdf':i===7?'audio/mpeg':i===3?'video/mp4':'image/png'});}}};
render();box.scrollTop=box.scrollHeight;box.addEventListener('scroll',()=>{if(start>0&&box.scrollTop<900){start=Math.max(0,start-10);render();box.scrollTop=start?1100:0;}});
</script></body></html>`;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function checkBackground(driver, call, origin, panelTab) {
  // The WhatsApp fixture is never selected after activation. Posts arrive while hidden,
  // including after the browser has had time to apply background timer throttling.
  const inspected = await call("inspect");
  const tabId = inspected.conversation.tabId;
  await driver.executeAsyncScript((tabId, url, done) => browser.tabs.update(tabId, { url }).then(() => done(true)), tabId, origin + "/channel");
  await wait(1500);
  assert.equal((await call("start", { options: { mode: "monitor", destination: "zip", media: true, localLimitMB: 128 } })).ok, true);
  await driver.executeAsyncScript((tabId, done) => browser.scripting.executeScript({ target: { tabId }, world: "MAIN", func: () => {
    window.backgroundVisibility = [document.visibilityState];
    document.addEventListener("visibilitychange", () => window.backgroundVisibility.push(document.visibilityState));
    const active = WPP.chat.getActiveChat, baseline = active().msgs.getModelsArray(), added = [];
    WPP.chat.getActiveChat = () => { const chat = active(); chat.msgs.getModelsArray = () => [...baseline, ...added]; return chat; };
    WPP.chat.downloadMedia = async id => new Blob(["ORIGINAL-" + id], { type: id === "hidden-audio" ? "audio/ogg" : "image/png" });
    for (const [delay, id, serverId, type] of [[2000, "hidden-text", 236, "chat"], [15000, "hidden-image", 237, "image"], [65000, "hidden-audio", 238, "audio"]]) {
      setTimeout(() => added.push({ id: { id, toString: () => id }, serverId, type, t: Date.now() / 1000, body: type === "chat" ? "Mensagem com WhatsApp em segundo plano" : "", caption: type === "image" ? "Foto em segundo plano" : "", mediaData: type === "chat" ? null : {} }), delay);
    }
    return document.hidden;
  } }).then(results => done(results[0].result)), tabId).then(hidden => assert.equal(hidden, true));
  await driver.switchTo().newWindow("tab"); await driver.get(origin + "/research");
  const foregroundTab = await driver.getWindowHandle();
  for (let elapsed = 0; elapsed < 80; elapsed += 10) {
    await driver.executeScript("document.querySelector('input').value=arguments[0]; return document.visibilityState", "Anotação " + elapsed).then(v => assert.equal(v, "visible"));
    await wait(10000);
    assert.equal(await driver.getWindowHandle(), foregroundTab);
    assert.equal(await driver.getCurrentUrl(), origin + "/research");
    console.log("Outra aba ativa:", elapsed + 10, "segundos");
  }
  await driver.switchTo().window(panelTab);
  const state = (await call("state")).state;
  assert.equal(state.job.status, "running", JSON.stringify(state));
  assert.equal(state.job.count, 3); assert.equal(state.job.mediaCount, 2); assert.equal(state.job.mediaFailures, 0);
  const visibility = await driver.executeAsyncScript((tabId, done) => browser.scripting.executeScript({ target: { tabId }, world: "MAIN", func: () => ({ hidden: document.hidden, states: window.backgroundVisibility }) }).then(results => done(results[0].result)), tabId);
  assert.equal(visibility.hidden, true); assert.ok(visibility.states.every(value => value === "hidden"));
  assert.equal((await call("stop")).ok, true);
  await fs.writeFile("docs/firefox-background-result.json", JSON.stringify({ extensionVersion: JSON.parse(await fs.readFile("extension/manifest.json")).version, browser: (await driver.getCapabilities()).get("browserVersion"), fixture: "canal sintético local; API WPP simulada; não WhatsApp real", foreground: "página comum de pesquisa, sem painel da extensão", seconds: 80, whatsappVisibility: visibility, messages: state.job.count, media: state.job.mediaCount, mediaFailures: state.job.mediaFailures, lastMessageScheduledAfterSeconds: 65, passed: true }, null, 2));
  console.log("PASS: 80 segundos usando outra aba; 3 mensagens e 2 mídias capturadas com a conversa oculta, sem mudar o foco.");
}
async function checkDriveFetch(driver, origin, call) {
  const bundled = JSON.parse(await fs.readFile("extension/config.json")).googleClientId;
  let google = (await call("state")).state;
  assert.ok(bundled); assert.equal(google.driveConfigured, true); assert.equal(google.googleClientSource, "bundled"); assert.equal(google.googleClientId, bundled);
  const own = "fork-test.apps.googleusercontent.com";
  assert.equal((await call("configure-google", { clientId: own })).ok, true);
  google = (await call("state")).state; assert.equal(google.googleClientId, own); assert.equal(google.googleClientSource, "custom");
  await driver.navigate().refresh(); await wait(600);
  google = (await call("state")).state; assert.equal(google.googleClientId, own); assert.equal(await driver.executeScript("return document.getElementById('client-id').value"), own);
  await driver.executeScript("document.getElementById('reset-google').click()");
  await driver.wait(async () => (await call("state")).state.googleClientSource === "bundled", 5000);
  google = (await call("state")).state; assert.equal(google.googleClientId, bundled); assert.equal(google.googleClientOverride, "");
  assert.equal((await call("configure-google", { clientId: "invalid-client" })).ok, false); assert.equal((await call("state")).state.googleClientId, bundled);
  assert.equal(await driver.executeScript("return document.getElementById('google-advanced').open"), false);
  await driver.executeScript("const script=document.createElement('script');script.type='module';script.src=browser.runtime.getURL('drive-fetch-fixture.js')+'?origin='+encodeURIComponent(arguments[0]);document.body.append(script);", origin);
  const text = await driver.wait(async () => driver.executeScript("return document.getElementById('scoop-drive-test-result')?.textContent || null"), 15000);
  const result = JSON.parse(text);
  assert.ok(!result.error, JSON.stringify(result));
  assert.match(result.originalError, /Window/); assert.equal(result.nativeFetchOK, true); assert.equal(result.connected, true);
  assert.equal(result.uploaded, result.updated); assert.ok(result.requests.some(r => r.method === "PATCH"));
  await fs.writeFile("docs/firefox-drive-result.json", JSON.stringify({extensionVersion:JSON.parse(await fs.readFile("extension/manifest.json")).version,browser:(await driver.getCapabilities()).get("browserVersion"),fixture:"fetch nativo do Firefox; OAuth e endpoints Google simulados localmente; sem conta Google real",...result,bundledClientConfigured:true,customClientPersisted:true,restoredBundledClient:true,invalidOverrideRejected:true,passed:true},null,2));
  console.log("PASS: Client ID incluído, substituição persistida e restauração aprovados; fetch nativo e OAuth/upload simulados aprovados.");
}
async function main() {
  if (!process.env.FIREFOX_BIN || !process.env.GECKODRIVER_BIN) throw new Error("Defina FIREFOX_BIN e GECKODRIVER_BIN para os binários oficiais da Mozilla.");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wascoop-test-")), source = path.join(root, "extension"), downloads = path.join(root, "downloads");
  await fs.mkdir(downloads); await fs.cp("extension", source, { recursive: true });
  const server = http.createServer((req, res) => {
    if (req.url.startsWith("/drive-test/")) {
      const route = req.url.split("/").pop();
      const body = route === "tokeninfo" ? {aud:"fixture.apps.googleusercontent.com",scope:"https://www.googleapis.com/auth/drive.file",expires_in:3600} : route === "about" ? {user:{permissionId:"fixture-account"}} : {id: route === "files" ? "fixture-folder" : "fixture-file"};
      res.writeHead(200,{"Content-Type":"application/json", ...(route === "upload" ? {Location:"https://www.googleapis.com/upload/fixture-session"} : {})});res.end(JSON.stringify(body));return;
    }
    res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" }); res.end(req.url === "/research" ? '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><h1>Pesquisa em outra aba</h1><input aria-label="Anotações"><p>Esta página permanece ativa durante o teste.</p></html>' : req.url.includes("channel") ? fixture.replaceAll("Grupo sintético", "Canal sintético").replace("<header>", "<header><span>100 seguidores</span>") : fixture); });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const manifest = JSON.parse(await fs.readFile(path.join(source, "manifest.json")));
  const matchPattern = "http://127.0.0.1/*";
  manifest.permissions.push(matchPattern); manifest.content_scripts[0].matches.push(matchPattern);
  await fs.writeFile(path.join(source, "manifest.json"), JSON.stringify(manifest));
  let bg = await fs.readFile(path.join(source, "background.js"), "utf8");
  bg = bg.replace('url: "https://web.whatsapp.com/*"', `url: "${matchPattern}"`).replace("saveAs: true", "saveAs: false");
  await fs.writeFile(path.join(source, "background.js"), bg);
  const diagnosticPath = path.join(source, "lib/diagnostics.js");
  await fs.writeFile(diagnosticPath, (await fs.readFile(diagnosticPath, "utf8")).replace("saveAs: true", "saveAs: false"));
  let content = await fs.readFile(path.join(source, "content/collector.js"), "utf8");
  content = content.replaceAll("blob:https://web.whatsapp.com/", `blob:${origin}/`);
  await fs.writeFile(path.join(source, "content/collector.js"), content);
  if (process.env.SCOOP_DRIVE_ONLY === "1") await fs.copyFile("scripts/fixtures/drive-fetch.js", path.join(source, "drive-fetch-fixture.js"));
  const uuid = "94173b9f-33c7-4468-9a24-a31c506cad61";
  const options = new firefox.Options().setBinary(process.env.FIREFOX_BIN).addArguments("-headless", "-no-remote").setPreference("extensions.webextensions.uuids", JSON.stringify({ [manifest.browser_specific_settings.gecko.id]: uuid })).setPreference("browser.download.folderList", 2).setPreference("browser.download.dir", downloads).setPreference("browser.download.useDownloadDir", true).setPreference("browser.download.alwaysOpenPanel", false);
  const service = new firefox.ServiceBuilder(process.env.GECKODRIVER_BIN).addArguments("--allow-system-access");
  let driver;
  try {
    driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).setFirefoxService(service).build();
    console.log("Firefox", (await driver.getCapabilities()).get("browserVersion"));
    await driver.installAddon(source, true);
    await driver.get(origin); const fixtureTab = await driver.getWindowHandle();
    await driver.switchTo().newWindow("tab");
    // Firefox 158 disallows direct WebDriver navigation to extension URLs.
    // Open our test add-on from browser chrome in this isolated test profile.
    await driver.setContext(firefox.Context.CHROME);
    await driver.executeScript("gBrowser.selectedBrowser.loadURI(Services.io.newURI(arguments[0]), { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });", `moz-extension://${uuid}/panel.html`);
    await driver.setContext(firefox.Context.CONTENT);
    await wait(600);
    const panelTab = await driver.getWindowHandle();
    const call = (type, extra = {}) => driver.executeAsyncScript((type, extra, done) => browser.runtime.sendMessage({ type, ...extra }).then(done, e => done({ ok: false, error: e.message })), type, extra);
    if (process.env.SCOOP_DRIVE_ONLY === "1") { await checkDriveFetch(driver, origin, call); return; }
    if (process.env.SCOOP_BACKGROUND_ONLY === "1") { await checkBackground(driver, call, origin, panelTab); return; }
    const emptyLog = await call("download-log"); assert.equal(emptyLog.downloaded,true); assert.equal(JSON.parse(emptyLog.text).collection,null);
    await wait(300); const inspected = await call("inspect");
    assert.equal(inspected.ok, true, JSON.stringify(inspected));
    if (!inspected.conversation) console.log(await driver.executeAsyncScript(done => browser.tabs.query({url:"http://127.0.0.1/*"}).then(async tabs => { const out=[];for(const t of tabs){try{out.push(await browser.tabs.executeScript(t.id,{code:'JSON.stringify({core:typeof ScoopCore,adapters:typeof ScoopAdapters,title:document.querySelector("header span")?.title})'}));}catch(e){out.push(e.message)}}done(out);})));
    assert.equal(inspected.conversation?.title, "Grupo sintético", JSON.stringify(inspected));
    assert.equal(await driver.executeScript("return document.getElementById('workbook').checked"), false);
    await driver.executeScript("document.getElementById('media').checked=true;document.getElementById('workbook').checked=true;document.getElementById('pseudonymize').checked=true;");
    assert.equal((await call("start", { options: { media: true, workbook: true, pseudonymize: true, destination: "zip", start: "", end: "" } })).ok, true);
    await wait(2200); assert.equal((await call("pause")).ok, true);
    await driver.switchTo().window(fixtureTab); await driver.executeScript("document.querySelector('header span').setAttribute('title','Outra conversa')");
    await driver.switchTo().window(panelTab); assert.equal((await call("resume")).ok, false);
    await driver.switchTo().window(fixtureTab); await driver.executeScript("document.querySelector('header span').setAttribute('title','Grupo sintético')");
    await driver.switchTo().window(panelTab); assert.equal((await call("resume")).ok, true);
    let state;
    for (let n = 0; n < 120; n++) {
      state = (await call("state")).state;
      if (["finished", "interrupted"].includes(state?.job?.status) && !state.exportBusy) break;
      if (state?.job?.status === "paused") throw new Error(state.job.notice);
      await wait(1000);
    }
    assert.equal(state.job.status, "finished", JSON.stringify(state)); assert.equal(state.job.count, 35);
    assert.equal(state.job.mediaCount, 6); assert.equal(state.job.mediaFailures, 1);
    const successLog = await call("download-log"); assert.equal(successLog.downloaded,true); assert.equal(JSON.parse(successLog.text).collection.media,6);
    await fs.mkdir("docs/screenshots", { recursive: true });
    await driver.executeAsyncScript(done => browser.sidebarAction.close().then(() => done(true), () => done(false)));
    await driver.manage().window().setRect({ width: 800, height: 1600 });
    await wait(150);
    await fs.writeFile("docs/screenshots/painel-firefox.png", await driver.takeScreenshot(), "base64");
    let archives = [];
    for (let n = 0; n < 20; n++) { archives = (await fs.readdir(downloads)).filter(n => n.endsWith(".zip")); if (archives.length) break; await wait(500); }
    assert.equal(archives.length, 1);
    const reader = new zip.ZipReader(new zip.Uint8ArrayReader(await fs.readFile(path.join(downloads, archives[0]))));
    const entries = await reader.getEntries();
    const csv = await entries.find(e => e.filename === "mensagens.csv").getData(new zip.TextWriter());
    assert.match(csv, /participante_0001/); assert.match(csv, /https:\/\/example.com\/message\/26\?a=1&b=2/); assert.match(csv, /MID-000001/); assert.match(csv, /"3405","exata"/); assert.doesNotMatch(csv, /"Ana"/);
    assert.ok(entries.some(e => e.filename === "mensagens.xlsx"));
    assert.ok(!entries.some(e => e.filename === "relatorio_coleta.json" || e.filename === "indice_midias.json"));
    const xlsx = new zip.ZipReader(new zip.Uint8ArrayReader(await entries.find(e => e.filename === "mensagens.xlsx").getData(new zip.Uint8ArrayWriter())));
    const workbookEntries = await xlsx.getEntries();
    const sheet = await workbookEntries.find(e => e.filename === "xl/worksheets/sheet2.xml").getData(new zip.TextWriter());
    assert.match(sheet, /participante_0001/); assert.match(sheet, /MID-000001/); assert.match(sheet, /<v>3405<\/v>/); assert.match(sheet, /<autoFilter /); assert.doesNotMatch(sheet, /<f[ >]/);
    await xlsx.close();
    const report = JSON.parse(await entries.find(e => e.filename === ".system/relatorio_coleta.json").getData(new zip.TextWriter()));
    for (const file of report.arquivos) { assert.match(file.midia_id, /^MID-\d{6}$/); assert.ok(file.arquivo.startsWith("midias/" + file.midia_id)); assert.ok(csv.includes(file.arquivo)); }
    assert.equal(report.registros_vazios_nao_contados, 1);
    assert.equal(report.mensagens, 35); assert.equal(report.midias_obtidas, 6); assert.equal(report.midias_com_falha, 1);
    assert.equal(report.arquivos.find(a => a.mensagem_id === "fixture-7").origem_captura, "api_wa_js");
    assert.equal(report.arquivos.find(a => a.mensagem_id === "fixture-26").origem_captura, "api_wa_js");
    assert.ok(report.arquivos.some(a => a.origem_captura === "download_visualizador"));
    for (const entry of entries.filter(e => e.filename.startsWith("midias/") && !e.directory)) assert.match(await entry.getData(new zip.TextWriter()), /^ORIGINAL-/);
    await reader.close();
    await driver.switchTo().window(fixtureTab); await driver.get(origin + "/channel");
    await driver.switchTo().window(panelTab);
    const channel = await call("inspect"); assert.equal(channel.conversation.type, "canal");
    assert.equal((await call("start", { options: { media: false, workbook: true, pseudonymize: false, destination: "zip", start: "", end: "" } })).ok, true);
    for (let n=0;n<20;n++) { const started=(await call("state")).state; if(started.job.count>0)break; await wait(200); }
    assert.equal((await call("stop")).ok, true);
    let partial;
    for (let n = 0; n < 25; n++) { partial = (await call("state")).state; if (partial.job.status === "interrupted" && !partial.exportBusy) break; await wait(500); }
    assert.equal(partial.job.reason, "interrompida_pelo_usuario"); assert.ok(partial.job.count > 0 && partial.job.count < 35); assert.equal(partial.job.mediaCount, 0);
    assert.equal((await call("restore")).ok, true); assert.equal((await call("state")).state.job.count, partial.job.count);
    for (let n = 0; n < 20; n++) { archives = (await fs.readdir(downloads)).filter(n => n.endsWith(".zip")); if (archives.length === 2) break; await wait(500); }
    assert.equal(archives.length, 2);
    const partialArchive = archives.find(name => name !== archives.find(name => name.includes("Grupo")));
    const partialReader = new zip.ZipReader(new zip.Uint8ArrayReader(await fs.readFile(path.join(downloads, partialArchive))));
    const partialEntries = await partialReader.getEntries();
    assert.ok(partialEntries.some(e => e.filename === "mensagens.xlsx"));
    const partialReport = JSON.parse(await partialEntries.find(e => e.filename === ".system/relatorio_coleta.json").getData(new zip.TextWriter()));
    assert.equal(partialReport.motivo_termino, "interrompida_pelo_usuario");
    assert.equal(partialReport.mensagens, partial.job.count);
    const partialCsv = await partialEntries.find(e => e.filename === "mensagens.csv").getData(new zip.TextWriter());
    assert.match(partialCsv, /Mensagem 29 via API/);
    assert.match(partialCsv, /https:\/\/whatsapp\.com\/channel\/0029Vb8kT6E3AzNNDpBkN22J\/2\d\d/);
    await partialReader.close();
    const previousArchives = new Set(archives);
    await driver.switchTo().window(fixtureTab); await driver.get(origin + "/channel");
    await driver.executeScript("window.originalActiveChat=WPP.chat.getActiveChat;WPP.chat.getActiveChat=()=>{const chat=window.originalActiveChat();const models=chat.msgs.getModelsArray();chat.msgs.getModelsArray=()=>models.map(m=>m.id.id==='fixture-29'?{...m,t:undefined,body:''}:m);return chat;}");
    await driver.switchTo().window(panelTab);
    assert.equal((await call("start", { options: { media: false, workbook: false, pseudonymize: false, destination: "zip", start: "", end: "" } })).ok, true);
    let guarded;
    for(let n=0;n<150;n++){guarded=(await call("state")).state;assert.notEqual(guarded.job.status,'paused','Um metadado ausente não deve exigir Continuar');if(guarded.job.status==='finished'&&!guarded.exportBusy)break;await wait(1000);}
    assert.equal(guarded.job.status,'finished'); assert.equal(guarded.job.count,35);assert.equal(guarded.job.incompleteCount,1);
    assert.match(guarded.job.notice,/campos não recuperados/);
    for(let n=0;n<20;n++){archives=(await fs.readdir(downloads)).filter(n=>n.endsWith('.zip'));if(archives.length===3)break;await wait(250);}
    assert.equal(archives.length,3);
    const resumedArchive=archives.find(name=>!previousArchives.has(name));
    const resumedReader=new zip.ZipReader(new zip.Uint8ArrayReader(await fs.readFile(path.join(downloads,resumedArchive))));
    const resumedEntries=await resumedReader.getEntries();assert.ok(!resumedEntries.some(e=>e.filename==='mensagens.xlsx'));
    const pendingCsv=await resumedEntries.find(e=>e.filename==='mensagens.csv').getData(new zip.TextWriter());
    assert.match(pendingCsv,/"incompleta","data_hora \| texto"/);
    const pendingReport=JSON.parse(await resumedEntries.find(e=>e.filename==='.system/relatorio_coleta.json').getData(new zip.TextWriter()));
    assert.equal(pendingReport.mensagens_incompletas,1);assert.ok(pendingReport.falhas.some(f=>f.etapa==='metadados'&&f.mensagem_id==='fixture-29'));await resumedReader.close();
    // Monitor captures only posts appended after activation, retaining rational media IDs.
    await driver.switchTo().window(fixtureTab); await driver.get(origin + "/channel");
    await driver.switchTo().window(panelTab);
    assert.equal((await call("start", { options: { mode: "monitor", destination: "zip", media: true, localLimitMB: 128 } })).ok, true);
    await wait(1200); let monitored = (await call("state")).state; assert.equal(monitored.job.count, 0);
    assert.equal(monitored.job.monitorBaseline, 235);
    await driver.switchTo().window(fixtureTab);
    await driver.executeScript(`window.originalMonitorChat=WPP.chat.getActiveChat;window.newPosts=[{id:{id:'live-text',toString:()=> 'live-text'},type:'chat',body:'Texto novo https://example.org/pesquisa',t:Date.now()/1000,serverId:236},{id:{id:'live-photo',toString:()=> 'live-photo'},type:'image',caption:'Foto nova',t:Date.now()/1000,serverId:237,mediaData:{}}];const liveRow=document.createElement('div');liveRow.className='message-in';liveRow.dataset.id='live-text';liveRow.innerHTML='<span class="selectable-text">Texto novo</span><button aria-label="Reações: 3 no total">3</button>';document.querySelector('.box').append(liveRow);WPP.chat.getActiveChat=()=>{const chat=window.originalMonitorChat();const old=chat.msgs.getModelsArray().filter(m=>!m.id.id.startsWith('live-'));chat.msgs.getModelsArray=()=>[...old,...window.newPosts];return chat;};`);
    await driver.switchTo().window(panelTab);
    for(let n=0;n<30;n++){monitored=(await call("state")).state;if(monitored.job.count===2)break;await wait(500);}
    assert.equal(monitored.job.status,'running',JSON.stringify(monitored));assert.equal(monitored.job.count,2);assert.equal(monitored.job.mediaCount,1);assert.equal(monitored.job.monitorCursor,237);
    await wait(5500);assert.equal((await call("state")).state.job.count,2);
    await driver.switchTo().window(fixtureTab);await driver.executeScript("window.newPosts[0].body='Texto atualizado https://example.org/pesquisa';document.querySelector('[data-id=live-text] button').setAttribute('aria-label','Reações: 8 no total')");
    await driver.switchTo().window(panelTab);await wait(5500);assert.equal((await call("state")).state.job.count,2);
    assert.equal((await call("pause")).ok,true);assert.equal((await call("resume")).ok,true);
    await driver.switchTo().window(fixtureTab);
    await driver.executeScript("window.newPosts.push({id:{id:'live-big',toString:()=> 'live-big'},type:'video',t:Date.now()/1000,serverId:238,mediaData:{}});const origDownload=WPP.chat.downloadMedia;WPP.chat.downloadMedia=async id=>{if(id!=='live-big')return origDownload(id);const blob=new Blob(['x']);Object.defineProperty(blob,'size',{value:268435457});return blob;};");
    await driver.switchTo().window(panelTab);
    for(let n=0;n<30;n++){monitored=(await call("state")).state;if(monitored.job.status==='paused')break;await wait(500);}
    assert.equal(monitored.job.status,'paused');assert.equal(monitored.job.count,2);assert.equal(monitored.job.monitorCursor,237);assert.equal(monitored.job.mediaFailures,0);assert.match(monitored.job.notice,/Limite local/);
    assert.equal((await call("stop")).ok,true);
    for(let n=0;n<30;n++){monitored=(await call("state")).state;if(monitored.job.status==='interrupted'&&!monitored.exportBusy)break;await wait(500);}
    assert.equal(monitored.job.count,2);assert.equal(monitored.job.mediaCount,1);
    for(let n=0;n<20;n++){archives=(await fs.readdir(downloads)).filter(n=>n.endsWith('.zip'));if(archives.length===4)break;await wait(250);}
    const liveArchive=archives.find(name=>!previousArchives.has(name)&&name!==resumedArchive);
    const liveReader=new zip.ZipReader(new zip.Uint8ArrayReader(await fs.readFile(path.join(downloads,liveArchive))));
    const liveEntries=await liveReader.getEntries(),liveCsv=await liveEntries.find(e=>e.filename==='mensagens.csv').getData(new zip.TextWriter());
    assert.match(liveCsv,/Texto atualizado/);assert.match(liveCsv,/"8","exata"/);assert.match(liveCsv,/Foto nova/);assert.match(liveCsv,/https:\/\/whatsapp.com\/channel\/0029Vb8kT6E3AzNNDpBkN22J\/237/);assert.match(liveCsv,/MID-000001/);assert.doesNotMatch(liveCsv,/Mensagem 29/);assert.equal(liveEntries.filter(e=>e.filename.startsWith('midias/')).length,1);await liveReader.close();
    await fs.writeFile("docs/firefox-fixture-result.json", JSON.stringify({ extensionVersion: manifest.version, browser: (await driver.getCapabilities()).get("browserVersion"), fixture: "grupo e canal sintéticos locais; API WPP simulada; não WhatsApp real", messages: state.job.count, media: state.job.mediaCount, failures: state.job.mediaFailures, partialChannelMessages: partial.job.count, monitorMessages: monitored.job.count, monitorMedia: monitored.job.mediaCount, checked: ["monitoramento exclui histórico, captura texto e foto, atualiza texto e reações sem duplicar, pausa por tamanho sem avançar cursor e exporta", "instalação temporária", "painel", "rolagem com sobreposição", "pausa", "troca de conversa", "retomada", "API de sessão simulada em MAIN", "download original via hook Firefox como fallback", "foto Abrir imagem", "álbum com dois arquivos idênticos e IDs distintos", "links no CSV", "total de interações no CSV", "associação MID no CSV/índice/arquivo", "diagnóstico antes e depois da coleta", "ZIP real", "XLSX opcional com filtros e tipos numéricos", "JSONs em .system", "links permanentes de canal pela API simulada", "texto e data ausentes no DOM recuperados pela API", "contêiner vazio não contado", "metadado indisponível não exige Continuar; 35 registros e 1 pendência explícita", "exportação padrão sem XLSX", "rolagem avança por mais de oito ciclos com IDs inalterados", "pseudônimos", "canal", "encerramento parcial", "recuperação do IndexedDB"], overrides: ["origem local da fixture", "saveAs=false para evitar diálogo nativo"], passed: true }, null, 2));
    console.log("PASS: Firefox real, grupo com 35 mensagens/6 mídias/1 falha; canal parcial, ZIP e pausa/retomada.");
  } finally { if (driver) await driver.quit(); server.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
