import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { chromium } from "playwright";

const base = new URL(process.env.SMOKE_BASE_URL || "http://127.0.0.1:8787");
if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(base.hostname) || !["http:", "https:"].includes(base.protocol)) {
  throw new Error("Browser E2E can only target a local loopback Worker, never Production or Preview.");
}
if (!process.env.SMOKE_USERNAME || !process.env.SMOKE_PASSWORD) {
  throw new Error("Use ephemeral local smoke credentials from scripts/prepare-smoke-auth.mjs.");
}

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ko-KR" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
let failed = false;

const findServerTodo = async (title) => {
  const response = await page.request.get(new URL("/api/todos?archived=all&limit=100", base).toString());
  assert.equal(response.status(), 200, "Browser session must authenticate API calls");
  return (await response.json()).todos?.find((todo) => todo.title === title);
};

const waitForServerTodo = async (title) => {
  for (let i = 0; i < 35; i += 1) {
    if (await findServerTodo(title)) return;
    await sleep(500);
  }
  throw new Error("Offline Todo did not synchronize to local D1 after reconnect.");
};

try {
  await page.goto(base.toString(), { waitUntil: "domcontentloaded" });
  await page.locator('input[autocomplete="username"]').fill(process.env.SMOKE_USERNAME);
  await page.locator('input[autocomplete="current-password"]').fill(process.env.SMOKE_PASSWORD);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();

  const nav = page.getByRole("navigation", { name: "모바일 탐색" });
  assert.equal(await nav.locator("button").count(), 5, "Mobile bar must have exactly five primary tabs");
  await nav.getByRole("button", { name: "더보기" }).click();
  await nav.getByRole("button", { name: "설정" }).click();
  await page.getByRole("heading", { name: "앱 정보", exact: true }).waitFor();
  await page.getByText("전체 데이터 백업·복원").first().waitFor();
  await nav.getByRole("button", { name: "오늘", exact: true }).click();

  const title = `Browser Todo ${randomUUID().slice(0, 8)}`;
  const edited = title + " edited";
  const quickInput = page.locator('input[data-quick-todo-input="true"]');
  await quickInput.fill(title);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.getByText(title, { exact: true }).first().waitFor();
  assert.ok(await findServerTodo(title), "Todo create should persist to local D1.");

  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "검색 및 명령" });
  await search.getByPlaceholder("검색하거나 실행할 명령 입력").fill(title);
  await search.getByRole("button", { name: new RegExp(title) }).click();
  const edit = page.getByRole("dialog", { name: "Todo 수정" });
  await edit.getByPlaceholder("Todo 제목").fill(edited);
  await edit.getByRole("button", { name: "저장", exact: true }).click();
  await edit.waitFor({ state: "hidden" });
  assert.ok(await findServerTodo(edited), "Command Palette should open the right Todo for editing.");

  await nav.getByRole("button", { name: "오늘", exact: true }).click();
  const offlineTitle = `Offline Browser Todo ${randomUUID().slice(0, 8)}`;
  await context.setOffline(true);
  await quickInput.fill(offlineTitle);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.getByText(offlineTitle, { exact: true }).first().waitFor();
  await context.setOffline(false);
  await waitForServerTodo(offlineTitle);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();
  await page.getByText(offlineTitle, { exact: true }).first().waitFor();

  console.log("BROWSER E2E PASS: login, mobile navigation, settings backup, create, search/edit, offline queue reconnect and reload.");
} catch (error) {
  failed = true;
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/browser-smoke-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
}
