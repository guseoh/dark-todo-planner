import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Unknown files are conservatively treated as shared; only known docs are skipped.
export function classify(paths) {
  const result = { code: false, backend: false, crypto: false, audit: false, desktop: false };
  const all = () => Object.keys(result).forEach(key => { result[key] = true; });
  for (const path of paths) {
    if (!path) continue;
    if (/^(docs\/|README\.md$|design\.md$)/.test(path)) continue;
    result.code = true;
    if (/^(src\/|src-tauri\/|public\/|fonts-src\/|index\.html$|vite\.config\.ts$|tailwind\.config\.ts$|postcss\.config\.js$)/.test(path)) {
      result.desktop = true;
    } else if (/^(worker\/|migrations\/|wrangler\.jsonc$|drizzle\.config\.ts$|tests\/|scripts\/smoke-local-api\.mjs$|scripts\/prepare-smoke-auth\.mjs$)/.test(path)) {
      result.backend = true;
      if (/^(worker\/|migrations\/)/.test(path)) result.crypto = true;
    } else if (/^scripts\/(backup-d1|d1-backup-)/.test(path)) {
      result.crypto = true;
    } else if (/^scripts\/prepare-desktop-release/.test(path)) {
      result.desktop = true;
    } else if (/^scripts\/(smoke-browser|smoke-ui-v2-g5)\.mjs$/.test(path)) {
      result.desktop = true;
      result.backend = true;
    } else {
      all();
    }
  }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { EVENT_NAME, BASE_SHA, HEAD_SHA, GITHUB_OUTPUT } = process.env;
  let paths;
  if (EVENT_NAME !== "pull_request") {
    paths = ["__full_validation__"];
  } else {
    if (!/^[a-f0-9]{40}$/.test(BASE_SHA || "") || !/^[a-f0-9]{40}$/.test(HEAD_SHA || "")) {
      throw new Error("Missing or invalid PR commit range");
    }
    paths = execFileSync("git", ["diff", "--no-renames", "--name-only", "-z", BASE_SHA + "..." + HEAD_SHA], { encoding: "utf8" }).split("\0");
  }
  const scope = classify(paths);
  appendFileSync(GITHUB_OUTPUT, Object.entries(scope).map(([key, value]) => key + "=" + value + "\n").join(""));
  console.log("CI scope:", JSON.stringify(scope));
}
