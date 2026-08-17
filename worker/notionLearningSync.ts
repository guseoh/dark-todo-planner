import { USER_ID } from "./auth";
import { importLearningItems, type LearningImportItem } from "./learningStore";
import { notionSelect, notionText, notionUrl, queryNotionPages, type NotionPage } from "./notionClient";
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

export function codeReadingPageToLearning(page: NotionPage, date: string): LearningImportItem {
  const javaTopic = notionText(page, "Java 주제");
  const springTopic = notionText(page, "Spring 주제");
  const designTopic = notionText(page, "설계 주제");
  const status = notionSelect(page, "상태");
  const lines = [
    javaTopic ? `Java: ${javaTopic}` : "",
    springTopic ? `Spring: ${springTopic}` : "",
    designTopic ? `설계: ${designTopic}` : "",
    status ? `Notion 상태: ${status}` : "",
  ].filter(Boolean);

  return {
    learningDate: date,
    type: "DAILY_PROBLEM",
    title: notionText(page, "세트 ID") || `CR-${date}`,
    summary: clipped(lines.join("\n"), 8000) || undefined,
    sourceUrl: page.url,
    sourceName: "Notion · 데일리 코드 읽기",
    externalKey: externalKey(page),
  };
}

export function techBlogPageToLearning(page: NotionPage, date: string): LearningImportItem | null {
  const title = notionText(page, "제목");
  if (!title) return null;
  const summary = notionText(page, "요약");
  const value = notionText(page, "읽을 가치");
  const application = notionText(page, "적용 포인트");
  const lines = [summary, value ? `읽을 가치: ${value}` : "", application ? `적용 포인트: ${application}` : ""].filter(Boolean);
  const originalUrl = notionUrl(page, "원문 URL");

  return {
    learningDate: date,
    type: "TECH_BLOG",
    title: clipped(title, 240),
    summary: clipped(lines.join("\n\n"), 8000) || undefined,
    sourceUrl: originalUrl || page.url,
    sourceName: clipped(notionText(page, "출처"), 80) || "Notion · 기술 블로그",
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
      await importLearningItems(env, USER_ID, [codeReadingPageToLearning(latest, date)]);
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
    const items = pages.map((page) => techBlogPageToLearning(page, date)).filter((item): item is LearningImportItem => Boolean(item));
    if (items.length) await importLearningItems(env, USER_ID, items);
    techBlogCount = items.length;
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
