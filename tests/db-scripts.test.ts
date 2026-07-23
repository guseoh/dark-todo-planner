import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  backupDatabase,
  checkDatabaseIntegrity,
  resolveDatabasePath,
  restoreDatabase,
} from "../scripts/db-utils.mjs";

let root = "";

const createFixtureDatabase = (value: string) => {
  const dbPath = path.join(root, "data", "test.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT NOT NULL);");
  db.prepare("INSERT INTO items (name) VALUES (?)").run(value);
  db.close();
  return dbPath;
};

const readFixtureValue = (dbPath: string) => {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    return db.prepare("SELECT name FROM items WHERE id = 1").get() as { name: string };
  } finally {
    db.close();
  }
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "dark-todo-planner-"));
  fs.mkdirSync(path.join(root, "prisma"), { recursive: true });
  fs.mkdirSync(path.join(root, "backups"), { recursive: true });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

test("database path resolution stays inside allowed project database folders", () => {
  const resolved = resolveDatabasePath("file:../data/test.db", root);
  assert.equal(resolved, path.join(root, "data", "test.db"));

  assert.throws(() => resolveDatabasePath("file:../../outside.db", root), /inside/);
});

test("database integrity check and backup create a verified SQLite backup", () => {
  const dbPath = createFixtureDatabase("before");
  const check = checkDatabaseIntegrity(dbPath);
  const backup = backupDatabase({ databaseUrl: "file:../data/test.db", destination: "snapshot.db", root });

  assert.deepEqual(check, { integrity: "ok", foreignKeyViolations: 0 });
  assert.equal(backup.databasePath, dbPath);
  assert.equal(backup.backupPath, path.join(root, "backups", "snapshot.db"));
  assert.equal(fs.existsSync(backup.backupPath), true);
});

test("restore requires confirmation and validates backup location", () => {
  createFixtureDatabase("before");

  assert.throws(
    () => restoreDatabase({ databaseUrl: "file:../data/test.db", source: "snapshot.db", root }),
    /--confirm/,
  );
  assert.throws(
    () =>
      restoreDatabase({
        databaseUrl: "file:../data/test.db",
        source: path.join(root, "data", "test.db"),
        root,
        confirm: true,
      }),
    /outside/,
  );
});

test("restore replaces the database from a verified backup and keeps a safety backup", () => {
  const dbPath = createFixtureDatabase("before");
  const backup = backupDatabase({ databaseUrl: "file:../data/test.db", destination: "snapshot.db", root });

  const db = new DatabaseSync(dbPath);
  db.exec("UPDATE items SET name = 'after' WHERE id = 1;");
  db.close();

  const result = restoreDatabase({
    databaseUrl: "file:../data/test.db",
    source: backup.backupPath,
    root,
    confirm: true,
  });

  assert.equal(readFixtureValue(dbPath).name, "before");
  assert.equal(result.restoredFrom, backup.backupPath);
  assert.equal(Boolean(result.safetyBackupPath && fs.existsSync(result.safetyBackupPath)), true);
});
