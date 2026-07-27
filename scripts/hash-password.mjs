import { pbkdf2, randomBytes } from "node:crypto";

const readPassword = async () => {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") throw new Error("Run this command in an interactive terminal.");
  process.stdout.write("Password: "); process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => { process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\n"); error ? reject(error) : resolve(value); };
    process.stdin.on("data", (key) => {
      if (key === "\u0003") return finish(new Error("Cancelled."));
      if (key === "\r" || key === "\n") return finish();
      if (key === "\u007f" || key === "\b") { value = value.slice(0, -1); return; }
      value += key;
    });
  });
};

const password = await readPassword();
if (password.length < 12) throw new Error("Password must be at least 12 characters.");
const rounds = 100_000; const salt = randomBytes(16);
const digest = await new Promise((resolve, reject) => pbkdf2(password, salt, rounds, 32, "sha256", (error, value) => error ? reject(error) : resolve(value)));
console.log(`pbkdf2-sha256$${rounds}$${salt.toString("base64url")}$${digest.toString("base64url")}`);
