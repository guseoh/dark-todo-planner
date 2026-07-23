import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeCategoryIcon } from "../server/categoryIcon";
import { normalizeHttpUrl } from "../server/validation";

test("normalizeHttpUrl accepts only http and https URLs", () => {
  assert.equal(normalizeHttpUrl(" https://example.com/path?q=1 "), "https://example.com/path?q=1");
  assert.equal(normalizeHttpUrl("http://example.com"), "http://example.com/");

  assert.equal(normalizeHttpUrl("javascript:alert(1)"), null);
  assert.equal(normalizeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
  assert.equal(normalizeHttpUrl("https://example.com/\nHeader: injected"), null);
  assert.equal(normalizeHttpUrl("ftp://example.com/file"), null);
});

test("normalizeCategoryIcon rejects executable or oversized icon values", () => {
  assert.equal(normalizeCategoryIcon("https://example.com/icon.png"), "https://example.com/icon.png");
  assert.equal(normalizeCategoryIcon("data:image/png;base64,AAAA"), "data:image/png;base64,AAAA");
  assert.equal(normalizeCategoryIcon("lucide:CalendarDays"), "lucide:CalendarDays");

  assert.equal(normalizeCategoryIcon("javascript:alert(1)"), null);
  assert.equal(normalizeCategoryIcon("data:text/html,<svg onload=alert(1)>"), null);
  assert.equal(normalizeCategoryIcon("data:image/svg+xml,<svg onload=alert(1)>"), null);
  assert.equal(normalizeCategoryIcon("x".repeat(120_001)), null);
});
