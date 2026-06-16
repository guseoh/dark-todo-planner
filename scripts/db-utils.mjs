import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const DEFAULT_DATABASE_URL = "file:../data/dev.db";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const normalizeWindowsPath = (value) => {
  const decoded = decodeURIComponent(value);
  return process.platform === "win32" && decoded.startsWith("/") && /^[A-Za-z]:/.test(decoded.slice(1))
    ? decoded.slice(1)
    : decoded;
};

export const assertInsideDirectory = (targetPath, allowedDirectory) => {
  const target = path.resolve(targetPath);
  const directory = path.resolve(allowedDirectory);
  const relative = path.relative(directory, target);
  if (relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))) return target;
  throw new Error(`${target} is outside ${directory}`);
};

export const resolveDatabasePath = (databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL, root = projectRoot) => {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("Only SQLite file: DATABASE_URL values are supported.");
  }

  const schemaDirectory = path.join(root, "prisma");
  const withoutQuery = databaseUrl.slice("file:".length).split("?")[0];
  const rawPath = normalizeWindowsPath(withoutQuery);
  const resolved = path.isAbsolute(rawPath) ? path.resolve(rawPath) : path.resolve(schemaDirectory, rawPath);

  const allowedDirectories = [path.join(root, "data"), path.join(root, "prisma")];
  if (allowedDirectories.some((directory) => {
    try {
      assertInsideDirectory(resolved, directory);
      return true;
    } catch {
      return false;
    }
  })) {
    return resolved;
  }

  throw new Error(`Database path must stay inside ${allowedDirectories.join(" or ")}.`);
};

export const resolveBackupPath = (backupPath, root = projectRoot) => {
  const backupDirectory = path.join(root, "backups");
  const candidate = backupPath
    ? path.resolve(path.isAbsolute(backupPath) ? backupPath : path.join(backupDirectory, backupPath))
    : backupDirectory;
  return assertInsideDirectory(candidate, backupDirectory);
};

const sqlString = (value) => `'${String(value).replace(/'/g, "''")}'`;

export const checkDatabaseIntegrity = (dbPath) => {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database file does not exist: ${dbPath}`);
  }

  const db = new DatabaseSync(dbPath, { readOnly: true });
  try {
    const integrityRows = db.prepare("PRAGMA integrity_check").all();
    const foreignKeyRows = db.prepare("PRAGMA foreign_key_check").all();
    const integrityOk =
      integrityRows.length === 1 &&
      Object.values(integrityRows[0]).some((value) => String(value).toLowerCase() === "ok");

    if (!integrityOk) {
      throw new Error(`SQLite integrity_check failed: ${JSON.stringify(integrityRows)}`);
    }
    if (foreignKeyRows.length > 0) {
      throw new Error(`SQLite foreign_key_check found ${foreignKeyRows.length} violation(s).`);
    }

    return { integrity: "ok", foreignKeyViolations: 0 };
  } finally {
    db.close();
  }
};

const timestamp = () => new Date().toISOString().replace(/[:]/g, "-").replace(/\.\d{3}Z$/, "Z");

export const backupDatabase = ({
  databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  destination,
  root = projectRoot,
} = {}) => {
  const dbPath = resolveDatabasePath(databaseUrl, root);
  checkDatabaseIntegrity(dbPath);

  const backupDirectory = path.join(root, "backups");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const destinationPath = destination
    ? resolveBackupPath(destination, root)
    : path.join(backupDirectory, `todo-planner-${timestamp()}.db`);

  if (fs.existsSync(destinationPath)) {
    throw new Error(`Backup already exists: ${destinationPath}`);
  }

  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA wal_checkpoint(FULL)");
    db.exec(`VACUUM INTO ${sqlString(destinationPath)}`);
  } finally {
    db.close();
  }

  checkDatabaseIntegrity(destinationPath);
  return { databasePath: dbPath, backupPath: destinationPath };
};

export const restoreDatabase = ({
  databaseUrl = process.env.DATABASE_URL || DEFAULT_DATABASE_URL,
  source,
  root = projectRoot,
  confirm = false,
} = {}) => {
  if (!confirm) {
    throw new Error("Restore requires --confirm.");
  }
  if (!source) {
    throw new Error("Restore requires a backup path.");
  }

  const backupDirectory = path.join(root, "backups");
  const sourcePath = resolveBackupPath(source, root);
  if (!sourcePath.endsWith(".db")) {
    throw new Error("Backup file must end with .db.");
  }
  checkDatabaseIntegrity(sourcePath);

  const dbPath = resolveDatabasePath(databaseUrl, root);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  let safetyBackupPath = null;
  if (fs.existsSync(dbPath)) {
    safetyBackupPath = backupDatabase({
      databaseUrl,
      destination: path.join(backupDirectory, `pre-restore-${timestamp()}.db`),
      root,
    }).backupPath;
  }

  fs.copyFileSync(sourcePath, dbPath);
  checkDatabaseIntegrity(dbPath);

  return { databasePath: dbPath, restoredFrom: sourcePath, safetyBackupPath };
};

export const runCheckCommand = () => {
  const dbPath = resolveDatabasePath();
  const result = checkDatabaseIntegrity(dbPath);
  console.log(JSON.stringify({ databasePath: dbPath, ...result }, null, 2));
};

export const runBackupCommand = () => {
  const destinationIndex = process.argv.indexOf("--out");
  const destination = destinationIndex >= 0 ? process.argv[destinationIndex + 1] : undefined;
  const result = backupDatabase({ destination });
  console.log(JSON.stringify(result, null, 2));
};

export const runRestoreCommand = () => {
  const args = process.argv.slice(2);
  const source = args.find((arg) => !arg.startsWith("--"));
  const result = restoreDatabase({ source, confirm: args.includes("--confirm") });
  console.log(JSON.stringify(result, null, 2));
};
