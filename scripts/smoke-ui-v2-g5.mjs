import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const requireDriver = createRequire(resolve(".ci-browser-runner/package.json"));
const { chromium } = requireDriver("playwright");

const base = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787");
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(base.hostname) ||
    !["http:", "https:"].includes(base.protocol)) {
  throw new Error("G5 browser regression must use a local loopback Worker, not Production.");
}
if (!process.env.SMOKE_USERNAME || !process.env.SMOKE_PASSWORD) {
  throw new Error("Missing ephemeral local smoke credentials.");
}

const screens = [
  ["today", "오늘"], ["all", "전체 Todo"], ["calendar", "캘린더"],
  ["projects", "프로젝트"], ["memo", "메모"], ["scratchpad", "낙서장"],
  ["trash", "휴지통"], ["settings", "설정"],
];
const widths = [320, 390, 768, 1280];
const themes = ["dark", "light"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: 1280, height: 844 },
  locale: "ko-KR",
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.setDefaultTimeout(20000);

// Check opaque semantic design tokens against WCAG AA normal-size text.
// This is a token-level check, not a complete per-element contrast audit.
const tokenContrast = async () => page.evaluate(() => {
  const style = getComputedStyle(document.documentElement);
  const hex = (name) => {
    const value = style.getPropertyValue(name).trim();
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error("Invalid opaque theme token: " + name + "=" + value);
    return [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  };
  const luminance = (name) => hex(name).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  return {
    primaryCanvas: ratio("--text-primary", "--app-bg"),
    secondaryCanvas: ratio("--text-secondary", "--app-bg"),
    secondarySurface: ratio("--text-secondary", "--surface-1"),
    primarySurface: ratio("--text-primary", "--surface-1"),
  };
});

const readOnlySnapshot = async () => page.evaluate(async () => {
  const [todosResponse, scratchResponse] = await Promise.all([
    fetch("/api/todos?archived=all&limit=100", { credentials: "same-origin" }),
    fetch("/api/scratchpad", { credentials: "same-origin" }),
  ]);
  if (!todosResponse.ok || !scratchResponse.ok) throw new Error("Authenticated read-only snapshot failed.");
  const todos = (await todosResponse.json()).todos || [];
  const scratchpad = (await scratchResponse.json()).scratchpad;
  return {
    todos: todos.map((item) => ({
      id: item.id, title: item.title, date: item.date,
      planningState: item.planningState, completed: item.completed,
      archived: item.archived, priority: item.priority, projectId: item.projectId,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    scratchpad: scratchpad.content,
  };
});

const assertAccessibleView = async (view, width) => {
  const probes = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const documentWidth = document.documentElement.scrollWidth;
    const main = document.querySelector("main");
    const active = document.activeElement;
    const heading = document.querySelector("main h1");
    return {
      viewport, documentWidth,
      hasMain: !!main,
      heading: heading?.textContent?.trim() || "",
      focusedOutsideBody: active !== document.body,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    };
  });
  assert.ok(probes.hasMain, view + " must provide a main landmark");
  assert.ok(probes.heading.length > 0, view + " must provide an h1 page heading");
  assert.ok(probes.reducedMotion, "Reduced-motion CI preference must be active");
  assert.ok(probes.documentWidth <= probes.viewport + 2,
    "Horizontal overflow at " + view + "/" + width + ": " + JSON.stringify(probes));
};

try {
  await mkdir("test-artifacts", { recursive: true });
  await page.goto(base.toString(), { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill(process.env.SMOKE_USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(process.env.SMOKE_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();

  // T27: keyboard-only command palette, dialog focus containment and Escape.
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "검색 및 명령" });
  await dialog.waitFor();
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press(step % 3 === 0 ? "Shift+Tab" : "Tab");
    assert.equal(await dialog.evaluate((node) => node.contains(document.activeElement)), true,
      "Keyboard focus must remain in the open command dialog.");
  }
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });

  // Test only on isolated D1. Navigating and switching themes must never write
  // to existing Todo fields or round-trip legacy Markdown through the editor.
  const before = await readOnlySnapshot();
  assert.ok(before.todos.length > 0, "G5 must run after the local CRUD fixture smoke.");
  assert.equal(typeof before.scratchpad, "string",
    "G5 snapshots must preserve whichever Markdown the isolated D1 currently stores.");
  // The earlier G4 smoke verifies its own source-mode fixture and serialization.
  // This second browser session does not require a particular scratchpad fixture.

  for (const theme of themes) {
    await page.evaluate(() => { window.location.hash = "#/settings"; });
    await page.getByRole("heading", { name: "설정", exact: true }).waitFor();
    await page.getByRole("tab", { name: "앱 및 연결 정보" }).click();
    await page.getByRole("group", { name: "화면 테마 선택" })
      .getByRole("button", { name: theme === "dark" ? "다크" : "라이트" }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    const ratios = await tokenContrast();
    for (const [name, value] of Object.entries(ratios)) {
      assert.ok(value >= 4.5,
        "WCAG AA text-token contrast " + theme + "/" + name + ": " + value.toFixed(2));
    }

    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 });
      for (const [view, heading] of screens) {
        await page.evaluate((name) => { window.location.hash = "#/" + name; }, view);
        if (view === "scratchpad") {
          await page.getByRole("textbox", { name: "낙서장 편집기" }).waitFor();
        } else {
          await page.getByRole("heading", { name: heading, exact: true }).first().waitFor();
        }
        await assertAccessibleView(view, width);
        const mobileNav = page.getByRole("navigation", { name: "모바일 탐색" });
        if (width < 1024) {
          assert.equal(await mobileNav.isVisible(), true, "Mobile nav must be available at " + width);
          assert.equal(await mobileNav.getByRole("button", { name: "받은함" }).count(), 0);
          assert.equal(await mobileNav.getByRole("button", { name: "전체 Todo" }).count(), 1);
        } else {
          assert.equal(await mobileNav.isVisible(), false, "Mobile nav must not overlap desktop content");
        }
        await page.screenshot({
          path: "test-artifacts/layout-g5-" + theme + "-" + width + "-" + view + ".png",
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }

  // G3 legacy bookmarks remain backwards compatible.
  await page.goto(new URL("/#/inbox", base).toString(), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "전체 Todo", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/all");

  const after = await readOnlySnapshot();
  assert.deepEqual(after, before,
    "Theme changes, responsive navigation and legacy redirects must not mutate Todo/D1 Markdown data.");
  console.log("G5 REGRESSION PASS: 64 Light/Dark responsive snapshots, text token contrast, landmarks, focus trap, legacy route, and read-only D1 preservation.");
} catch (error) {
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/g5-browser-smoke-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await browser.close();
}
