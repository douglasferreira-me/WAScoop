#!/usr/bin/env python3
"""Reproducible Firefox packages. Python is only needed by maintainers."""
from pathlib import Path
import hashlib
import json
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXT = ROOT / "extension"
DIST = ROOT / "dist"
STAMP = (2026, 1, 1, 0, 0, 0)

def archive(target, paths, base):
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for path in sorted(paths):
            info = zipfile.ZipInfo(path.relative_to(base).as_posix(), date_time=STAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            package.writestr(info, path.read_bytes())

def main():
    dependency = ROOT / "node_modules/@zip.js/zip.js"
    if not dependency.exists():
        raise SystemExit("Execute npm ci antes de empacotar.")
    subprocess.run(["node", str(ROOT / "scripts/brand.cjs")], check=True, cwd=ROOT)
    vendor = EXT / "vendor"
    vendor.mkdir(exist_ok=True)
    shutil.copyfile(dependency / "dist/zip-native.js", vendor / "zip.js")
    shutil.copyfile(dependency / "LICENSE", vendor / "LICENSE.zipjs")
    api_dependency = ROOT / "node_modules/@wppconnect/wa-js"
    if not api_dependency.exists():
        raise SystemExit("Execute npm ci para obter a biblioteca WA-JS.")
    # The upstream universal bundle includes an unused Node-only stream path.
    # Remove its eval(require) rather than allowing unsafe-eval in the add-on.
    api_source = (api_dependency / "dist/wppconnect-wa.js").read_text()
    node_stream = 'eval("require")("stream")'
    if api_source.count(node_stream) != 1:
        raise SystemExit("Mudou o bundle WA-JS: revisar a adaptação da variante navegador.")
    api_source = api_source.replace(node_stream, '(()=>{throw new Error("Node streams unavailable in browser")})()')
    (vendor / "wppconnect-wa.js").write_text(api_source)
    shutil.copyfile(api_dependency / "LICENSE", vendor / "LICENSE.wajs")
    hashes = ROOT / "node_modules/@noble/hashes"
    (vendor / "noble").mkdir(exist_ok=True)
    for name in ["sha2.js", "_md.js", "_u64.js", "utils.js", "LICENSE"]:
        shutil.copyfile(hashes / name, vendor / "noble" / name)
    version = json.loads((EXT / "manifest.json").read_text())["version"]
    DIST.mkdir(exist_ok=True)
    folder = DIST / "whatsapp-scoop-temporario"
    if folder.exists():
        shutil.rmtree(folder)
    shutil.copytree(EXT, folder)
    files = [p for p in EXT.rglob("*") if p.is_file()]
    archive(DIST / f"whatsapp-scoop-{version}-temporario.zip", files, EXT)
    archive(DIST / f"whatsapp-scoop-{version}-nao-assinado.xpi", files, EXT)
    sources = [p for name in ["extension", "scripts", "tests", "docs"] for p in (ROOT / name).rglob("*") if p.is_file() and "__pycache__" not in p.parts]
    sources += [ROOT / name for name in ["README.md", "README.en.md", "LICENSE", "package.json", "package-lock.json", ".gitignore", ".gitattributes"] if (ROOT / name).exists()]
    sources += [p for p in (ROOT / ".github").rglob("*") if p.is_file()]
    archive(DIST / f"whatsapp-scoop-{version}-codigo-fonte.zip", sources, ROOT)
    hashes = []
    for p in sorted(DIST.glob(f"whatsapp-scoop-{version}-*")):
        if p.is_file() and p.suffix in [".zip", ".xpi"]:
            hashes.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}")
    (DIST / "SHA256SUMS.txt").write_text("\n".join(hashes) + "\n")
    print(f"Pacotes {version} disponíveis em {DIST}")

if __name__ == "__main__":
    main()
