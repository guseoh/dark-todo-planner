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
  // Design-system regression: flat content sections and strictly neutral
  // visual accent. Do not turn the workspace back into bordered tile cards.
  const visualSystem = await page.evaluate(() => {
    const section = document.querySelector(".app-card");
    const primary = document.querySelector(".btn-primary");
    if (!section || !primary) return null;
    const sectionStyle = getComputedStyle(section);
    const buttonStyle = getComputedStyle(primary);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      sectionRadius: sectionStyle.borderTopLeftRadius,
      sectionBackground: sectionStyle.backgroundColor,
      sectionBorderTop: sectionStyle.borderTopWidth,
      primaryBackground: buttonStyle.backgroundColor,
      accent: rootStyle.getPropertyValue("--accent").trim(),
      canvas: rootStyle.getPropertyValue("--app-bg").trim(),
    };
  });
  assert.ok(visualSystem, "Today screen should contain a content section and a primary control.");
  assert.equal(visualSystem.sectionRadius, "0px", "Content sections must not look like rounded cards.");
  assert.equal(visualSystem.sectionBackground, "rgba(0, 0, 0, 0)", "Content sections must share the workspace canvas.");
  assert.equal(visualSystem.sectionBorderTop, "0px", "Content sections must not be enclosed on every edge.");
  assert.equal(visualSystem.accent, "#d4d4d8", "Accent must be achromatic rather than sage.");
  assert.equal(visualSystem.canvas, "#101011", "The workspace canvas must use neutral near-black.");
  assert.equal(visualSystem.primaryBackground, "rgb(226, 226, 229)", "Primary action should be neutral light gray.");


  const nav = page.getByRole("navigation", { name: "모바일 탐색" });
  assert.equal(await nav.locator("button").count(), 5, "Mobile bar must have exactly five primary tabs");
  await nav.getByRole("button", { name: "더보기" }).click();
  await nav.getByRole("button", { name: "설정" }).click();
  await page.getByRole("heading", { name: "설정", exact: true }).waitFor();
  await page.getByRole("tab", { name: "자동화 · 알림" }).click();
  await page.getByRole("heading", { name: "Discord 리마인더" }).waitFor();
  await page.getByRole("tab", { name: "데이터 · 백업" }).click();
  await page.getByText("전체 데이터 백업·복원").first().waitFor();

  // Settings and project tabs retain a visible focus target and respond to arrows.
  await page.getByRole("tab", { name: "데이터 · 백업" }).focus();
  await page.keyboard.press("ArrowLeft");
  assert.equal(await page.getByRole("tab", { name: "자동화 · 알림" }).getAttribute("aria-selected"), "true");
  await page.keyboard.press("Home");
  assert.equal(await page.getByRole("tab", { name: "앱 및 연결 정보" }).getAttribute("aria-selected"), "true");

  // Unscheduled Todo can be scheduled from Inbox. A failed update must
  // preserve it and keep the chosen date for a retry.
  await nav.getByRole("button", { name: "받은함", exact: true }).click();
  await page.getByRole("heading", { name: "받은함", exact: true }).waitFor();
  const inboxTitle = `Capture E2E ${randomUUID().slice(0, 8)}`;
  await page.getByRole("region", { name: "받은함 Todo 작성" }).locator('input[data-quick-todo-input="true"]').fill(inboxTitle);
  await page.getByRole("button", { name: "받은함에 저장" }).click();
  await page.getByRole("heading", { name: inboxTitle, exact: true }).waitFor();
  const inboxCard = page.getByRole("article").filter({ has: page.getByRole("heading", { name: inboxTitle, exact: true }) });
  const inboxDate = "2026-11-12";
  await inboxCard.getByLabel(`${inboxTitle} 실행일`).fill(inboxDate);
  let inboxSaveFailOnce = true;
  await page.route("**/api/todos/*", async (route) => {
    if (route.request().method() === "PUT" && inboxSaveFailOnce) {
      inboxSaveFailOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"inbox test failure"}' });
    } else await route.continue();
  });
  await inboxCard.getByRole("button", { name: "날짜 지정" }).click();
  await page.getByRole("alert").filter({ hasText: "받은함에 그대로 남아 있습니다" }).waitFor();
  assert.equal((await findServerTodo(inboxTitle))?.planningState, "INBOX");
  assert.equal(await inboxCard.getByLabel(`${inboxTitle} 실행일`).inputValue(), inboxDate);
  await inboxCard.getByRole("button", { name: "날짜 지정" }).click();
  await page.getByRole("status").filter({ hasText: inboxTitle }).waitFor();
  assert.equal((await findServerTodo(inboxTitle))?.date, inboxDate);
  await page.unroute("**/api/todos/*");

  await nav.getByRole("button", { name: "오늘", exact: true }).click();

  // Browser history, direct hash links and reloads should retain the active screen.
  assert.equal(new URL(page.url()).hash, "#/today");
  await nav.getByRole("button", { name: "캘린더", exact: true }).click();
  await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/calendar/month");
  assert.equal(await page.getByRole("tab", { name: "월간", exact: true }).getAttribute("aria-selected"), "true");
  await page.getByRole("tab", { name: "주간", exact: true }).click();
  assert.equal(new URL(page.url()).hash, "#/calendar/week");
  await page.goBack();
  await page.getByRole("tab", { name: "월간", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/calendar/month");
  assert.equal(await page.getByRole("tab", { name: "월간", exact: true }).getAttribute("aria-selected"), "true");
  await page.goBack();
  await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/today");
  await page.goForward();
  await page.goForward();
  await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/calendar/week");
  assert.equal(await page.getByRole("tab", { name: "주간", exact: true }).getAttribute("aria-selected"), "true");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
  assert.equal(await page.getByRole("tab", { name: "주간", exact: true }).getAttribute("aria-selected"), "true");

  // Old bookmarks still open the matching calendar mode after an upgrade.
  await page.evaluate(() => { window.location.hash = "#/month"; });
  await page.getByRole("tab", { name: "월간", exact: true }).waitFor();
  assert.equal(await page.getByRole("tab", { name: "월간", exact: true }).getAttribute("aria-selected"), "true");
  await page.evaluate(() => { window.location.hash = "#/week"; });
  await page.getByRole("tab", { name: "주간", exact: true }).waitFor();
  assert.equal(await page.getByRole("tab", { name: "주간", exact: true }).getAttribute("aria-selected"), "true");
  await nav.getByRole("button", { name: "오늘", exact: true }).click();

  // Empty Today keeps its summary and add form, with one actionable empty-list message.
  await page.getByRole("heading", { name: "오늘 남은 할 일", exact: true }).waitFor();
  await page.getByText("오늘 할 일을 정해 보세요.", { exact: true }).waitFor();
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
  // The month dashboard must expose real Todo titles and allow filtering and
  // opening/closing the detail pane, not just numeric day summaries.
  await nav.getByRole("button", { name: "캘린더", exact: true }).click();
  await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
  const monthGrid = page.getByRole("region", { name: "월간 일정 캘린더" });
  await monthGrid.getByRole("button", { name: title, exact: true }).waitFor();
  const todoFilter = page.getByRole("button", { name: "Todo", exact: true });
  await todoFilter.click();
  assert.equal(await todoFilter.getAttribute("aria-pressed"), "false");
  assert.equal(await monthGrid.getByRole("button", { name: title, exact: true }).count(), 0, "Todo filter must hide scheduled event chips.");
  await todoFilter.click();
  // Clicking a scheduled chip edits its Todo; clicking the day opens details.
  await monthGrid.getByRole("button", { name: title, exact: true }).click();
  const fromCalendarEdit = page.getByRole("dialog", { name: "Todo 수정" });
  await fromCalendarEdit.getByPlaceholder("Todo 제목").waitFor();
  await fromCalendarEdit.getByRole("button", { name: "취소" }).click();
  await fromCalendarEdit.waitFor({ state: "hidden" });
  await monthGrid.getByRole("button", { name: title, exact: true })
    .locator('xpath=ancestor::*[@data-calendar-date]')
    .getByRole("button", { name: /일정 .*개 보기/ }).click({ position: { x: 5, y: 5 } });
  await page.getByRole("complementary", { name: "선택한 날짜 상세" }).waitFor();
  await page.getByRole("button", { name: "날짜 상세 닫기" }).click();
  assert.equal(await page.getByRole("complementary", { name: "선택한 날짜 상세" }).count(), 0);

  const sourceDate = await monthGrid.getByRole("button", { name: title, exact: true })
    .locator('xpath=ancestor::*[@data-calendar-date]').getAttribute("data-calendar-date");
  assert.ok(sourceDate);
  const monthCells = await monthGrid.locator("[data-calendar-date]").evaluateAll((cells) =>
    cells.map((cell) => cell.getAttribute("data-calendar-date")).filter(Boolean));
  const neighboringDates = monthCells.filter((date) => date.startsWith(sourceDate.slice(0, 7)) && date !== sourceDate);
  assert.ok(neighboringDates.length >= 2, "Two dates are needed for interactive calendar smoke checks.");
  const quickDate = neighboringDates[0];
  const movedDate = neighboringDates[1];
  const calendarTitle = `Calendar E2E ${randomUUID().slice(0, 8)}`;
  await monthGrid.locator(`[data-calendar-date="${quickDate}"]`).getByRole("button", { name: /Todo 추가/ }).click();
  const calendarDetails = page.getByRole("complementary", { name: "선택한 날짜 상세" });
  const addInput = calendarDetails.getByPlaceholder("이 날짜에 추가할 Todo");
  await addInput.fill(calendarTitle);
  await addInput.locator("xpath=..").getByRole("button", { name: "추가", exact: true }).click();
  await monthGrid.getByRole("button", { name: calendarTitle, exact: true }).waitFor();
  assert.equal((await findServerTodo(calendarTitle))?.date, quickDate, "Calendar quick-add must use selected day.");

  // Mouse drag changes only the execution date, preserving the due date.
  await page.setViewportSize({ width: 1280, height: 844 });
  await monthGrid.getByRole("button", { name: calendarTitle, exact: true })
    .dragTo(monthGrid.locator(`[data-calendar-date="${movedDate}"]`), { steps: 15 });
  for (let i = 0; i < 30; i += 1) {
    if ((await findServerTodo(calendarTitle))?.date === movedDate) break;
    await sleep(200);
  }
  assert.equal((await findServerTodo(calendarTitle))?.date, movedDate, "Drag and drop must persist new execution date.");

  // Date input is the touch/keyboard fallback. A server-side error must leave
  // the Todo on its previous date, keep the chosen date and permit a retry.
  await monthGrid.locator(`[data-calendar-date="${movedDate}"]`)
    .getByRole("button", { name: /일정 .*개 보기/ }).click({ position: { x: 5, y: 5 } });
  await calendarDetails.locator("summary").filter({ hasText: "빠른 날짜 변경" }).click();
  const newDateInput = calendarDetails.getByLabel(`${calendarTitle} 변경할 실행일`);
  await newDateInput.fill(quickDate);
  let failCalendarMoveOnce = true;
  await page.route("**/api/todos/*", async (route) => {
    if (route.request().method() === "PUT" && failCalendarMoveOnce) {
      failCalendarMoveOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"test calendar save failure"}' });
    } else await route.continue();
  });
  await calendarDetails.getByRole("button", { name: "날짜 변경", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "기존 날짜가 유지됩니다" }).waitFor();
  assert.equal((await findServerTodo(calendarTitle))?.date, movedDate, "Failed move must preserve original date.");
  assert.equal(await newDateInput.inputValue(), quickDate, "Failed move retains chosen date.");
  await calendarDetails.getByRole("button", { name: "날짜 변경", exact: true }).click();
  for (let i = 0; i < 30; i += 1) {
    if ((await findServerTodo(calendarTitle))?.date === quickDate) break;
    await sleep(200);
  }
  assert.equal((await findServerTodo(calendarTitle))?.date, quickDate, "Retry persists a changed date.");
  await page.unroute("**/api/todos/*");
  await page.setViewportSize({ width: 390, height: 844 });
  await nav.getByRole("button", { name: "오늘", exact: true }).click();
  await page.getByRole("progressbar", { name: "오늘 완료율", exact: true }).waitFor();
  assert.equal(await page.getByRole("progressbar", { name: "오늘 완료율", exact: true }).getAttribute("aria-valuenow"), "0", "A newly added incomplete Todo must expose a visible 0% progress indicator.");
  await page.getByText("핵심 작업은 최대 3개", { exact: true }).waitFor();
  await page.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).click();
  await page.getByRole("heading", { name: "오늘의 핵심 작업" }).waitFor();
  assert.equal(await page.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).count(), 0, "Pinned Todo must not appear twice.");
  await page.getByRole("button", { name: `${title} 핵심 작업에서 제외` }).click();
  assert.equal(await page.getByRole("heading", { name: "오늘의 핵심 작업" }).count(), 0, "Focus card should collapse after removing the last pinned Todo.");
  await page.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).waitFor();

  await page.keyboard.press("Control+k");
  const search = page.getByRole("dialog", { name: "검색 및 명령" });
  const commandInput = search.getByPlaceholder("검색하거나 실행할 명령 입력");
  await commandInput.fill(title);
  await commandInput.press("ArrowDown");
  await commandInput.press("Enter");
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
  await nav.getByRole("button", { name: "캘린더", exact: true }).click();
  await page.getByRole("tab", { name: "주간", exact: true }).click();
  await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
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

  // Memo: browser drafts, Markdown preview, linked Todo metadata, and partial
  // server-save failure must not create duplicate records.
  await page.evaluate(() => { window.location.hash = "#/memo"; });
  await page.getByRole("heading", { name: "메모", exact: true }).waitFor();
  await page.getByRole("button", { name: "새 메모", exact: true }).click();
  const memoDialog = page.getByRole("dialog", { name: "새 메모" });
  const memoTitle = `Writer E2E ${randomUUID().slice(0, 8)}`;
  await memoDialog.getByPlaceholder("메모 제목").fill(memoTitle);
  await memoDialog.getByPlaceholder("- 떠오른 생각을 적어두세요").fill("# 작성 내용\n- [ ] 검증하기");
  await memoDialog.getByRole("button", { name: "미리보기" }).click();
  await memoDialog.getByText("작성 내용", { exact: true }).waitFor();
  await memoDialog.getByRole("button", { name: "편집" }).click();
  await sleep(550);
  await memoDialog.getByRole("button", { name: "새 메모 닫기" }).click();
  await page.getByRole("button", { name: "새 메모", exact: true }).click();
  const resumedMemo = page.getByRole("dialog", { name: "새 메모" });
  assert.equal(await resumedMemo.getByPlaceholder("메모 제목").inputValue(), memoTitle, "Memo draft must restore after closing the editor.");
  await resumedMemo.locator("details").filter({ hasText: "연결 · Todo" }).locator("summary").click();
  await resumedMemo.getByPlaceholder("연결할 Todo 또는 프로젝트 검색").fill(edited);
  await resumedMemo.getByText(edited, { exact: true }).first().click();
  let failMemoLinksOnce = true;
  await page.route("**/api/memos/*/links", async (route) => {
    if (route.request().method() === "PUT" && failMemoLinksOnce) {
      failMemoLinksOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"memo links test failure"}' });
    } else await route.continue();
  });
  await resumedMemo.getByRole("button", { name: "메모 저장", exact: true }).click();
  await resumedMemo.getByRole("alert").waitFor();
  assert.equal(await resumedMemo.getByPlaceholder("메모 제목").inputValue(), memoTitle);
  await resumedMemo.getByRole("button", { name: "메모 저장", exact: true }).click();
  await resumedMemo.waitFor({ state: "hidden" });
  await page.unroute("**/api/memos/*/links");
  const savedMemos = await page.evaluate(async () => {
    const response = await fetch("/api/memos?limit=100", { credentials: "same-origin" });
    return (await response.json()).memos;
  });
  assert.equal(savedMemos.filter((item) => item.title === memoTitle).length, 1, "Failed memo link save must not duplicate the memo.");
  await page.getByRole("searchbox", { name: "메모 검색" }).fill(edited);
  await page.getByRole("heading", { name: memoTitle, exact: true }).waitFor();
  await page.getByRole("button", { name: "연결됨", exact: true }).click();
  await page.getByRole("heading", { name: memoTitle, exact: true }).waitFor();

  // Scratchpad: failed autosave retains a local copy; restoring it must
  // persist the exact content once the server is reachable.
  await page.evaluate(() => { window.location.hash = "#/scratchpad"; });
  const scratch = page.getByRole("region", { name: "낙서장" });
  const scratchEditor = scratch.getByRole("textbox", { name: "낙서장 편집기" });
  await scratchEditor.waitFor();
  const scratchContent = `Scratchpad E2E ${randomUUID().slice(0, 8)}\n남아야 할 두 번째 줄`;
  let failScratchOnce = true;
  await page.route("**/api/scratchpad", async (route) => {
    if (route.request().method() === "PUT" && failScratchOnce) {
      failScratchOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"scratchpad test save failure"}' });
    } else await route.continue();
  });
  await scratchEditor.fill(scratchContent);
  await scratch.getByRole("button", { name: "저장 재시도" }).waitFor();
  assert.ok(await page.evaluate(() => localStorage.getItem("dark-todo-planner:scratchpad-recovery")?.includes("Scratchpad E2E")), "Local scratchpad draft must survive API failure.");
  await page.unroute("**/api/scratchpad");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "초안 복원" }).waitFor();
  await page.getByRole("button", { name: "초안 복원" }).click();
  assert.equal(await scratchEditor.inputValue(), scratchContent);
  let serverScratch = "";
  for (let i = 0; i < 40; i += 1) {
    serverScratch = await page.evaluate(async () => {
      const response = await fetch("/api/scratchpad", { credentials: "same-origin" });
      return (await response.json()).scratchpad.content;
    });
    if (serverScratch === scratchContent) break;
    await sleep(250);
  }
  assert.equal(serverScratch, scratchContent, "Recovered scratchpad must persist to server.");
  await scratch.getByText("저장됨", { exact: true }).first().waitFor();

  // Layout probes at common mobile, tablet and desktop breakpoints.
  // Retain screenshots as review artifacts; geometry failure blocks deployment.
  await mkdir("test-artifacts", { recursive: true });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const view of ["today", "calendar", "projects", "settings", "memo", "scratchpad"]) {
      await page.evaluate((next) => { window.location.hash = "#/" + next; }, view);
      if (view === "today") await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();
      if (view === "calendar") await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
      if (view === "projects") await page.getByRole("heading", { name: "프로젝트", exact: true }).waitFor();
      if (view === "settings") await page.getByRole("heading", { name: "설정", exact: true }).waitFor();
      if (view === "memo") await page.getByRole("heading", { name: "메모", exact: true }).waitFor();
      if (view === "scratchpad") await page.getByRole("textbox", { name: "낙서장 편집기" }).waitFor();
      const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }));
      assert.ok(geometry.document <= geometry.viewport + 2, `Unexpected page overflow at ${width}px on ${view}: ${JSON.stringify(geometry)}`);
      await page.screenshot({ path: `test-artifacts/layout-${width}-${view}.png`, fullPage: true });
    }
  }

  console.log("BROWSER E2E PASS: Today, history, settings tabs, projects tabs, keyboard/search, and 24 responsive layout snapshots.");
} catch (error) {
  failed = true;
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/browser-smoke-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
}
