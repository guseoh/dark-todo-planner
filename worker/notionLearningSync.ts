import { USER_ID } from "./auth";
import { importLearningItems, type LearningImportItem } from "./learningStore";
import { notionMultiSelect, notionSelect, notionText, notionUrl, queryNotionPages, retrieveNotionPageText, type NotionPage } from "./notionClient";
import type { Bindings } from "./types";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type LearningSyncStatus = {
  configured: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  codeReading: { count: number; error: string | null };
  techBlog: { count: number; error: string | null };
};

type SyncStateRow = {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  codeReadingCount: number;
  techBlogCount: number;
  codeReadingError: string | null;
  techBlogError: string | null;
};

const externalKey = (page: NotionPage) => `notion:${page.id.replaceAll("-", "")}`;
const clipped = (value: string, max: number) => value.trim().slice(0, max);

export function getKstDate(now = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function codeReadingPageToLearning(page: NotionPage, date: string, bodyText = ""): LearningImportItem {
  const javaTopic = notionText(page, "Java 주제");
  const springTopic = notionText(page, "Spring 주제");
  const designTopic = notionText(page, "설계 주제");
  const status = notionSelect(page, "상태");
  const fallbackLines = [
    javaTopic ? `Java: ${javaTopic}` : "",
    springTopic ? `Spring: ${springTopic}` : "",
    designTopic ? `설계: ${designTopic}` : "",
    status ? `Notion 상태: ${status}` : "",
  ].filter(Boolean);
  const body = clipped(bodyText, 8000);

  return {
    learningDate: date,
    type: "DAILY_PROBLEM",
    title: notionText(page, "세트 ID") || `CR-${date}`,
    summary: body || clipped(fallbackLines.join("\n"), 8000) || undefined,
    sourceUrl: page.url,
    sourceName: "Notion · 데일리 코드 읽기",
    externalKey: externalKey(page),
  };
}

const cleanBody = (bodyText: string) => {
  const lines = bodyText.split("\n").map((line) => line.trim()).filter(Boolean);
  const originalIndex = lines.findIndex((line) => line === "원문");
  const beforeOriginal = originalIndex >= 0 ? lines.slice(0, originalIndex) : lines;
  const content = beforeOriginal[0]?.includes(" · ") ? beforeOriginal.slice(1) : beforeOriginal;
  return content.join("\n").trim();
};

const sourceNameFromBody = (bodyText: string) => {
  const firstLine = bodyText.split("\n").map((line) => line.trim()).find(Boolean) || "";
  const separatorIndex = firstLine.indexOf(" · ");
  const source = separatorIndex >= 0 ? firstLine.slice(0, separatorIndex) : firstLine;
  return clipped(source.replace(/^💡\s*/, ""), 80);
};

export function techBlogPageToLearning(page: NotionPage, date: string, bodyText = ""): LearningImportItem | null {
  const title = notionText(page, "제목");
  if (!title) return null;

  const cleanedBody = cleanBody(bodyText);
  const sourceName = sourceNameFromBody(bodyText);
  const legacySummary = notionText(page, "요약");
  const legacyValue = notionText(page, "읽을 가치");
  const legacyApplication = notionText(page, "적용 포인트");
  const legacyLines = [
    legacySummary,
    legacyValue ? `읽을 가치: ${legacyValue}` : "",
    legacyApplication ? `적용 포인트: ${legacyApplication}` : "",
  ].filter(Boolean);
  const originalUrl = notionUrl(page, "원문 URL");

  return {
    learningDate: date,
    type: "TECH_BLOG",
    title: clipped(title, 240),
    summary: clipped(cleanedBody || legacyLines.join("\n\n"), 8000) || undefined,
    sourceUrl: originalUrl || page.url,
    sourceName: sourceName || clipped(notionText(page, "출처"), 80) || "Notion · 기술 블로그",
    categories: notionMultiSelect(page, "유형").slice(0, 2),
    externalKey: externalKey(page),
  };
}

const configured = (env: Bindings) => Boolean(
  env.NOTION_TOKEN
  && env.NOTION_CODE_READING_DATA_SOURCE_ID
  && env.NOTION_TECH_BLOG_DATA_SOURCE_ID,
);

async function ensureUser(env: Bindings, nowIso: string) {
  await env.DB.prepare("INSERT OR IGNORE INTO users (id, email, nickname, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(USER_ID, "single-user@dark-todo-planner.local", "개인 사용자", nowIso, nowIso)
    .run();
}

async function saveSyncState(env: Bindings, state: Omit<LearningSyncStatus, "configured">) {
  await env.DB.prepare(`
    INSERT INTO learning_sync_state (
      user_id, last_attempt_at, last_success_at, code_reading_count, tech_blog_count, code_reading_error, tech_blog_error
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      last_attempt_at = excluded.last_attempt_at,
      last_success_at = excluded.last_success_at,
      code_reading_count = excluded.code_reading_count,
      tech_blog_count = excluded.tech_blog_count,
      code_reading_error = excluded.code_reading_error,
      tech_blog_error = excluded.tech_blog_error
  `).bind(
    USER_ID,
    state.lastAttemptAt,
    state.lastSuccessAt,
    state.codeReading.count,
    state.techBlog.count,
    state.codeReading.error,
    state.techBlog.error,
  ).run();
}

export async function getLearningSyncStatus(env: Bindings): Promise<LearningSyncStatus> {
  const row = await env.DB.prepare(`
    SELECT last_attempt_at AS lastAttemptAt, last_success_at AS lastSuccessAt,
      code_reading_count AS codeReadingCount, tech_blog_count AS techBlogCount,
      code_reading_error AS codeReadingError, tech_blog_error AS techBlogError
    FROM learning_sync_state WHERE user_id = ? LIMIT 1
  `).bind(USER_ID).first<SyncStateRow>();

  return {
    configured: configured(env),
    lastAttemptAt: row?.lastAttemptAt ?? null,
    lastSuccessAt: row?.lastSuccessAt ?? null,
    codeReading: { count: row?.codeReadingCount ?? 0, error: row?.codeReadingError ?? null },
    techBlog: { count: row?.techBlogCount ?? 0, error: row?.techBlogError ?? null },
  };
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message.slice(0, 1000) : "알 수 없는 동기화 오류";

export async function runNotionLearningSync(env: Bindings, now = new Date()): Promise<LearningSyncStatus> {
  const attemptAt = now.toISOString();
  await ensureUser(env, attemptAt);

  if (!configured(env)) {
    const state = {
      lastAttemptAt: attemptAt,
      lastSuccessAt: null,
      codeReading: { count: 0, error: "Notion 연결 설정이 필요합니다." },
      techBlog: { count: 0, error: "Notion 연결 설정이 필요합니다." },
    };
    await saveSyncState(env, state);
    return { configured: false, ...state };
  }

  const date = getKstDate(now);
  let codeReadingCount = 0;
  let techBlogCount = 0;
  let codeReadingError: string | null = null;
  let techBlogError: string | null = null;

  try {
    const pages = await queryNotionPages({
      token: env.NOTION_TOKEN!,
      dataSourceId: env.NOTION_CODE_READING_DATA_SOURCE_ID!,
      dateProperty: "날짜",
      date,
      sortByLastEdited: true,
    });
    const latest = pages[0];
    if (latest) {
      let bodyText = "";
      try {
        bodyText = await retrieveNotionPageText({ token: env.NOTION_TOKEN!, pageId: latest.id, maxChars: 8000 });
      } catch (error) {
        codeReadingError = `코드 읽기 본문 읽기 실패: ${errorMessage(error)}`.slice(0, 1000);
      }
      await importLearningItems(env, USER_ID, [codeReadingPageToLearning(latest, date, bodyText)]);
      codeReadingCount = 1;
    }
  } catch (error) {
    codeReadingError = errorMessage(error);
  }

  try {
    const pages = await queryNotionPages({
      token: env.NOTION_TOKEN!,
      dataSourceId: env.NOTION_TECH_BLOG_DATA_SOURCE_ID!,
      dateProperty: "날짜",
      date,
    });

    const items: LearningImportItem[] = [];
    const bodyErrors: string[] = [];
    for (const page of pages) {
      let bodyText = "";
      try {
        bodyText = await retrieveNotionPageText({ token: env.NOTION_TOKEN!, pageId: page.id, maxChars: 8000 });
      } catch (error) {
        bodyErrors.push(errorMessage(error));
      }
      const item = techBlogPageToLearning(page, date, bodyText);
      if (item) items.push(item);
    }

    if (items.length) await importLearningItems(env, USER_ID, items);
    techBlogCount = items.length;
    if (bodyErrors.length) {
      techBlogError = `기술 블로그 본문 ${bodyErrors.length}건 읽기 실패: ${bodyErrors[0]}`.slice(0, 1000);
    }
  } catch (error) {
    techBlogError = errorMessage(error);
  }

  const successful = !codeReadingError && !techBlogError;
  const previous = await getLearningSyncStatus(env);
  const state = {
    lastAttemptAt: attemptAt,
    lastSuccessAt: successful ? attemptAt : previous.lastSuccessAt,
    codeReading: { count: codeReadingCount, error: codeReadingError },
    techBlog: { count: techBlogCount, error: techBlogError },
  };
  await saveSyncState(env, state);
  return { configured: true, ...state };
}
