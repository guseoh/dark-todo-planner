import { readFileSync, writeFileSync } from "node:fs";

const version = process.env.TERN_VERSION?.trim();
const publicKey = process.env.TERN_UPDATER_PUBLIC_KEY?.trim();
const privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY?.trim();

if (!version || !/^0\.3\.[1-9]\d*$/.test(version)) {
  throw new Error("TERN_VERSION must be a monotonically increasing 0.3.<run_number> version.");
}
if (!publicKey || !privateKey) {
  throw new Error("Signed Windows releases require TERN_UPDATER_PUBLIC_KEY and TAURI_SIGNING_PRIVATE_KEY secrets.");
}
// Tauri's minisign public key is an RW-prefixed base64 line, optionally
// preceded by the generated .pub file's untrusted comment.
if (!/(^|\n)RW[A-Za-z0-9+/=]+$/.test(publicKey)) {
  throw new Error("TERN_UPDATER_PUBLIC_KEY does not look like a Tauri minisign public key.");
}
const path = "src-tauri/tauri.conf.json";
const conf = JSON.parse(readFileSync(path, "utf8"));
if (conf.productName !== "Tern" || conf.plugins?.updater?.pubkey !== "__TAURI_UPDATER_PUBLIC_KEY__") {
  throw new Error("Unexpected Tauri configuration; refusing to overwrite a key or product name.");
}
conf.version = version;
conf.plugins.updater.pubkey = publicKey;
writeFileSync(path, JSON.stringify(conf, null, 2) + "\n");
console.log("Prepared signed Tern release", version, "(public key injected; private key never written).");
