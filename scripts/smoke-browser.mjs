import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
// Install Playwright in an isolated CI folder to avoid npm changing the app dependency tree.
const requireDriver = createRequire(resolve(".ci-browser-runner/package.json"));
const { chromium } = requireDriver("playwright");

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
  // Browser UI treats loopback as a secure context. Playwright's Node APIRequest
  // cookie jar may not send the browser's Secure session cookie over HTTP.
  // Fetch in the actual page context instead, using the browser cookie policy.
  const result = await page.evaluate(async () => {
    const response = await fetch("/api/todos?archived=all&limit=100", { credentials: "same-origin" });
    return { status: response.status, payload: await response.json() };
  });
  assert.equal(result.status, 200, "Authenticated browser fetch should reach local D1");
  return result.payload.todos?.find((todo) => todo.title === title);
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
  await page.getByRole("tab", { name: "자동화 · 알림" }).click();
  await page.getByRole("heading", { name: "Discord 리마인더" }).waitFor();
  await page.getByRole("tab", { name: "데이터 · 백업" }).click();
  await page.getByText("전체 데이터 백업·복원").first().waitFor();
  await nav.getByRole("button", { name: "오늘", exact: true }).click();

  // Browser history, direct hash links and reloads should retain the active screen.
  assert.equal(new URL(page.url()).hash, "#/today");
  await nav.getByRole("button", { name: "더보기" }).click();
  await nav.getByRole("button", { name: "주간", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#/week");
  await page.goBack();
  await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/today");
  await page.goForward();
  await page.getByRole("heading", { name: "주간", exact: true }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "주간", exact: true }).waitFor();
  await nav.getByRole("button", { name: "오늘", exact: true }).click();

  // Empty Today state should prioritize a single helpful message and the add form
  // rather than multiple zero-statistics cards.
  await page.getByRole("heading", { name: "오늘은 아직 등록된 Todo가 없습니다." }).waitFor();
  assert.equal(await page.getByRole("heading", { name: "오늘의 핵심 작업" }).count(), 0, "Do not render empty focus card.");
  assert.equal(await page.getByText("미완료 Todo가 없습니다.", { exact: true }).count(), 0, "Do not repeat zero-state placeholders.");
  assert.equal(await page.getByRole("button", { name: "카테고리 관리" }).count(), 1, "Keep category management discoverable even when Today is empty.");
  assert.equal(await page.locator('section[aria-label="오늘 Todo"]').count(), 1, "Todo entry must remain available while empty.");

  const title = `Browser Todo ${randomUUID().slice(0, 8)}`;
  const edited = title + " edited";
  const quickInput = page.locator('input[data-quick-todo-input="true"]');
  await quickInput.fill(title);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.getByText(title, { exact: true }).first().waitFor();
  assert.ok(await findServerTodo(title), "Todo create should persist to local D1.");
  await page.getByRole("heading", { name: "오늘 진행" }).waitFor();
  await page.getByText("중요한 Todo는 별표를 눌러 상단에 모아 둘 수 있습니다.", { exact: false }).waitFor();
  await page.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).click();
  await page.getByRole("heading", { name: "오늘의 핵심 작업" }).waitFor();
  assert.equal(await page.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).count(), 0, "Pinned Todo must not appear twice.");
  await page.getByRole("button", { name: `${title} 핵심 작업에서 제외` }).click();
  assert.equal(await page.getByRole("heading", { name: "오늘의 핵심 작업" }).count(), 0, "Focus card should collapse after removing the last pinned Todo.");
  await page.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).waitFor();

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

  // Weekly goals are a primary editing flow. Assert that failed network writes
  // do not clear the draft or dismiss the edit input, then retry successfully.
  await nav.getByRole("button", { name: "더보기" }).click();
  await nav.getByRole("button", { name: "주간", exact: true }).click();
  await page.getByRole("heading", { name: "주간", exact: true }).waitFor();
  const weeklySummary = page.locator('section[aria-labelledby="week-summary-title"]');
  const goalCard = page.getByRole("region", { name: "이번 주 목표" });
  await goalCard.waitFor();
  const widths = await page.evaluate(() => {
    const summary = document.querySelector('section[aria-labelledby="week-summary-title"]');
    const goals = document.querySelector('section[aria-label="이번 주 목표"]');
    if (!summary || !goals) throw new Error("Weekly summary and goals not found.");
    return { summary: summary.getBoundingClientRect(), goals: goals.getBoundingClientRect() };
  });
  assert.ok(Math.abs(widths.summary.width - widths.goals.width) < 2, "Weekly goal card should align with the summary width.");

  const currentWeek = await page.locator("#week-summary-title").innerText();
  await page.getByRole("button", { name: "이전 주" }).click();
  assert.notEqual(await page.locator("#week-summary-title").innerText(), currentWeek, "Previous week must change the date range.");
  await page.getByRole("button", { name: "이번 주", exact: true }).click();
  assert.equal(await page.locator("#week-summary-title").innerText(), currentWeek, "This week button must restore the visible date range.");

  const goalTitle = `Weekly E2E ${randomUUID().slice(0, 8)}`;
  const goalDraft = goalCard.getByRole("textbox", { name: "이번 주에 끝낼 핵심 목표" });
  await goalDraft.fill(goalTitle);
  let failAddOnce = true;
  await page.route("**/api/goals", async (route) => {
    if (route.request().method() === "POST" && failAddOnce) {
      failAddOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"test failure"}' });
    } else await route.continue();
  });
  await goalCard.getByRole("button", { name: "추가", exact: true }).click();
  await goalCard.getByRole("alert").waitFor();
  assert.equal(await goalDraft.inputValue(), goalTitle, "Creation failure must preserve weekly goal draft.");
  await goalCard.getByRole("button", { name: "추가", exact: true }).click();
  await goalCard.getByText(goalTitle, { exact: true }).waitFor();
  assert.equal(await goalDraft.inputValue(), "", "Successful save clears weekly goal draft.");
  await page.unroute("**/api/goals");

  await goalCard.getByRole("button", { name: `${goalTitle} 수정` }).click();
  const editedGoalTitle = goalTitle + " edited";
  const editGoal = goalCard.getByRole("textbox", { name: "목표 제목 수정" });
  await editGoal.fill(editedGoalTitle);
  let failEditOnce = true;
  await page.route("**/api/goals/*", async (route) => {
    if (route.request().method() === "PUT" && failEditOnce) {
      failEditOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"test failure"}' });
    } else await route.continue();
  });
  await goalCard.getByRole("button", { name: "목표 수정 저장" }).click();
  await goalCard.getByRole("alert").waitFor();
  assert.equal(await editGoal.inputValue(), editedGoalTitle, "Update failure must keep edit mode and text.");
  await goalCard.getByRole("button", { name: "목표 수정 저장" }).click();
  await goalCard.getByText(editedGoalTitle, { exact: true }).waitFor();
  await editGoal.waitFor({ state: "hidden" });
  await page.unroute("**/api/goals/*");

  // Project workspace should remain usable while its formerly crowded
  // sections are hidden behind purpose-built tabs.
  await nav.getByRole("button", { name: "프로젝트", exact: true }).click();
  await page.getByRole("heading", { name: "프로젝트", exact: true }).waitFor();
  await page.getByRole("button", { name: "프로젝트 추가" }).click();
  const newProjectInput = page.getByPlaceholder("새 프로젝트 이름");
  await newProjectInput.fill("UX Regression Project");
  await newProjectInput.locator("xpath=..").getByRole("button", { name: "추가", exact: true }).click();
  await page.getByRole("tab", { name: /작업·Kanban/ }).waitFor();
  await page.getByRole("tab", { name: /마일스톤/ }).click();
  await page.getByRole("heading", { name: "마일스톤" }).waitFor();
  await page.getByRole("tab", { name: /결정 기록/ }).click();
  await page.getByRole("tab", { name: /분석·관리/ }).click();
  await page.getByRole("heading", { name: "프로젝트 상태" }).waitFor();
  await page.getByRole("tab", { name: /작업·Kanban/ }).click();
  const resourceDisclosure = page.locator("details").filter({ hasText: "자료 링크" }).first();
  await resourceDisclosure.locator("summary").click();
  assert.equal(await resourceDisclosure.evaluate((node) => node.open), true);

  // Layout probes at common mobile, tablet and desktop breakpoints.
  // Retain screenshots as review artifacts; geometry failure blocks deployment.
  await mkdir("test-artifacts", { recursive: true });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["today", "projects", "settings"]) {
      await page.evaluate((next) => { window.location.hash = "#/" + next; }, view);
      if (view === "today") await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();
      if (view === "projects") await page.getByRole("heading", { name: "프로젝트", exact: true }).waitFor();
      if (view === "settings") await page.getByRole("heading", { name: "앱 정보", exact: true }).waitFor();
      const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(geometry.document <= geometry.viewport + 2, `Unexpected page overflow at ${width}px on ${view}: ${JSON.stringify(geometry)}`);
      await page.screenshot({ path: `test-artifacts/layout-${width}-${view}.png`, fullPage: true });
    }
  }

  console.log("BROWSER E2E PASS: Today, history, settings tabs, projects tabs, keyboard/search, and 12 responsive layout snapshots.");
} catch (error) {
  failed = true;
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/browser-smoke-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
}
