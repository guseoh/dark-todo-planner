import test from "node:test";
import assert from "node:assert/strict";
import { classify } from "./ci-scope.mjs";
const expected = (overrides = {}) => ({ code: false, backend: false, crypto: false, audit: false, desktop: false, ...overrides });
test("documentation skips application checks", () => assert.deepEqual(classify(["README.md", "docs/tern.md"]), expected()));
test("UI and native changes do not trigger Worker regression", () => assert.deepEqual(classify(["src/pages/Today.tsx", "src-tauri/src/lib.rs"]), expected({ code: true, desktop: true })));
test("backend and migrations require data checks", () => assert.deepEqual(classify(["worker/routes/todos.ts", "migrations/001.sql"]), expected({ code: true, backend: true, crypto: true })));
test("shared dependencies and unknown paths fail open to full validation", () => {
  for (const path of ["package-lock.json", "tsconfig.json", ".github/workflows/ci.yml", "unknown.ts"]) {
    assert.deepEqual(classify([path]), expected({ code: true, backend: true, crypto: true, audit: true, desktop: true }));
  }
});
test("backup and signing scripts receive their own checks", () => {
  assert.deepEqual(classify(["scripts/d1-backup-crypto.mjs"]), expected({ code: true, crypto: true }));
  assert.deepEqual(classify(["scripts/prepare-desktop-release.mjs"]), expected({ code: true, desktop: true }));
});
test("mixed PR unions scopes", () => assert.deepEqual(classify(["src/App.tsx", "worker/index.ts"]), expected({ code: true, backend: true, crypto: true, desktop: true })));
