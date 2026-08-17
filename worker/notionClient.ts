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

const NOTION_API_VERSION = "2026-03-11";

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isPage = (value: unknown): value is NotionPage => {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.url === "string" && isRecord(value.properties);
};

export async function queryNotionPages({ token, dataSourceId, dateProperty, date, sortByLastEdited = false }: QueryOptions): Promise<NotionPage[]> {
  const pages: NotionPage[] = [];
  let cursor: string | undefined;

  do {
    const response = await fetch(`https://api.notion.com/v1/data_sources/${encodeURIComponent(dataSourceId)}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Notion-Version": NOTION_API_VERSION,
      },
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

export function notionUrl(page: NotionPage, name: string): string {
  const value = property(page, name);
  return value && typeof value.url === "string" ? value.url.trim() : "";
}
