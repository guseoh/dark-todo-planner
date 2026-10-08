import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { appendFile, writeFile } from "node:fs/promises";

if (!process.env.GITHUB_ENV || !process.env.CI) {
  throw new Error("Isolated smoke credentials can only be prepared in CI.");
}

const salt = randomBytes(16);
const username = "dtp-smoke";
const password = randomBytes(24).toString("base64url");
const digest = await promisify(scrypt)(password, salt, 32, {
  N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024,
});
const encodedHash = `scrypt$16384$8$5$${salt.toString("base64url")}$${digest.toString("base64url")}`;
const secret = randomBytes(48).toString("base64url");
await writeFile(".dev.vars", [
  `AUTH_USERNAME=${username}`,
  `AUTH_PASSWORD_HASH=${encodedHash}`,
  `SESSION_SECRET=${secret}`,
  "",
].join("\n"), { encoding: "utf8", flag: "wx", mode: 0o600 });
await appendFile(process.env.GITHUB_ENV, `SMOKE_USERNAME=${username}\nSMOKE_PASSWORD=${password}\n`, { encoding: "utf8" });
console.log("Created isolated, ephemeral local-only smoke credentials.");
