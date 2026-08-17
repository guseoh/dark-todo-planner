export type NotionPage = {
  id: string;
  url: string;
  created_time?: string;
  last_edited_time?: string;
  properties: Record<string, unknown>;
};

type QueryResponse = {
  results?: unknown[];
  has_more?: boolean;
  next_cursor?: string | null;
};

type QueryOptions = {
  token: string;
  dataSourceId: string;
  dateProperty: string;
  date: string;
  sortByLastEdited?: boolean;
};

type PageTextOptions = {
  token: string;
  pageId: string;
  maxChars?: number;
};

type NotionBlock = {
  id: string;
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
};

const NOTION_API_VERSION = "2026-03-11";
const MAX_BLOCK_DEPTH = 4;

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPage = (value: unknown): value is NotionPage => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.url === "string" && isRecord(value.properties);
};

const isBlock = (value: unknown): value is NotionBlock => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.type === "string";
};

const notionHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "Notion-Version": NOTION_API_VERSION,
});

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const notionFetch = async (input: RequestInfo | URL, init: RequestInit) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(input, init);
    if (response.status !== 429 || attempt === 2) return response;
    const retryAfter = Number(response.headers.get("Retry-After"));
    await wait(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1));
  }
  throw new Error("Notion request retry exhausted");
};

export async function queryNotionPages({ token, dataSourceId, dateProperty, date, sortByLastEdited = false }: QueryOptions): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await notionFetch(`https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      method: "POST",
      headers: notionHeaders(token),
      body: JSON.stringify({
        page_size: 100,
        filter: { property: dateProperty, date: { equals: date } },
        ...(sortByLastEdited ? { sorts: [{ timestamp: "last_edited_time", direction: "descending" }] } : {}),
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });

    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Notion query failed (${response.status}): ${body || response.statusText}`);
    }

    const payload = await response.json() as QueryResponse;
    for (const result of payload.results || []) if (isPage(result)) pages.push(result);
    cursor = payload.has_more && typeof payload.next_cursor === "string" ? payload.next_cursor : undefined;
  } while (cursor);

  return pages;
}

const property = (page: NotionPage, name: string) => {
  const value = page.properties[name];
  return isRecord(value) ? value : undefined;
};

const plainText = (items: unknown) => {
  if (!Array.isArray(items)) return "";
  return items.map((item) => isRecord(item) && typeof item.plain_text === "string" ? item.plain_text : "").join("").trim();
};

const safeMarkdownUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  try {
    const parsed = new URL(value);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
};

export const notionRichTextToMarkdown = (items: unknown) => {
  if (!Array.isArray(items)) return "";
  return items.map((item) => {
    if (!isRecord(item) || typeof item.plain_text !== "string") return "";
    let text = item.plain_text;
    const annotations = isRecord(item.annotations) ? item.annotations : undefined;
    if (annotations?.code === true) text = `\`${text.replaceAll("`", "\\`")}\``;
    else {
      if (annotations?.bold === true) text = `**${text}**`;
      if (annotations?.italic === true) text = `_${text}_`;
      if (annotations?.strikethrough === true) text = `~~${text}~~`;
    }
    const href = safeMarkdownUrl(item.href);
    return href ? `[${text}](${href})` : text;
  }).join("").trim();
};

export function notionText(page: NotionPage, name: string): string {
  const value = property(page, name);
  if (!value) return "";
  if (Array.isArray(value.title)) return plainText(value.title);
  if (Array.isArray(value.rich_text)) return plainText(value.rich_text);
  return "";
}

export function notionSelect(page: NotionPage, name: string): string {
  const value = property(page, name);
  if (!value || !isRecord(value.select)) return "";
  return typeof value.select.name === "string" ? value.select.name.trim() : "";
}

export function notionMultiSelect(page: NotionPage, name: string): string[] {
  const value = property(page, name);
  if (!value || !Array.isArray(value.multi_select)) return [];
  return value.multi_select
    .map((entry) => isRecord(entry) && typeof entry.name === "string" ? entry.name.trim() : "")
    .filter(Boolean);
}

export function notionUrl(page: NotionPage, name: string): string {
  const value = property(page, name);
  return value && typeof value.url === "string" ? value.url.trim() : "";
}

const calloutIcon = (value: Record<string, unknown> | undefined) => {
  if (!value || !isRecord(value.icon)) return "💡";
  return value.icon.type === "emoji" && typeof value.icon.emoji === "string" ? value.icon.emoji : "💡";
};

export const notionBlockToMarkdown = (block: NotionBlock, numberedIndex = 1, depth = 0) => {
  const value = isRecord(block[block.type]) ? block[block.type] as Record<string, unknown> : undefined;
  if (block.type === "divider") return "---";

  const rawText = value ? plainText(value.rich_text) : "";
  const text = value ? notionRichTextToMarkdown(value.rich_text) : "";
  const indent = "  ".repeat(Math.min(depth, 3));

  if (block.type === "code") {
    const language = typeof value?.language === "string" && value.language !== "plain text" ? value.language : "";
    return rawText ? `\`\`\`${language}\n${rawText}\n\`\`\`` : "";
  }
  if (!text) return "";

  switch (block.type) {
    case "heading_1": return rawText === "원문" ? "원문" : `# ${text}`;
    case "heading_2": return rawText === "원문" ? "원문" : `## ${text}`;
    case "heading_3": return rawText === "원문" ? "원문" : `### ${text}`;
    case "bulleted_list_item": return `${indent}- ${text}`;
    case "numbered_list_item": return `${indent}${numberedIndex}. ${text}`;
    case "to_do": return `${indent}- [${value?.checked === true ? "x" : " "}] ${text}`;
    case "callout": return `> ${calloutIcon(value)} ${text}`;
    case "quote": return `> ${text}`;
    case "toggle": return `### ▸ ${text}`;
    default: return text;
  }
};

async function listBlockChildren(token: string, blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);
    const response = await notionFetch(`https://api.notion.com/v1/blocks/${encodeURIComponent(blockId)}/children?${query}`, {
      method: "GET",
      headers: notionHeaders(token),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 500);
      throw new Error(`Notion block read failed (${response.status}): ${body || response.statusText}`);
    }
    const payload = await response.json() as QueryResponse;
    for (const result of payload.results || []) if (isBlock(result)) blocks.push(result);
    cursor = payload.has_more && typeof payload.next_cursor === "string" ? payload.next_cursor : undefined;
  } while (cursor);

  return blocks;
}

async function collectBlockLines(token: string, blockId: string, depth: number): Promise<string[]> {
  const lines: string[] = [];
  const blocks = await listBlockChildren(token, blockId);
  let numberedIndex = 0;

  for (const block of blocks) {
    if (block.type === "numbered_list_item") numberedIndex += 1;
    else numberedIndex = 0;

    const line = notionBlockToMarkdown(block, numberedIndex || 1, depth);
    if (line) lines.push(line);
    if (block.has_children && depth < MAX_BLOCK_DEPTH) {
      lines.push(...await collectBlockLines(token, block.id, depth + 1));
    }
  }
  return lines;
}

export async function retrieveNotionPageText({ token, pageId, maxChars = 8000 }: PageTextOptions): Promise<string> {
  const lines = await collectBlockLines(token, pageId, 0);
  return lines.join("\n").trim().slice(0, maxChars);
}
