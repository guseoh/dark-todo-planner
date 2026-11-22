import { access, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const config = JSON.parse(await readFile(new URL("../src-tauri/tauri.conf.json", import.meta.url), "utf8"));
const { productName, version } = config;
const output = resolve(process.env.CARGO_TARGET_DIR || "src-tauri/target", "release/bundle/nsis");
const installer = `${productName}_${version}_x64-setup.exe`;
await access(resolve(output, installer));
const signature = (await readFile(resolve(output, `${installer}.sig`), "utf8")).trim();
const signedComment = Buffer.from(signature, "base64").toString("utf8")
  .split(/\r?\n/).find((line) => line.startsWith("trusted comment:"));
if (!signedComment?.split(/\s+/).includes(`version:${version}`)) {
  throw new Error(`The Tern installer signature must bind the version ${version}.`);
}

const [endpoint] = config.plugins.updater.endpoints;
const url = new URL(`../../download/tern-v${version}/${encodeURIComponent(installer)}`, endpoint);
const manifest = {
  version,
  platforms: {
    "windows-x86_64": { signature, url: url.href },
  },
};
await writeFile(resolve(output, "latest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Tern update manifest: ${resolve(output, "latest.json")}`);
