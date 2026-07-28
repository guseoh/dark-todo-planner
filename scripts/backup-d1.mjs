import { randomUUID } from "node:crypto";
import { mkdir, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const allowedEnvironments = new Set(["preview", "production"]);
const environment = process.argv[2];

if (!allowedEnvironments.has(environment) || process.argv.length !== 3) {
  console.error("Usage: node scripts/backup-d1.mjs <preview|production>");
  process.exit(1);
}

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const timestamp = new Date().toISOString().replace(/:/g, "-");
const uniqueSuffix = randomUUID().slice(0, 8);
const outputPath = resolve(repositoryRoot, "backups", "d1", environment, `${timestamp}-${uniqueSuffix}.sql`);
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const exportArguments = ["wrangler", "d1", "export", "DB", "--env", environment, "--remote", "--skip-confirmation"];

if (process.platform === "win32") exportArguments.push(`--output="${outputPath}"`);
else exportArguments.push("--output", outputPath);

await mkdir(dirname(outputPath), { recursive: true });

const result = spawnSync(
  npxCommand,
  exportArguments,
  { cwd: repositoryRoot, shell: process.platform === "win32", stdio: "inherit" },
);

if (result.error || result.status !== 0) {
  await rm(outputPath, { force: true });
  if (result.error) console.error(`Failed to run ${npxCommand}: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

let outputStats;
try {
  outputStats = await stat(outputPath);
} catch {
  console.error(`D1 export completed without creating ${outputPath}`);
  process.exit(1);
}

if (!outputStats.isFile() || outputStats.size === 0) {
  await rm(outputPath, { force: true });
  console.error(`D1 export created an empty file: ${outputPath}`);
  process.exit(1);
}

console.log(`D1 ${environment} backup written to ${outputPath}`);
