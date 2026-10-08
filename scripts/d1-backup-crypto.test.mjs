import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import { decryptD1Buffer, encryptD1Buffer, parseD1BackupKey } from "./d1-backup-crypto.mjs";

describe("encrypted D1 backup", () => {
  const key = randomBytes(32);
  it("encrypts and decrypts SQL exactly", () => {
    const sql = Buffer.from("CREATE TABLE notes(id TEXT);\nINSERT INTO notes VALUES('한글 ✓');\n");
    const cipher = encryptD1Buffer(sql, key);
    assert.notDeepEqual(cipher, sql);
    assert.deepEqual(decryptD1Buffer(cipher, key), sql);
    assert.notDeepEqual(encryptD1Buffer(sql, key), cipher, "Each encryption must use a unique nonce.");
  });

  it("authenticates ciphertext and rejects tampering or a wrong key", () => {
    const cipher = encryptD1Buffer(Buffer.from("secret Todo"), key);
    const tampered = Buffer.from(cipher);
    tampered[tampered.length - 1] ^= 1;
    assert.throws(() => decryptD1Buffer(tampered, key));
    assert.throws(() => decryptD1Buffer(cipher, randomBytes(32)));
    assert.throws(() => decryptD1Buffer(Buffer.from("fake"), key));
  });

  it("requires an exactly-32-byte base64 key", () => {
    assert.deepEqual(parseD1BackupKey(key.toString("base64")), key);
    assert.throws(() => parseD1BackupKey("not-a-key"));
    assert.throws(() => parseD1BackupKey(Buffer.alloc(16).toString("base64")));
  });
});
