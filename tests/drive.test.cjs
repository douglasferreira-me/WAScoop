const { test } = require("node:test");
const assert = require("node:assert/strict");
const { importFile } = require("./helpers.cjs");
const response = (status, body = {}, headers = {}) => new Response(JSON.stringify(body), { status, headers });
test("Drive autenticação negada pausa; erros transitórios têm tentativas limitadas", async () => {
  const { Drive, AuthRequired } = await importFile("lib/drive.js");
  let calls = 0;
  const d = new Drive({ identity: {}, tokenProvider: () => "test", sleeper: async () => {}, fetcher: async () => { calls++; return response(503); } });
  await assert.rejects(d.folder("Teste"), /503/); assert.equal(calls, 4);
  const denied = new Drive({ identity: {}, tokenProvider: () => "test", fetcher: async () => response(401) });
  await assert.rejects(denied.folder("Teste"), AuthRequired);
  await assert.rejects(d.request("https://outro.site/upload"), /Destino/);
});
test("upload retomável reconcilia posição e preserva associação", async () => {
  const { Drive } = await importFile("lib/drive.js");
  const url = "https://www.googleapis.com/upload/session", calls = [];
  const d = new Drive({ identity: {}, tokenProvider: () => "test", fetcher: async (target, init) => {
    calls.push({ target, range: init.headers["Content-Range"], body: init.body });
    if (init.headers["Content-Range"] === "bytes */6") return response(308, {}, { Range: "bytes=0-2" });
    assert.equal(init.headers["Content-Range"], "bytes 3-5/6"); return response(200, { id: "file1" });
  } });
  const result = await d.upload("a.bin", new Blob(["abcdef"]), "folder1", () => {}, url);
  assert.equal(result.id, "file1"); assert.equal(calls.length, 2); assert.equal(await calls[1].body.text(), "def");
});
test("criação de sessão e dois blocos de mídia sem perda", async () => {
  const { Drive } = await importFile("lib/drive.js");
  let puts = 0, stored;
  const d = new Drive({ identity: {}, tokenProvider: () => "test", fetcher: async (url, init) => {
    if (init.method === "POST") { assert.deepEqual(JSON.parse(init.body).parents, ["folder1"]); return response(200, {}, { Location: "https://www.googleapis.com/upload/session" }); }
    puts++; if (puts === 1) return response(308, {}, { Range: "bytes=0-1048575" }); return response(200, { id: "media1" });
  } });
  const result = await d.upload("video.mp4", new Blob([new Uint8Array(1048580)]), "folder1", () => {}, null, async url => { stored = url; });
  assert.equal(result.id, "media1"); assert.equal(puts, 2); assert.match(stored, /googleapis/);
});
test("OAuth valida state e audiência antes de aceitar token", async () => {
  const { Drive } = await importFile("lib/drive.js");
  const client = "123-test.apps.googleusercontent.com", redirect = "https://id.extensions.allizom.org/";
  const identity = { getRedirectURL: () => redirect, launchWebAuthFlow: async ({ url }) => { const q = new URL(url).searchParams; return `${redirect}#state=${q.get("state")}&access_token=abc&expires_in=3600`; } };
  const d = new Drive({ identity, clock: () => 1000, fetcher: async () => response(200, { aud: client, scope: "https://www.googleapis.com/auth/drive.file", expires_in: "3600" }) });
  await d.connect(client); assert.ok(d.connected()); d.disconnect(); assert.equal(d.connected(), false);
  const wrong = new Drive({ identity: { ...identity, launchWebAuthFlow: async () => `${redirect}#state=wrong&access_token=abc` } });
  await assert.rejects(wrong.connect(client), /inválida/);
});
