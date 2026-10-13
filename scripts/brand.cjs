// Render our editable SVG into deterministic, font-free raster assets.
const { Resvg } = require("@resvg/resvg-js");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "extension/icons/scoop.svg"));
for (const size of [16, 32, 48, 96, 128, 256, 512]) {
  const png = new Resvg(source, { fitTo: { mode: "width", value: size }, font: { loadSystemFonts: false } }).render().asPng();
  fs.writeFileSync(path.join(root, `extension/icons/scoop-${size}.png`), png);
}
fs.mkdirSync(path.join(root, "docs/branding"), { recursive: true });
fs.copyFileSync(path.join(root, "extension/icons/scoop-512.png"), path.join(root, "docs/branding/logo.png"));
console.log("Logo e ícones gerados a partir do SVG original.");
