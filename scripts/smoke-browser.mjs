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
  // G2 follow-up: a task-focused Today header replaces the oversized KPI board.
  await page.setViewportSize({ width: 1440, height: 900 });
  const visualSystem = await page.evaluate(() => {
    const section = document.querySelector(".today-task-section");
    const composer = document.querySelector(".today-composer");
    const header = document.querySelector(".today-header");
    const status = document.querySelector(".today-header__status");
    const digest = document.querySelector(".today-digest");
    const primary = document.querySelector("header .ui-button--primary");
    if (!section || !composer || !header || !status || !digest || !primary) return null;
    const sectionStyle = getComputedStyle(section);
    const composerStyle = getComputedStyle(composer);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      sectionRadius: sectionStyle.borderTopLeftRadius,
      sectionBackground: sectionStyle.backgroundColor,
      sectionBorderTop: sectionStyle.borderTopWidth,
      composerBackground: composerStyle.backgroundColor,
      headerHeight: header.getBoundingClientRect().height,
      firstTaskOffset: section.getBoundingClientRect().top - header.getBoundingClientRect().top,
      headerText: status.textContent,
      oldDashboardCount: document.querySelectorAll(".today-overview__stat").length,
      digestBorderTop: getComputedStyle(digest).borderTopWidth,
      todayWidth: document.querySelector(".today-page").getBoundingClientRect().width,
      hasSidebar: Boolean(document.querySelector(".today-sidebar")),
      primaryBackground: getComputedStyle(primary).backgroundColor,
      accent: rootStyle.getPropertyValue("--accent").trim(),
      canvas: rootStyle.getPropertyValue("--app-bg").trim(),
    };
  });
  assert.ok(visualSystem, "Today must contain a compact status header and task entry.");
  assert.equal(visualSystem.sectionRadius, "0px", "Tasks must not become a rounded card.");
  assert.equal(visualSystem.sectionBackground, "rgba(0, 0, 0, 0)", "Tasks must stay on the workspace canvas.");
  assert.equal(visualSystem.sectionBorderTop, "0px", "Task sections must not be enclosed.");
  assert.equal(visualSystem.composerBackground, "rgba(0, 0, 0, 0)", "Collapsed inline entry should not create an empty card.");
  assert.ok(visualSystem.headerHeight <= 90, "Today heading/status must be compact.");
  assert.ok(visualSystem.firstTaskOffset <= 140, "Task entry should appear close to the header.");
  assert.equal(visualSystem.oldDashboardCount, 0, "Old KPI grid must not return.");
  assert.ok(visualSystem.headerText.includes("중"), "Concise completion summary must remain visible.");
  assert.equal(visualSystem.digestBorderTop, "1px", "Weekly and overdue summary should have a quiet separator.");
  assert.equal(visualSystem.hasSidebar, false, "Today must not retain a disconnected right rail.");
  assert.ok(visualSystem.todayWidth <= 890, "Today content should stay within the readable single-column width.");
  assert.equal(visualSystem.accent, "#d4d4d8", "Accent must remain neutral.");
  assert.equal(visualSystem.canvas, "#101011", "Canvas must stay near-black.");
  assert.equal(visualSystem.primaryBackground, "rgb(226, 226, 229)", "Primary action should remain neutral.");
  // G6.4: primary, search, active navigation and warning stay visually distinct.
  const buttonSystem = await page.evaluate(() => {
    const search = document.querySelector("header .app-search-button");
    const activeNav = document.querySelector('.app-nav-button[aria-current="page"]');
    const warning = document.querySelector(".today-header__action");
    return {
      searchVisible: Boolean(search && search.getBoundingClientRect().width > 0),
      searchBackground: search ? getComputedStyle(search).backgroundColor : "",
      activeNavBackground: activeNav ? getComputedStyle(activeNav).backgroundColor : "",
      activeNavIcon: activeNav?.querySelector("svg") ? getComputedStyle(activeNav.querySelector("svg")).color : "",
      warningBackground: warning ? getComputedStyle(warning).backgroundColor : "",
      accent: getComputedStyle(document.documentElement).getPropertyValue("--info").trim(),
    };
  });
  assert.equal(buttonSystem.searchVisible, true, "Search should be available in desktop header.");
  assert.notEqual(buttonSystem.searchBackground, visualSystem.primaryBackground, "Search and Add need separate priority.");
  assert.notEqual(buttonSystem.activeNavBackground, "rgba(0, 0, 0, 0)", "Active navigation must use a soft state tint.");
  assert.equal(buttonSystem.accent, "#93b4ff", "Blue info is reserved for active navigation and focus.");
  assert.notEqual(buttonSystem.activeNavIcon, "", "Current view has a visible icon state.");
  if (buttonSystem.warningBackground) {
    assert.notEqual(buttonSystem.warningBackground, visualSystem.primaryBackground, "Day cleanup must use warning tone.");
  }

  // G6.7: overdue review uses flat date rows, and bulk trash must only remove selected IDs.
  // Fixture dates are deliberately long before today, using an isolated local D1 account.
  const overduePrefix = "G67 Overdue " + randomUUID().slice(0, 8);
  const overdueNames = [0, 1, 2, 3].map((index) => overduePrefix + "-" + index);
  const overdueFixture = await page.evaluate(async (titles) => {
    const results = [];
    for (let index = 0; index < titles.length; index += 1) {
      const response = await fetch("/api/todos", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: titles[index], date: index < 2 ? "2025-05-13" : "2025-05-12",
          planningState: "SCHEDULED", priority: "MEDIUM",
        }),
      });
      const payload = await response.json();
      results.push({ status: response.status, payload });
    }
    return results;
  }, overdueNames);
  assert.ok(overdueFixture.every((item) => item.status >= 200 && item.status < 300),
    "Local D1 overdue fixtures should be created: " + JSON.stringify(overdueFixture));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "정리하기", exact: true }).click();
  const overdueDialog = page.getByRole("dialog", { name: "지난 일정 정리" });
  await overdueDialog.getByRole("button", { name: "전체 선택", exact: true }).click();
  assert.ok((await overdueDialog.getByRole("button", { name: "선택 4개 삭제" }).count()) === 1,
    "All-selection must expose one clear bulk delete control.");
  await overdueDialog.getByRole("button", { name: "선택 해제" }).click();
  const dateA = overdueDialog.locator(".overdue-review__date").filter({ hasText: "5월 13일" });
  const dateB = overdueDialog.locator(".overdue-review__date").filter({ hasText: "5월 12일" });
  await dateA.getByRole("checkbox", { name: /Todo 전체 선택/ }).check();
  await dateB.locator(".overdue-review__task").filter({ hasText: overdueNames[2] }).getByRole("checkbox").check();
  const selectedDelete = overdueDialog.getByRole("button", { name: "선택 3개 삭제" });
  assert.equal(await selectedDelete.isDisabled(), false);
  const flatRows = await overdueDialog.evaluate((el) => ({
    rowRadius: getComputedStyle(el.querySelector(".overdue-review__date")).borderTopLeftRadius,
    footer: !!el.querySelector(".overdue-review__footer"),
    oldNestedCards: el.querySelectorAll(".overdue-review__date.rounded-md").length,
  }));
  assert.equal(flatRows.rowRadius, "0px", "Overdue date list must be flat rather than a rounded card stack.");
  assert.equal(flatRows.footer, true, "Actions should stay grouped in the modal footer.");
  assert.equal(flatRows.oldNestedCards, 0, "Old nested bulk-selection cards must be removed.");
  // Dismissal must never change data.
  page.once("dialog", (dialog) => dialog.dismiss());
  await selectedDelete.click();
  assert.ok(await findServerTodo(overdueNames[0]), "Cancel must preserve overdue Todo.");
  // Simulate a failing API; no offline queue or false success should be reported.
  let rejectBulkOnce = true;
  await page.route("**/api/todos/bulk-trash", async (route) => {
    if (rejectBulkOnce) {
      rejectBulkOnce = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"isolated bulk rejection"}' });
    } else await route.continue();
  });
  page.once("dialog", (dialog) => dialog.accept());
  await selectedDelete.click();
  await overdueDialog.getByRole("alert").waitFor();
  assert.ok(await findServerTodo(overdueNames[0]), "Failed bulk delete must retain server records.");
  await page.unroute("**/api/todos/bulk-trash");
  page.once("dialog", (dialog) => dialog.accept());
  await selectedDelete.click();
  await overdueDialog.getByText("3개를 휴지통으로 이동했습니다.", { exact: false }).waitFor();
  await page.waitForFunction(async (titles) => {
    const response = await fetch("/api/todos?archived=all&limit=100", { credentials: "same-origin" });
    const payload = await response.json();
    const remaining = (payload.todos || []).map((item) => item.title);
    return !remaining.includes(titles[0]) && !remaining.includes(titles[1]) &&
      !remaining.includes(titles[2]) && remaining.includes(titles[3]);
  }, overdueNames);
  const deletedTrashRecords = await page.evaluate(async (titles) => {
    const response = await fetch("/api/trash/todos", { credentials: "same-origin" });
    const payload = await response.json();
    return { status: response.status, matches: (payload.trashTodos || []).filter((row) => titles.includes(row.title)) };
  }, overdueNames);
  assert.equal(deletedTrashRecords.status, 200);
  assert.equal(deletedTrashRecords.matches.length, 3,
    "Only the selected Todo items must be recoverable in local D1 trash.");
  await overdueDialog.getByRole("button", { name: "닫기", exact: true }).click();

  await page.setViewportSize({ width: 390, height: 844 });


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

  // G1: user-selectable theme and OS preference changes must not need a reload.
  const themeControls = page.getByRole("group", { name: "화면 테마 선택" });
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
  assert.equal(await themeControls.getByRole("button", { name: "다크" }).getAttribute("aria-pressed"), "true");
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/layout-theme-dark-settings-390.png", fullPage: true });
  await themeControls.getByRole("button", { name: "라이트" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim().toLowerCase()), "#f7f7f8");
  assert.equal(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().toLowerCase()), "#26262a");
  assert.equal(await page.evaluate(() => localStorage.getItem("dark-todo-planner:theme")), "light");
  await page.screenshot({ path: "test-artifacts/layout-theme-light-settings-390.png", fullPage: true });
  await page.emulateMedia({ colorScheme: "light" });
  await themeControls.getByRole("button", { name: "시스템" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
  assert.equal(await page.locator("html").getAttribute("data-theme-preference"), "system");
  await themeControls.getByRole("button", { name: "다크" }).click();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");

  // G3: a historical INBOX row remains stored unchanged and is reachable
  // via All Todo, while no new Inbox UI or input shortcut can produce it.
  assert.equal(await nav.getByRole("button", { name: "받은함", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "전체 Todo", exact: true }).count(), 1);
  const legacyTitle = `Legacy unplanned ${randomUUID().slice(0, 8)}`;
  const legacyCreate = await page.evaluate(async (title) => {
    const response = await fetch("/api/todos", {
      method: "POST", credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title, date: "9999-12-31", planningState: "INBOX", priority: "MEDIUM" }),
    });
    return { status: response.status, body: await response.json() };
  }, legacyTitle);
  assert.ok(legacyCreate.status >= 200 && legacyCreate.status < 300,
    `Legacy fixture must be inserted only in isolated D1: ${JSON.stringify(legacyCreate)}`);
  await page.goto(new URL("/#/inbox", base).toString(), { waitUntil: "domcontentloaded" });
  // Navigating to a different hash is same-document; reload to refetch the fixture from local D1.
  await page.reload({ waitUntil: "domcontentloaded" });
  assert.equal((await findServerTodo(legacyTitle))?.planningState, "INBOX", "Local D1 fixture should survive reload.");
  await page.getByRole("heading", { name: "전체 Todo", exact: true }).waitFor();
  assert.equal(new URL(page.url()).hash, "#/all", "Old Inbox bookmarks must redirect to All Todo.");
  // The view renders before asynchronous Todo hydration finishes.
  // Wait for the legacy fixture to become visible before checking its count control.
  await page.getByRole("heading", { name: legacyTitle, exact: true }).waitFor();
  const unplannedButton = page.getByRole("button", { name: /미계획 \d+개 보기/ });
  await unplannedButton.click();
  const legacyRow = page.locator(".todo-row").filter({ has: page.getByRole("heading", { name: legacyTitle, exact: true }) });
  await legacyRow.waitFor();
  await legacyRow.getByText("미계획", { exact: true }).waitFor();
  assert.equal((await findServerTodo(legacyTitle))?.planningState, "INBOX");
  await page.getByRole("button", { name: "고급 필터", exact: true }).click();
  assert.equal(await page.getByRole("combobox", { name: "계획 상태 필터" }).inputValue(), "INBOX");
  // Advanced filters stay expanded on mobile: Todo actions must still be reachable.
  await legacyRow.evaluate((row) => row.scrollIntoView({ block: "center", inline: "nearest" }));
  const editLegacy = legacyRow.getByRole("button", { name: `"${legacyTitle}" Todo 수정` });
  await editLegacy.click();
  const legacyEdit = page.getByRole("dialog", { name: "Todo 수정" });
  await legacyEdit.getByRole("combobox", { name: "보관 위치" }).waitFor();
  assert.equal(await legacyEdit.getByRole("combobox", { name: "보관 위치" }).inputValue(), "INBOX");
  // Ordinary metadata edits must not silently move old INBOX records into Today.
  await legacyEdit.getByRole("combobox", { name: "우선순위" }).selectOption("HIGH");
  await legacyEdit.getByRole("button", { name: "저장", exact: true }).click();
  await legacyEdit.waitFor({ state: "hidden" });
  const preservedLegacy = await findServerTodo(legacyTitle);
  assert.equal(preservedLegacy?.planningState, "INBOX");
  assert.equal(preservedLegacy?.date, "9999-12-31");
  assert.equal(preservedLegacy?.priority, "HIGH");
  await legacyRow.evaluate((row) => row.scrollIntoView({ block: "center", inline: "nearest" }));
  await editLegacy.click();
  await legacyEdit.getByRole("combobox", { name: "보관 위치" }).selectOption("SCHEDULED");
  await legacyEdit.getByLabel("실행일").fill("2026-11-12");
  let legacyUpdateFailure = true;
  await page.route("**/api/todos/*", async (route) => {
    if (route.request().method() === "PUT" && legacyUpdateFailure) {
      legacyUpdateFailure = false;
      await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"isolated injected failure"}' });
    } else await route.continue();
  });
  await legacyEdit.getByRole("button", { name: "저장", exact: true }).click();
  await legacyEdit.getByRole("alert").waitFor();
  assert.equal((await findServerTodo(legacyTitle))?.planningState, "INBOX",
    "Failed schedule update must preserve the legacy planning state.");
  await legacyEdit.getByRole("button", { name: "저장", exact: true }).click();
  await page.waitForFunction(async (title) => {
    const response = await fetch("/api/todos?archived=all&limit=100");
    const body = await response.json();
    return body.todos?.find((todo) => todo.title === title)?.planningState === "SCHEDULED";
  }, legacyTitle);
  assert.equal((await findServerTodo(legacyTitle))?.date, "2026-11-12");
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
  await page.getByRole("group", { name: "오늘 작업 현황", exact: true }).waitFor();
  await page.getByText("오늘 예정된 일이 없습니다.", { exact: true }).waitFor();
  assert.equal(await page.getByText("첫 작업", { exact: true }).count(), 0, "Empty state should be a single calm line.");
  assert.equal(await page.getByRole("heading", { name: "오늘의 핵심 작업" }).count(), 0, "Do not render empty focus card.");
  assert.equal(await page.getByText("미완료 Todo가 없습니다.", { exact: true }).count(), 0, "Do not repeat zero-state placeholders.");
  assert.equal(await page.getByRole("button", { name: "카테고리 관리" }).count(), 1, "Keep category management discoverable even when Today is empty.");
  assert.equal(await page.locator('section[aria-label="오늘 Todo"]').count(), 1, "Todo entry must remain available while empty.");


  // Isolated D1 fixtures exercise real project/category selection and persistence.
  const menuFixtures = await page.evaluate(async () => {
    const post = async (path, name) => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error(`Fixture ${path} failed: ${response.status}`);
      return response.json();
    };
    const suffix = Date.now().toString(36);
    const category = await post("/api/categories", `Inline category ${suffix}`);
    const project = await post("/api/projects", `Inline project ${suffix}`);
    return { category: category.category, project: project.project };
  });
  assert.ok(menuFixtures.category?.id && menuFixtures.project?.id, "Local category/project fixtures should exist.");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "오늘", exact: true }).waitFor();

  // G6.1: Today starts as one inline add action, without a permanent form card.
  const composerTrigger = page.locator(".today-composer").getByRole("button", { name: "할 일 추가" });
  await composerTrigger.waitFor();
  assert.equal(await page.locator(".today-composer form").count(), 0);
  await composerTrigger.click();
  const composer = page.getByRole("form", { name: "Todo 빠른 추가" });
  await composer.getByRole("textbox", { name: "Todo 제목" }).waitFor();
  // G6.3: compact chips replace the permanent date/priority/project input boxes.
  assert.equal(await composer.locator(".todo-composer-form__chips").count(), 1);
  assert.equal(await composer.locator('[data-composer-selection="우선순위"]').getAttribute("data-selected-value"), "MEDIUM");
  const dateChip = composer.locator(".todo-composer-chip-menu--date > summary");
  assert.ok((await dateChip.innerText()).includes("오늘"));
  await dateChip.click();
  assert.equal((await composer.getByLabel("실행 날짜").inputValue()).length, 10);
  await composer.getByRole("group", { name: "날짜 빠른 선택" }).getByRole("button", { name: "내일", exact: true }).click();
  assert.ok((await dateChip.innerText()).includes("내일"));
  await dateChip.click();
  await composer.getByRole("group", { name: "날짜 빠른 선택" }).getByRole("button", { name: "언젠가", exact: true }).click();
  assert.ok((await dateChip.innerText()).includes("언젠가"));
  await dateChip.click();
  await composer.getByRole("group", { name: "날짜 빠른 선택" }).getByRole("button", { name: "오늘", exact: true }).click();
  assert.ok((await dateChip.innerText()).includes("오늘"));
  // Esc keeps unsaved text locally; another click restores the draft.
  const draft = `Unsubmitted draft ${randomUUID().slice(0, 6)}`;
  await composer.getByRole("textbox", { name: "Todo 제목" }).fill(draft);
  await composer.getByRole("textbox", { name: "Todo 제목" }).press("Escape");
  await composerTrigger.waitFor();
  assert.equal(await page.locator(".today-composer form").count(), 0);
  await composerTrigger.click();
  assert.equal(await composer.getByRole("textbox", { name: "Todo 제목" }).inputValue(), draft);
  // Date input lives inside the compact date popover; project/priority stay visible.
  await dateChip.click();
  await composer.getByLabel("실행 날짜").waitFor();
  await dateChip.click();
  // Each chip is a custom visible menu, not an inconsistent native select.
  const priorityChip = composer.locator('[data-composer-selection="우선순위"] > summary');
  await priorityChip.click();
  const priorityOptions = composer.getByRole("group", { name: "우선순위 선택 항목" });
  await priorityOptions.getByRole("button", { name: "높음" }).click();
  assert.equal(await composer.locator('[data-composer-selection="우선순위"]').getAttribute("data-selected-value"), "HIGH");
  assert.equal(await composer.locator('[data-composer-selection="우선순위"]').getAttribute("open"), null,
    "Choosing an option closes its menu.");
  await priorityChip.click();
  await priorityOptions.getByRole("button", { name: "보통" }).click();

  const projectChip = composer.locator('[data-composer-selection="프로젝트"] > summary');
  await projectChip.click();
  await composer.getByRole("group", { name: "프로젝트 선택 항목" })
    .getByRole("button", { name: menuFixtures.project.name }).click();
  assert.equal(await composer.locator('[data-composer-selection="프로젝트"]').getAttribute("data-selected-value"),
    menuFixtures.project.id, "Selected project should remain visible in inline metadata.");

  const categoryChip = composer.locator('[data-composer-selection="카테고리"] > summary');
  await categoryChip.click();
  await composer.getByRole("group", { name: "카테고리 선택 항목" })
    .getByRole("button", { name: menuFixtures.category.name }).click();
  assert.equal(await composer.locator('[data-composer-selection="카테고리"]').getAttribute("data-selected-value"),
    menuFixtures.category.id, "Selected category should remain visible in inline metadata.");

  // Outside click closes the active menu without discarding text or selections.
  await categoryChip.click();
  await composer.getByRole("textbox", { name: "Todo 제목" }).click();
  assert.equal(await composer.locator('[data-composer-selection="카테고리"]').getAttribute("open"), null);
  // Once a category has been selected, Esc should preserve that selection and the text draft.
  await composer.getByRole("textbox", { name: "Todo 제목" }).press("Escape");
  await composerTrigger.waitFor();
  await composerTrigger.click();
  assert.equal(await composer.getByRole("textbox", { name: "Todo 제목" }).inputValue(), draft);
  assert.equal(await composer.locator('[data-composer-selection="카테고리"]').getAttribute("data-selected-value"),
    menuFixtures.category.id, "Esc must retain selected category after it was chosen.");

  const composerToggle = composer.getByRole("button", { name: "상세 옵션", exact: true });
  await composerToggle.waitFor();
  assert.equal(await composerToggle.getAttribute("aria-expanded"), "false");
  const mainLayout = await composer.evaluate((el) => {
    const input = el.querySelector('[data-quick-todo-input="true"]');
    const main = el.querySelector(".todo-composer-form__main");
    const footer = el.querySelector(".todo-composer-form__footer--inline");
    const chips = el.querySelector(".todo-composer-form__chips");
    const titleSurface = el.querySelector(".todo-composer-form__title");
    const submit = main?.querySelector('button[type="submit"]');
    const meta = el.querySelector(".todo-composer-form__meta-row");
    if (!(input instanceof HTMLElement) || !(main instanceof HTMLElement) ||
        !(footer instanceof HTMLElement) || !(chips instanceof HTMLElement) ||
        !(titleSurface instanceof HTMLElement) || !(submit instanceof HTMLButtonElement) ||
        !(meta instanceof HTMLElement)) return null;
    return {
      titleWidth: input.getBoundingClientRect().width,
      formWidth: el.getBoundingClientRect().width,
      titleBorder: getComputedStyle(titleSurface).borderTopWidth,
      submitInTitleRow: Math.abs(submit.getBoundingClientRect().top - input.getBoundingClientRect().top) < 12,
      submitRadius: getComputedStyle(submit).borderTopLeftRadius,
      submitHasPlusIcon: Boolean(submit.querySelector("svg")),
      metaHasActions: meta.contains(footer) && meta.contains(chips),
      footerNoDivider: getComputedStyle(footer).borderTopWidth === "0px",
      footerSameRowAsChips: Math.abs(footer.getBoundingClientRect().top - chips.getBoundingClientRect().top) < 12,
      composerWidth: el.closest(".today-composer")?.getBoundingClientRect().width,
    };
  });
  assert.ok(mainLayout && mainLayout.titleWidth > mainLayout.formWidth * 0.72,
    "G6.8: title should be the dominant first-row input.");
  assert.equal(mainLayout.titleBorder, "0px", "Title must not look like a nested input box.");
  assert.equal(mainLayout.submitInTitleRow, true, "Small Add button belongs next to the title.");
  assert.equal(mainLayout.submitHasPlusIcon, false, "Add button no longer duplicates the entry plus icon.");
  assert.equal(mainLayout.submitRadius, "3px", "Submit should use sharp restrained corners.");
  assert.equal(mainLayout.metaHasActions, true, "Metadata, details and cancel must share the same row.");
  assert.equal(mainLayout.footerNoDivider, true, "Avoid a separated card-like footer.");
  assert.ok(mainLayout.formWidth < 600 || mainLayout.footerSameRowAsChips,
    "On desktop metadata and secondary actions share a line; mobile may wrap without clipping.");
  assert.ok(mainLayout.composerWidth <= 765, "The composer should have a practical desktop max width.");
  assert.equal(await composer.getByRole("button", { name: "추가", exact: true }).isDisabled(), false,
    "Entered draft enables the compact Add button.");
  await composerToggle.click();
  await composer.getByRole("group", { name: "Todo 상세 옵션" }).waitFor();
  for (const name of ["일정", "분류", "메모"]) {
    assert.equal(await composer.getByRole("group", { name, exact: true }).count(), 1,
      "Advanced options must group fields by purpose: " + name);
  }
  await composer.getByRole("group", { name: "분류" }).getByLabel("우선순위").selectOption("HIGH");
  await composer.getByRole("button", { name: "상세 옵션 닫기", exact: true }).click();
  assert.equal(await composer.getByRole("group", { name: "Todo 상세 옵션" }).count(), 0);
  assert.equal(await composer.locator('[data-composer-selection="우선순위"]').getAttribute("data-selected-value"), "HIGH",
    "Collapsing details must not discard the current form state.");
  await priorityChip.click();
  await priorityOptions.getByRole("button", { name: "보통" }).click();

  // IME composition must not submit a half-written Korean title.
  const quickTitleField = composer.getByRole("textbox", { name: "Todo 제목" });
  await quickTitleField.fill("한글 조합 확인");
  await quickTitleField.evaluate((input) => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true, data: "인" })));
  await quickTitleField.press("Enter");
  assert.equal(await composer.count(), 1, "Enter during composition must not collapse the form.");
  assert.equal(await quickTitleField.inputValue(), "한글 조합 확인");
  await quickTitleField.evaluate((input) => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "인" })));

  const title = `Browser Todo ${randomUUID().slice(0, 8)}`;
  const edited = title + " edited";
  const quickInput = page.locator('input[data-quick-todo-input="true"]');
  await quickInput.fill(title);
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await composerTrigger.waitFor();
  assert.equal(await page.locator(".today-composer form").count(), 0, "Successful inline add should return to quiet state.");
  await page.getByText(title, { exact: true }).first().waitFor();
  const savedInlineTodo = await findServerTodo(title);
  assert.ok(savedInlineTodo, "Todo create should persist to local D1.");
  assert.equal(savedInlineTodo.categoryId, menuFixtures.category.id, "Inline category selection must be persisted.");
  assert.equal(savedInlineTodo.projectId, menuFixtures.project.id, "Inline project selection must be persisted.");
  assert.equal(savedInlineTodo.priority, "MEDIUM", "Inline priority selection must be persisted.");
  // Readability regression: a task is a distinct text-first row, not a barely
  // visible line or a nested rounded card.
  const createdRow = page.locator(".todo-row").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
  const todoVisual = await createdRow.evaluate((row) => {
    const heading = row.querySelector("h4");
    if (!heading) throw new Error("Todo title heading missing");
    const rowStyle = getComputedStyle(row);
    const titleStyle = getComputedStyle(heading);
    return {
      size: parseFloat(titleStyle.fontSize),
      lineHeight: parseFloat(titleStyle.lineHeight),
      divider: rowStyle.borderBottomWidth,
      dividerColor: rowStyle.borderBottomColor,
      todayVariant: row.classList.contains("todo-row--today"),
      leadingAction: !!row.querySelector('button[aria-label*="핵심 작업으로 고정"]') && !row.querySelector("details"),
    };
  });
  assert.ok(todoVisual.size >= 16 && todoVisual.lineHeight >= 24, "Today Todo titles need a legible 16px/24px hierarchy.");
  assert.equal(todoVisual.divider, "1px", "Todo rows must have a real separator.");
  assert.equal(todoVisual.todayVariant, true, "Today Todo rows must use the dedicated editorial presentation.");
  assert.equal(todoVisual.leadingAction, false, "G6.2: Todo row should not show a permanent pin button.");
  // G6: reviewing today's tasks must never reschedule them by default.
  const dayCloseBefore = (await findServerTodo(title))?.date;
  await page.getByRole("button", { name: /오늘 정리/ }).click();
  const dayClose = page.getByRole("dialog", { name: "오늘 정리" });
  const closeDecision = dayClose.getByRole("combobox", { name: new RegExp(title + ".*오늘 정리 처리") });
  assert.equal(await closeDecision.inputValue(), "KEEP");
  assert.equal(await dayClose.getByRole("button", { name: /선택한 .*개 반영/ }).isDisabled(), true);
  await dayClose.getByRole("button", { name: "취소" }).click();
  assert.equal((await findServerTodo(title))?.date, dayCloseBefore, "Cancelling today review must not move the Todo.");
  // The month dashboard must expose real Todo titles and allow filtering and
  // opening/closing the detail pane, not just numeric day summaries.
  await nav.getByRole("button", { name: "캘린더", exact: true }).click();
  await page.getByRole("heading", { name: "캘린더", exact: true }).waitFor();
  const monthGrid = page.getByRole("region", { name: "월간 일정 캘린더" });
  await monthGrid.getByRole("button", { name: title, exact: true }).waitFor();
  const desktopCell = await monthGrid.locator(".calendar-day").first().evaluate((cell) => cell.getBoundingClientRect().height);
  assert.ok(desktopCell <= 122, `G6.1 compact calendar must not exceed 122px: ${desktopCell}`);
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
  // G6.2: task actions remain keyboard/touch accessible in a single menu.
  const openTodoActions = async () => {
    const row = page.locator(".todo-row--today").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await row.locator("summary").click();
    return row;
  };
  let actionsRow = await openTodoActions();
  await actionsRow.getByRole("button", { name: `${title} 핵심 작업으로 고정` }).click();
  await page.getByRole("heading", { name: "오늘의 핵심 작업" }).waitFor();
  assert.equal(await page.locator(".todo-row--today").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).count(), 1,
    "Pinned Todo must not be rendered twice.");
  actionsRow = await openTodoActions();
  await actionsRow.getByRole("button", { name: `${title} 핵심 작업에서 제외` }).click();
  assert.equal(await page.getByRole("heading", { name: "오늘의 핵심 작업" }).count(), 0,
    "Focus section should collapse after removing the last pinned Todo.");
  actionsRow = await openTodoActions();
  await actionsRow.getByRole("button", { name: `"${title}" Todo 수정` }).waitFor();
  await actionsRow.locator("summary").click();

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
  await composerTrigger.click();
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
  await page.getByText("아직 등록한 프로젝트 작업이 없습니다.", { exact: true }).waitFor();
  // Inputs previously expanded across the entire desktop toolbar because
  // .field.field overrode explicit Tailwind width utilities.
  await page.setViewportSize({ width: 1280, height: 844 });
  const kanbanFilterWidths = await page.evaluate(() => {
    const search = document.querySelector('input[aria-label="프로젝트 작업 검색"]');
    const milestone = document.querySelector('select[aria-label="마일스톤 필터"]');
    if (!search || !milestone) return null;
    return { search: search.getBoundingClientRect().width,
      milestone: milestone.getBoundingClientRect().width,
      viewport: window.innerWidth, document: document.documentElement.scrollWidth };
  });
  assert.ok(kanbanFilterWidths, "Project search and milestone controls must exist.");
  assert.ok(kanbanFilterWidths.search >= 180 && kanbanFilterWidths.search <= 300,
    `Project search width must be controlled: ${JSON.stringify(kanbanFilterWidths)}`);
  assert.ok(kanbanFilterWidths.milestone >= 150 && kanbanFilterWidths.milestone <= 225,
    `Milestone filter must not fill the toolbar: ${JSON.stringify(kanbanFilterWidths)}`);
  assert.ok(kanbanFilterWidths.document <= kanbanFilterWidths.viewport + 2,
    "Project controls must not overflow the desktop viewport.");
  await page.setViewportSize({ width: 390, height: 844 });
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
  // G6.5: color selection must persist and be rendered, not be discarded.
  await resumedMemo.getByRole("button", { name: "파랑", exact: true }).click();
  assert.equal(await resumedMemo.getByRole("button", { name: "파랑", exact: true }).getAttribute("aria-pressed"), "true");
  await resumedMemo.getByRole("button", { name: "메모 저장", exact: true }).click();
  await resumedMemo.waitFor({ state: "hidden" });
  await page.unroute("**/api/memos/*/links");
  const savedMemos = await page.evaluate(async () => {
    const response = await fetch("/api/memos?limit=100", { credentials: "same-origin" });
    return (await response.json()).memos;
  });
  assert.equal(savedMemos.filter((item) => item.title === memoTitle).length, 1, "Failed memo link save must not duplicate the memo.");
  assert.equal(savedMemos.find((item) => item.title === memoTitle)?.color, "#3b82f6", "Chosen memo color must persist.");
  const memoCard = page.locator(".memo-note").filter({ has: page.getByRole("heading", { name: memoTitle, exact: true }) });
  await memoCard.waitFor();
  const noteAccent = await memoCard.evaluate((node) => ({
    accent: node.style.getPropertyValue("--memo-accent"),
    stripe: getComputedStyle(node, "::before").backgroundColor,
    topBorder: getComputedStyle(node).borderTopWidth,
    bottomBorder: getComputedStyle(node).borderBottomWidth,
    radius: getComputedStyle(node).borderTopLeftRadius,
    background: getComputedStyle(node).backgroundColor,
  }));
  assert.equal(noteAccent.accent, "#3b82f6", "Memo accent must keep the stored color.");
  assert.equal(noteAccent.stripe, "rgb(59, 130, 246)", "Accent color should be a narrow stripe, not a filled card.");
  assert.equal(noteAccent.background, "rgba(0, 0, 0, 0)", "Idle editorial memo panel must stay transparent.");
  assert.equal(noteAccent.topBorder, "1px");
  assert.equal(noteAccent.bottomBorder, "1px");
  assert.equal(noteAccent.radius, "0px", "Editorial notes should have square corners.");
  // Four former action icons should be consolidated in an accessible disclosure.
  const memoActions = memoCard.locator(".memo-actions");
  assert.equal(await memoActions.evaluate((element) => element.open), false);
  await memoActions.locator("summary").click();
  assert.equal(await memoActions.evaluate((element) => element.open), true);
  await memoActions.getByRole("button", { name: "메모 고정", exact: true }).waitFor();
  await memoActions.getByRole("button", { name: "Todo로 만들기", exact: true }).waitFor();
  await memoActions.getByRole("button", { name: "삭제", exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await memoActions.evaluate((element) => element.open), false, "Escape must close the action disclosure.");
  await memoActions.locator("summary").click();
  await memoActions.getByRole("button", { name: "수정", exact: true }).click();
  const memoEditDialog = page.getByRole("dialog", { name: "메모 수정" });
  await memoEditDialog.waitFor();
  await memoEditDialog.getByRole("button", { name: "메모 수정 닫기" }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  const memoLayout = await page.evaluate(() => ({
    cols: getComputedStyle(document.querySelector(".memo-note-grid")).gridTemplateColumns.split(" ").length,
    width: document.querySelector(".memo-collections").getBoundingClientRect().width,
  }));
  assert.ok(memoLayout.width >= 1050 && memoLayout.cols === 2,
    `Desktop memos need a balanced 2-column reading layout: ${JSON.stringify(memoLayout)}`);
  const newMemoButton = page.getByRole("button", { name: "새 메모", exact: true });
  const memoCreateAppearance = await newMemoButton.evaluate((button) => ({
    radius: getComputedStyle(button).borderTopLeftRadius,
    background: getComputedStyle(button).backgroundColor,
    primary: getComputedStyle(document.querySelector("header .ui-button--primary")).backgroundColor,
  }));
  assert.equal(memoCreateAppearance.radius, "2px", "New memo should have sharp corners.");
  assert.notEqual(memoCreateAppearance.background, memoCreateAppearance.primary, "New memo should be an outline action, not a second bright CTA.");
  await page.getByRole("searchbox", { name: "메모 검색" }).fill(edited);
  await page.getByRole("heading", { name: memoTitle, exact: true }).waitFor();
  await page.getByRole("button", { name: "메모 검색어 지우기" }).click();
  assert.equal(await page.getByRole("searchbox", { name: "메모 검색" }).inputValue(), "", "Clear should reset only the query.");
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
  const pendingScratchMarkdown = await page.evaluate(() => {
    const stored = localStorage.getItem("dark-todo-planner:scratchpad-recovery");
    return stored ? JSON.parse(stored).content : "";
  });
  assert.ok(pendingScratchMarkdown.includes("Scratchpad E2E") && pendingScratchMarkdown.includes("두 번째 줄"),
    "Markdown draft must survive API failure without dropping Korean content.");
  // Hold the write-failure injection through the reload to prevent a
  // pending debounce/request from accidentally succeeding during navigation.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "낙서장", exact: true }).waitFor();
  const recover = page.getByRole("button", { name: "초안 복원" });
  if (!await recover.isVisible()) {
    console.log("G4 recovery diagnostics:", JSON.stringify(await page.evaluate(async () => {
      const response = await fetch("/api/scratchpad", { credentials: "same-origin" });
      return {
        storedDraft: localStorage.getItem("dark-todo-planner:scratchpad-recovery"),
        server: (await response.json()).scratchpad?.content,
        currentEditor: document.querySelector('[aria-label="낙서장 편집기"]')?.textContent,
        recoveryStatus: document.querySelector('[role="status"]')?.textContent,
      };
    })));
  }
  await recover.waitFor();
  await recover.click();
  await page.unroute("**/api/scratchpad");
  assert.ok((await scratchEditor.innerText()).includes("두 번째 줄"), "Recovered rich document must render Korean text.");
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("dark-todo-planner:scratchpad-recovery") || "{}").content), pendingScratchMarkdown);
  let serverScratch = "";
  for (let i = 0; i < 40; i += 1) {
    serverScratch = await page.evaluate(async () => {
      const response = await fetch("/api/scratchpad", { credentials: "same-origin" });
      return (await response.json()).scratchpad.content;
    });
    if (serverScratch === pendingScratchMarkdown) break;
    await sleep(250);
  }
  assert.equal(serverScratch, pendingScratchMarkdown, "Recovered Markdown must persist unchanged to server.");
  assert.equal(await scratchEditor.getAttribute("contenteditable"), "true", "Scratchpad must be a rich contenteditable editor.");
  await scratch.getByText("저장됨", { exact: true }).first().waitFor();

  // G4: toolbar formatting is semantic WYSIWYG, serialized back as Markdown.
  const richHeading = "서식 검증 한글 제목";
  await scratchEditor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText(richHeading);
  await page.getByRole("button", { name: "H1", exact: true }).click();
  await scratchEditor.locator("h1").filter({ hasText: richHeading }).waitFor();
  await page.waitForFunction(async (title) => {
    const response = await fetch("/api/scratchpad", { credentials: "same-origin" });
    return (await response.json()).scratchpad?.content.includes("# " + title);
  }, richHeading);

  // An unsupported legacy Markdown table must be edited as raw source,
  // without forcing a round-trip through the beta Markdown rich parser.
  const advancedMarkdown = "| 이름 | 값 |\n| --- | --- |\n| 기존 | 보존 |";
  await page.locator('input[type="file"][accept*=".md"]').setInputFiles({
    name: "legacy.md", mimeType: "text/markdown", buffer: Buffer.from(advancedMarkdown),
  });
  const rawEditor = page.getByRole("textbox", { name: "낙서장 편집기" });
  await page.waitForFunction(() => document.querySelector('[aria-label="낙서장 편집기"]')?.tagName === "TEXTAREA");
  assert.equal(await rawEditor.inputValue(), advancedMarkdown, "Unsupported Markdown must remain byte-for-byte editable in source mode.");
  await scratch.getByRole("button", { name: "Markdown 서식 미리보기" }).click();
  await scratch.getByRole("region", { name: "낙서장 Markdown 서식 미리보기" }).waitFor();
  await scratch.getByRole("button", { name: "Markdown 원본 편집" }).click();
  assert.equal(await rawEditor.inputValue(), advancedMarkdown, "Preview must not modify unsupported legacy source.");
  // Source-mode toolbar adds real Markdown syntax, and preview renders it.
  const formatted = `검증 제목\n검증 목록\n\n${advancedMarkdown}`;
  await rawEditor.fill(formatted);
  await rawEditor.evaluate((el) => { el.focus(); el.setSelectionRange(0, 0); });
  await scratch.getByRole("button", { name: "H1", exact: true }).click();
  assert.ok((await rawEditor.inputValue()).startsWith("# 검증 제목"), "Heading action must edit raw Markdown.");
  // Wait for the previous formatting command's requestAnimationFrame selection restore.
  await page.waitForTimeout(100);
  await rawEditor.evaluate((el) => { const start = el.value.indexOf("검증 목록"); el.focus(); el.setSelectionRange(start, start); });
  await scratch.getByRole("button", { name: "• 목록", exact: true }).click();
  const formattedSource = await rawEditor.inputValue();
  assert.ok(formattedSource.includes("- 검증 목록"), `Bullet action must edit raw Markdown: ${JSON.stringify(formattedSource.slice(0, 90))}`);
  await scratch.getByRole("button", { name: "Markdown 서식 미리보기" }).click();
  const rendered = scratch.getByRole("region", { name: "낙서장 Markdown 서식 미리보기" });
  await rendered.locator("h1").filter({ hasText: "검증 제목" }).waitFor();
  await rendered.getByText("검증 목록").waitFor();
  await scratch.getByRole("button", { name: "Markdown 원본 편집" }).click();
  assert.equal(await rawEditor.inputValue(), formattedSource, "Source-preview round trip must preserve every byte.");
  await page.waitForFunction(async (value) => {
    const response = await fetch("/api/scratchpad", { credentials: "same-origin" });
    return (await response.json()).scratchpad?.content === value;
  }, formattedSource);

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


  // G2 visual coverage: compare content-first screens in both themes at key widths.
  const screenLabels = {
    today: "오늘", all: "전체 Todo", calendar: "캘린더", projects: "프로젝트",
    memo: "메모", scratchpad: "낙서장", settings: "설정", trash: "휴지통",
  };
  for (const theme of ["dark", "light"]) {
    await page.evaluate(() => { window.location.hash = "#/settings"; });
    await page.getByRole("heading", { name: "설정", exact: true }).waitFor();
    await page.getByRole("button", { name: theme === "dark" ? "다크" : "라이트", exact: true }).click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 844 });
      for (const [view, heading] of Object.entries(screenLabels)) {
        await page.evaluate((next) => { window.location.hash = "#/" + next; }, view);
        if (view === "scratchpad") await page.getByRole("textbox", { name: "낙서장 편집기" }).waitFor();
        else await page.getByRole("heading", { name: heading, exact: true }).first().waitFor();
        if (view === "today") {
          const trigger = page.locator(".today-composer").getByRole("button", { name: "할 일 추가" });
          await trigger.click();
          const composer = page.getByRole("form", { name: "Todo 빠른 추가" });
          await composer.getByRole("button", { name: "상세 옵션", exact: true }).click();
          await composer.getByRole("group", { name: "Todo 상세 옵션" }).waitFor();
          await page.screenshot({ path: `test-artifacts/g2-composer-expanded-${theme}-${width}.png`, fullPage: true });
          await composer.getByRole("button", { name: "상세 옵션 닫기", exact: true }).click();
          const surfaces = await page.evaluate(() => ({
            canvas: getComputedStyle(document.documentElement).getPropertyValue("--app-bg").trim(),
            composer: getComputedStyle(document.querySelector(".today-composer")).backgroundColor,
          }));
          assert.notEqual(surfaces.composer, surfaces.canvas, `Expanded composer must remain distinguishable in ${theme} theme.`);
          await composer.getByRole("button", { name: /취소/ }).click();
        }
        const geometry = await page.evaluate(() => ({
          viewport: window.innerWidth, document: document.documentElement.scrollWidth,
        }));
        assert.ok(geometry.document <= geometry.viewport + 2,
          `G2 ${theme} ${view} overflow at ${width}px: ${JSON.stringify(geometry)}`);
        await page.screenshot({ path: `test-artifacts/g2-${theme}-${width}-${view}.png`, fullPage: true });
      }
    }
  }
  console.log("BROWSER E2E PASS: functional flows, 24 responsive snapshots and 32 Dark/Light G2 screen snapshots.");
} catch (error) {
  failed = true;
  await mkdir("test-artifacts", { recursive: true });
  await page.screenshot({ path: "test-artifacts/browser-smoke-failure.png", fullPage: true }).catch(() => undefined);
  throw error;
} finally {
  await context.setOffline(false).catch(() => undefined);
  await browser.close();
}
