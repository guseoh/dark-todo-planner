import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("DTPD1v1", "ascii");
const IV_BYTES = 12;
const TAG_BYTES = 16;

export function parseD1BackupKey(value) {
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value)) {
    throw new Error("D1_BACKUP_KEY_B64 must contain exactly 32 random bytes encoded as base64.");
  }
  const key = Buffer.from(value, "base64");
  if (key.length !== 32 || key.toString("base64") !== value) {
    throw new Error("D1_BACKUP_KEY_B64 must contain exactly 32 random bytes encoded as base64.");
  }
  return key;
}

const validateKey = (key) => {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error("Expected a 32-byte AES-256 key.");
};

export function encryptD1Buffer(plaintext, key) {
  validateKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}

export function decryptD1Buffer(blob, key) {
  validateKey(key);
  const headerLength = MAGIC.length + IV_BYTES + TAG_BYTES;
  if (blob.length < headerLength || !blob.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Invalid D1 backup format or truncated ciphertext.");
  }
  const iv = blob.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = blob.subarray(MAGIC.length + IV_BYTES, headerLength);
  const ciphertext = blob.subarray(headerLength);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
