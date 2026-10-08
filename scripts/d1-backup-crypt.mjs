import { readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { decryptD1Buffer, encryptD1Buffer, parseD1BackupKey } from "./d1-backup-crypto.mjs";

const [, , mode, inputArgument, outputArgument] = process.argv;
if (!["encrypt", "decrypt"].includes(mode) || !inputArgument || !outputArgument || process.argv.length !== 5) {
  console.error("Usage: node scripts/d1-backup-crypt.mjs <encrypt|decrypt> <input> <output>");
  process.exit(1);
}

const input = resolve(inputArgument);
const output = resolve(outputArgument);
if (input === output) throw new Error("Input and output must be different paths.");
if (mode === "encrypt" && !input.endsWith(".sql")) throw new Error("Encrypt expects an exported .sql file.");
if (mode === "decrypt" && (!input.endsWith(".d1enc") || !output.endsWith(".sql"))) {
  throw new Error("Decrypt expects .d1enc input and .sql output.");
}

const key = parseD1BackupKey(process.env.D1_BACKUP_KEY_B64);
try {
  const bytes = await readFile(input);
  if (bytes.length === 0) throw new Error("Cannot encrypt or decrypt an empty backup.");
  const result = mode === "encrypt" ? encryptD1Buffer(bytes, key) : decryptD1Buffer(bytes, key);
  await writeFile(output, result, { flag: "wx", mode: 0o600, flush: true });
  console.log(mode === "encrypt" ? "Encrypted D1 backup file created." : "Decrypted D1 SQL file created for manual recovery.");
} finally {
  // A short-lived CI runner must not leave the unencrypted SQL export behind.
  // Decrypt mode deliberately preserves encrypted source material.
  if (mode === "encrypt") await rm(input, { force: true });
}
