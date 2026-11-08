export type GithubActivityDay = { date: string; level: number; count: number | null };
export type GithubActivity = {
  username: string;
  source: "github-public" | "github-graphql";
  days: GithubActivityDay[];
  total: number | null;
  fetchedAt: string;
};

const LOGIN = "guseoh";
const MAX_HTML_CHARS = 1_000_000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isDate = (value: string) => {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === value;
};
const numberFromText = (value: string) => {
  const match = value.match(/(\d[\d,]*)\s+contributions?/i);
  return match ? Number(match[1].replace(/,/g, "")) : null;
};
const attribute = (tag: string, name: string) => {
  const match = tag.match(new RegExp("(?:^|\\s)" + name + '=["\\x27]([^"\\x27]*)["\\x27]', "i"));
  return match?.[1] ?? null;
};

/** Unofficial public calendar HTML: never present partial counts as exact totals. */
export function parseGithubPublicCalendar(html: string, now = new Date()): GithubActivity {
  if (html.length > MAX_HTML_CHARS) throw new Error("GitHub response was unusually large");
  const tooltips = new Map<string, number>();
  const tooltipRegex = /<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi;
  for (const match of html.matchAll(tooltipRegex)) {
    const id = attribute(match[1], "for");
    const count = numberFromText(match[2].replace(/<[^>]*>/g, ""));
    if (id && count !== null && Number.isSafeInteger(count)) tooltips.set(id, count);
  }

  const byDate = new Map<string, GithubActivityDay>();
  for (const [tag] of html.matchAll(/<(?:td|rect)\b[^>]*>/gi)) {
    const date = attribute(tag, "data-date");
    const rawLevel = attribute(tag, "data-level");
    if (!date || !isDate(date) || rawLevel === null) continue;
    const level = Number(rawLevel);
    if (!Number.isInteger(level) || level < 0 || level > 4) continue;
    const embeddedCount = attribute(tag, "data-count");
    const parsedCount = embeddedCount === null ? null : Number(embeddedCount);
    const tooltipCount = tooltips.get(attribute(tag, "id") || "");
    const count = tooltipCount !== undefined ? tooltipCount
      : parsedCount !== null && Number.isSafeInteger(parsedCount) && parsedCount >= 0 ? parsedCount
      : level === 0 ? 0 : null;
    byDate.set(date, { date, level, count });
  }
  const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (days.length < 200) throw new Error("GitHub contribution calendar was not available");
  const complete = days.every((day) => day.count !== null);
  const total = complete ? days.reduce((sum, day) => sum + (day.count || 0), 0) : null;
  return { username: LOGIN, source: "github-public", days, total, fetchedAt: now.toISOString() };
}

export function parseGithubGraphqlCalendar(payload: unknown, now = new Date()): GithubActivity {
  const root = payload as { data?: { user?: { contributionsCollection?: {
    contributionCalendar?: { weeks?: Array<{ contributionDays?: Array<{
      date?: string; contributionCount?: number; contributionLevel?: string;
    }> }> };
  } } } };
  const weeks = root?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) throw new Error("GitHub GraphQL calendar was not available");
  const levels: Record<string, number> = {
    NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4,
  };
  const days = weeks.flatMap((week) => (week.contributionDays ?? []).map((day) => ({
    date: day.date ?? "",
    level: levels[day.contributionLevel ?? ""] ?? -1,
    count: day.contributionCount ?? -1,
  }))).filter((d) => isDate(d.date) && d.level >= 0 && Number.isSafeInteger(d.count) && d.count >= 0);
  if (days.length < 200) throw new Error("GitHub GraphQL calendar had too few days");
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { username: LOGIN, source: "github-graphql", days,
    total: days.reduce((sum, day) => sum + day.count, 0), fetchedAt: now.toISOString() };
}

export async function fetchGithubActivity(githubToken?: string, now = new Date()): Promise<GithubActivity> {
  if (githubToken) {
    try {
      const response = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { Authorization: "Bearer " + githubToken, "Content-Type": "application/json",
          "User-Agent": "dark-todo-planner-activity" },
        body: JSON.stringify({ query: "query($login: String!) { user(login: $login) { contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount contributionLevel } } } } } }", variables: { login: LOGIN } }),
      });
      if (response.ok) return parseGithubGraphqlCalendar(await response.json(), now);
    } catch { /* Public GitHub calendar remains the fallback. */ }
  }
  const response = await fetch("https://github.com/users/" + LOGIN + "/contributions", {
    headers: { Accept: "text/html", "User-Agent": "dark-todo-planner-activity/1.0" },
  });
  if (!response.ok) throw new Error("GitHub public contributions responded " + response.status);
  return parseGithubPublicCalendar(await response.text(), now);
}
