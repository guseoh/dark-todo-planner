import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

const script = resolve("scripts/prepare-desktop-release.mjs");
const config = resolve("src-tauri/tauri.conf.json");
const cargo = resolve("src-tauri/Cargo.toml");
const lock = resolve("src-tauri/Cargo.lock");

function execute(publicKey) {
  const temp = mkdtempSync(join(tmpdir(), "tern-release-preflight-"));
  try {
    mkdirSync(join(temp, "src-tauri"));
    copyFileSync(config, join(temp, "src-tauri/tauri.conf.json"));
    copyFileSync(cargo, join(temp, "src-tauri/Cargo.toml"));
    copyFileSync(lock, join(temp, "src-tauri/Cargo.lock"));
    const processResult = spawnSync(process.execPath, [script], {
      cwd: temp,
      encoding: "utf8",
      env: {
        ...process.env,
        TERN_VERSION: "0.3.812",
        TERN_UPDATER_PUBLIC_KEY: publicKey,
        TAURI_SIGNING_PRIVATE_KEY: "TEST-ONLY-NOT-A-REAL-KEY",
      },
    });
    return {
      processResult,
      config: JSON.parse(readFileSync(join(temp, "src-tauri/tauri.conf.json"), "utf8")),
      cargo: readFileSync(join(temp, "src-tauri/Cargo.toml"), "utf8"),
      lock: readFileSync(join(temp, "src-tauri/Cargo.lock"), "utf8"),
    };
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

test("Tauri CLI encoded minisign public key and version are accepted", () => {
  const document = "untrusted comment: minisign public key: TEST-ONLY\nRW" + "A".repeat(50) + "\n";
  const pubkey = Buffer.from(document, "utf8").toString("base64");
  const result = execute(pubkey);
  assert.equal(result.processResult.status, 0, result.processResult.stderr);
  assert.equal(result.config.version, "0.3.812");
  assert.equal(result.config.plugins.updater.pubkey, pubkey);
  assert.match(result.cargo, /^version = "0\.3\.812"$/m);
  const original = readFileSync(lock, "utf8");
  assert.equal(result.lock, original.replace(/(^\[\[package\]\]\r?\nname = "tern"\r?\nversion = ")0\.3\.0(")/m, (_, prefix, suffix) => prefix + "0.3.812" + suffix));
});

test("raw RW line is rejected, never silently substituted as a Tauri CLI key", () => {
  const result = execute("RW" + "A".repeat(50));
  assert.notEqual(result.processResult.status, 0);
  assert.equal(result.config.plugins.updater.pubkey, "__TAURI_UPDATER_PUBLIC_KEY__");
});
