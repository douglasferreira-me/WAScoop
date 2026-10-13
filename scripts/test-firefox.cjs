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
function render(){box.innerHTML='<div style="height:'+(start?1400:0)+'px"></div>';for(let i=start;i<Math.min(35,start+15);i++){const row=document.createElement('div');row.className='row';row.dataset.id='fixture-'+i;let body='<div data-pre-plain-text="[09:'+String(i).padStart(2,'0')+', 10/10/2026] Ana: "><span class="selectable-text">Mensagem '+i+', &quot;pesquisa&quot; 🧪</span></div>';const type=types[i];if(type==='audio'||type==='video'){body+='<'+type+' src="'+URL.createObjectURL(new Blob(['ORIGINAL-'+i],{type:type==='audio'?'audio/mpeg':'video/mp4'}))+'"></'+type+'>';}else if(type==='documento'){body+='<button data-testid="document"><span data-icon="document">Documento</span></button>';}else if(type){body+='<button aria-label="Abrir imagem"><img alt="'+(type==='figurinha'?'figurinha':'foto')+'" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></button>';}if(i===26)body+='<button aria-label="Abrir imagem"><img alt="segunda foto" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"></button>';body+='<button aria-label="Reações 👍, ❤, 3.405 no total. Mostrar reações">3,4 mil</button>';body+='<a href="https://example.com/message/'+i+'?a=1&amp;b=2">Fonte</a>';row.innerHTML=body;row.querySelectorAll('button:not([aria-label^="Reações"])').forEach(b=>b.addEventListener('click',()=>viewer(i)));box.append(row);}}
window.WPP={isReady:true,chat:{getActiveChat:()=>({name:document.querySelector('header span[title]').title,msgs:{getModelsArray:()=>Array.from(document.querySelectorAll('[data-id]')).map(r=>({id:{id:r.dataset.id,toString:()=>r.dataset.id},mediaData:types[Number(r.dataset.id.split('-')[1])] ? {} : null}))}}),downloadMedia:async id=>{const i=Number(id.split('-')[1]);if(i===0)throw new Error('deliberately unavailable');return new Blob(['ORIGINAL-'+i],{type:i===17?'application/pdf':i===7?'audio/mpeg':i===3?'video/mp4':'image/png'});}}};
render();box.scrollTop=box.scrollHeight;box.addEventListener('scroll',()=>{if(start>0&&box.scrollTop<900){start=Math.max(0,start-10);render();box.scrollTop=start?1100:0;}});
</script></body></html>`;
const wait = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  if (!process.env.FIREFOX_BIN || !process.env.GECKODRIVER_BIN) throw new Error("Defina FIREFOX_BIN e GECKODRIVER_BIN para os binários oficiais da Mozilla.");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wascoop-test-")), source = path.join(root, "extension"), downloads = path.join(root, "downloads");
  await fs.mkdir(downloads); await fs.cp("extension", source, { recursive: true });
  const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" }); res.end(req.url.includes("channel") ? fixture.replaceAll("Grupo sintético", "Canal sintético").replace("<header>", "<header><span>100 seguidores</span>") : fixture); });
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
  const uuid = "94173b9f-33c7-4468-9a24-a31c506cad61";
  const options = new firefox.Options().setBinary(process.env.FIREFOX_BIN).addArguments("-headless").setPreference("extensions.webextensions.uuids", JSON.stringify({ [manifest.browser_specific_settings.gecko.id]: uuid })).setPreference("browser.download.folderList", 2).setPreference("browser.download.dir", downloads).setPreference("browser.download.useDownloadDir", true).setPreference("browser.download.alwaysOpenPanel", false);
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
    for (let n = 0; n < 75; n++) {
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
    await partialReader.close();
    await fs.writeFile("docs/firefox-fixture-result.json", JSON.stringify({ extensionVersion: manifest.version, browser: (await driver.getCapabilities()).get("browserVersion"), fixture: "grupo e canal sintéticos locais; API WPP simulada; não WhatsApp real", messages: state.job.count, media: state.job.mediaCount, failures: state.job.mediaFailures, partialChannelMessages: partial.job.count, checked: ["instalação temporária", "painel", "rolagem com sobreposição", "pausa", "troca de conversa", "retomada", "API de sessão simulada em MAIN", "download original via hook Firefox como fallback", "foto Abrir imagem", "álbum com dois arquivos idênticos e IDs distintos", "links no CSV", "total de interações no CSV", "associação MID no CSV/índice/arquivo", "diagnóstico antes e depois da coleta", "ZIP real", "XLSX opcional com filtros e tipos numéricos", "JSONs em .system", "pseudônimos", "canal", "encerramento parcial", "recuperação do IndexedDB"], overrides: ["origem local da fixture", "saveAs=false para evitar diálogo nativo"], passed: true }, null, 2));
    console.log("PASS: Firefox real, grupo com 35 mensagens/6 mídias/1 falha; canal parcial, ZIP e pausa/retomada.");
  } finally { if (driver) await driver.quit(); server.close(); await fs.rm(root, { recursive: true, force: true }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
