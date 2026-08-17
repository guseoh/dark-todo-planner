type MarkdownPreviewProps = {
  value: string;
  emptyText?: string;
  className?: string;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const safeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? parsed.toString() : "#";
  } catch {
    return "#";
  }
};

const renderInline = (source: string) => {
  let html = escapeHtml(source);
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-ink-950 px-1 py-0.5 text-[0.85em] text-indigo-100">$1</code>');
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, url: string) => {
    const href = safeUrl(url);
    return `<a class="text-accent-300 underline decoration-accent-400/50 underline-offset-2 hover:text-accent-200" href="${href}" target="_blank" rel="noreferrer">${label}</a>`;
  });
  return html;
};

const indentOf = (line: string) => Math.min(3, Math.floor((line.match(/^\s*/)?.[0].length || 0) / 2));
const indentStyle = (depth: number) => depth ? ` style="padding-left:${depth * 14}px"` : "";

const renderLine = (line: string) => {
  if (!line.trim()) return '<div class="h-2"></div>';

  const normalized = line.trimStart();
  const depth = indentOf(line);
  const heading = normalized.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    const className = level === 1
      ? "mt-4 text-base font-bold text-ink-100"
      : level === 2
        ? "mt-3 text-sm font-bold text-ink-100"
        : "mt-2 text-sm font-semibold text-ink-200";
    return `<h${level} class="${className}">${renderInline(heading[2])}</h${level}>`;
  }

  if (/^---+$/.test(normalized)) return '<hr class="my-3 border-ink-800" />';

  const check = normalized.match(/^- \[( |x|X)\] (.*)$/);
  if (check) {
    const checked = check[1].toLowerCase() === "x";
    return `<div class="flex gap-2"${indentStyle(depth)}><span class="mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? "border-success bg-success text-ink-950" : "border-ink-600"}">${checked ? "✓" : ""}</span><span>${renderInline(check[2])}</span></div>`;
  }

  const legacyCheck = normalized.match(/^(☑|☐)\s+(.*)$/);
  if (legacyCheck) {
    const checked = legacyCheck[1] === "☑";
    return `<div class="flex gap-2"${indentStyle(depth)}><span class="mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? "border-success bg-success text-ink-950" : "border-ink-600"}">${checked ? "✓" : ""}</span><span>${renderInline(legacyCheck[2])}</span></div>`;
  }

  const bullet = normalized.match(/^(?:-|•)\s+(.*)$/);
  if (bullet) return `<div class="flex gap-2"${indentStyle(depth)}><span class="text-ink-500">•</span><span>${renderInline(bullet[1])}</span></div>`;

  const numbered = normalized.match(/^(\d+)\.\s+(.*)$/);
  if (numbered) return `<div class="flex gap-2"${indentStyle(depth)}><span class="min-w-4 text-right text-ink-500">${numbered[1]}.</span><span>${renderInline(numbered[2])}</span></div>`;

  const quote = normalized.match(/^>\s+(.*)$/);
  if (quote) return `<blockquote class="my-2 rounded-r-md border-l-2 border-accent-500/50 bg-accent-500/[0.03] py-1 pl-3 pr-2 text-ink-300">${renderInline(quote[1])}</blockquote>`;

  return `<p>${renderInline(normalized)}</p>`;
};

export const renderMarkdownPreviewHtml = (value: string, emptyText = "비어 있음") => {
  if (!value.trim()) return `<p class="text-ink-600">${escapeHtml(emptyText)}</p>`;

  const lines = value.split("\n");
  const html: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const fence = lines[index].trimStart().match(/^```([^`]*)$/);
    if (!fence) {
      html.push(renderLine(lines[index]));
      continue;
    }

    const language = fence[1].trim();
    const code: string[] = [];
    index += 1;
    while (index < lines.length && !lines[index].trimStart().startsWith("```")) {
      code.push(lines[index]);
      index += 1;
    }
    html.push(`<div class="my-2 overflow-x-auto rounded-lg border border-ink-800 bg-ink-950/80"><div class="border-b border-ink-800 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-600">${escapeHtml(language || "code")}</div><pre class="p-3 text-xs leading-5 text-ink-300"><code>${escapeHtml(code.join("\n"))}</code></pre></div>`);
  }
  return html.join("");
};

export function MarkdownPreview({ value, emptyText = "비어 있음", className = "" }: MarkdownPreviewProps) {
  return (
    <div
      className={`space-y-1 text-sm leading-6 text-ink-400 ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdownPreviewHtml(value, emptyText) }}
    />
  );
}
