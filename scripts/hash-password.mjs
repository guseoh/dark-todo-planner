import { randomBytes, scrypt } from "node:crypto";

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 5;
const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_MAXMEM = 32 * 1024 * 1024;
const MIN_PASSWORD_LENGTH = 12;

const readSecret = async (prompt) => {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal.");
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    const finish = (error) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      error ? reject(error) : resolve(value);
    };

    const onData = (key) => {
      if (key === "\u0003") return finish(new Error("Cancelled."));
      if (key === "\r" || key === "\n") return finish();
      if (key === "\u007f" || key === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += key;
    };

    process.stdin.on("data", onData);
  });
};

const password = await readSecret("Password: ");
if (password.length < MIN_PASSWORD_LENGTH) {
  throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
}

const confirmation = await readSecret("Confirm password: ");
if (password !== confirmation) {
  throw new Error("Passwords do not match.");
}

const salt = randomBytes(16);
const digest = await new Promise((resolve, reject) => {
  scrypt(password, salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }, (error, value) => {
    error ? reject(error) : resolve(value);
  });
});

console.log(`scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${digest.toString("base64url")}`);
