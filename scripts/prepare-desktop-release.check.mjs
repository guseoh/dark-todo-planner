import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { compareVersions, readReleaseVersion, requireNewerRelease } from "./prepare-desktop-release.mjs";

const script = resolve("scripts/prepare-desktop-release.mjs");
const config = resolve("src-tauri/tauri.conf.json");
const cargo = resolve("src-tauri/Cargo.toml");
const lock = resolve("src-tauri/Cargo.lock");

function execute(publicKey, override) {
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
        TERN_VERSION: override ?? readReleaseVersion(),
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
  assert.equal(result.config.version, readReleaseVersion());
  assert.equal(result.config.plugins.updater.pubkey, pubkey);
  assert.equal(result.cargo, readFileSync(cargo, "utf8"));
  assert.equal(result.lock, readFileSync(lock, "utf8"));
});

test("raw RW line is rejected, never silently substituted as a Tauri CLI key", () => {
  const result = execute("RW" + "A".repeat(50));
  assert.notEqual(result.processResult.status, 0);
  assert.equal(result.config.plugins.updater.pubkey, "__TAURI_UPDATER_PUBLIC_KEY__");
});

test("explicit stable SemVer increases independently of CI run numbers", () => {
  assert.equal(compareVersions("0.4.0", "0.3.9"), 1);
  assert.equal(compareVersions("0.4.10", "0.4.9"), 1);
  assert.equal(compareVersions("0.4.0", "0.4.0"), 0);
  assert.equal(compareVersions("0.3.9", "0.4.0"), -1);
  assert.doesNotThrow(() => requireNewerRelease("0.4.0", "tern-v0.3.9"));
  for (const version of ["0.4.0", "0.3.9", "0.04.1", "0.5.0-rc.1"]) assert.throws(() => requireNewerRelease(version, "tern-v0.4.0"));
  assert.throws(() => requireNewerRelease("0.4.1", "other-v0.4.0"));
});
test("environment variable cannot override the committed version", () => {
  const result = execute(Buffer.from("untrusted comment: minisign public key: TEST-ONLY\nRW" + "A".repeat(50) + "\n").toString("base64"), "9.9.9");
  assert.notEqual(result.processResult.status, 0);
  assert.equal(result.config.plugins.updater.pubkey, "__TAURI_UPDATER_PUBLIC_KEY__");
});
