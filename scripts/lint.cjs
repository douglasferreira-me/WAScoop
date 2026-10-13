// Firefox desktop only. Android warnings are documented, never hidden
// behind a generic warning filter; all other notices/warnings fail this check.
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const result = spawnSync(process.execPath, [path.resolve("node_modules/web-ext/bin/web-ext.js"), "lint", "--source-dir", "extension", "--output", "json", "--no-config-discovery"], { encoding: "utf8", env: { ...process.env, NO_UPDATE_NOTIFIER: "1" } });
let report;
try { report = JSON.parse(result.stdout); }
catch { console.error(result.stdout, result.stderr); process.exit(1); }
const errors = report.errors || [], warnings = report.warnings || [], notices = report.notices || [];
const androidCodes = new Set(["ANDROID_INCOMPATIBLE_API", "KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION"]);
const desktopOnly = warnings.filter(w => androidCodes.has(w.code));
const actionable = warnings.filter(w => !androidCodes.has(w.code));
console.log(`Firefox desktop: ${errors.length} erros, ${actionable.length} avisos, ${notices.length} observações.`);
if (desktopOnly.length) console.log(`Compatibilidade: ${desktopOnly.length} aviso(s) Android esperado(s); esta extensão é somente para Firefox desktop.`);
for (const item of [...errors, ...actionable, ...notices]) console.error(item);
if (errors.length || actionable.length || notices.length || result.error) process.exit(1);
