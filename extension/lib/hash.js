import { sha256 } from "../vendor/noble/sha2.js";
export async function hashBlob(blob) {
  const hash = sha256.create();
  for (let offset = 0; offset < blob.size; offset += 1024 * 1024) hash.update(new Uint8Array(await blob.slice(offset, offset + 1024 * 1024).arrayBuffer()));
  return Array.from(hash.digest(), b => b.toString(16).padStart(2, "0")).join("");
}
