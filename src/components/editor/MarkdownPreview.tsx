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

const renderLine = (line: string) => {
  if (!line.trim()) return '<div class="h-2"></div>';

  const heading = line.match(/^(#{1,3})\s+(.+)$/);
  if (heading) {
    const level = heading[1].length;
    const className = level === 1
      ? "mt-4 text-base font-bold text-ink-100"
      : level === 2
        ? "mt-3 text-sm font-bold text-ink-100"
        : "mt-2 text-sm font-semibold text-ink-200";
    return `<h${level} class="${className}">${renderInline(heading[2])}</h${level}>`;
  }

  const check = line.match(/^- \[( |x|X)\] (.*)$/);
  if (check) {
    const checked = check[1].toLowerCase() === "x";
    return `<div class="flex gap-2"><span class="mt-1 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${checked ? "border-success bg-success text-ink-950" : "border-ink-600"}">${checked ? "✓" : ""}</span><span>${renderInline(check[2])}</span></div>`;
  }
  const bullet = line.match(/^- (.*)$/);
  if (bullet) return `<div class="flex gap-2"><span class="text-ink-500">•</span><span>${renderInline(bullet[1])}</span></div>`;
  const numbered = line.match(/^(\d+)\. (.*)$/);
  if (numbered) return `<div class="flex gap-2"><span class="min-w-4 text-right text-ink-500">${numbered[1]}.</span><span>${renderInline(numbered[2])}</span></div>`;
  const quote = line.match(/^> (.*)$/);
  if (quote) return `<blockquote class="border-l-2 border-accent-500/50 pl-3 text-ink-300">${renderInline(quote[1])}</blockquote>`;
  return `<p>${renderInline(line)}</p>`;
};

export const renderMarkdownPreviewHtml = (value: string, emptyText = "비어 있음") =>
  value.trim() ? value.split("\n").map(renderLine).join("") : `<p class="text-ink-600">${escapeHtml(emptyText)}</p>`;

export function MarkdownPreview({ value, emptyText = "비어 있음", className = "" }: MarkdownPreviewProps) {
  return (
    <div
      className={`space-y-1 text-sm leading-6 text-ink-400 ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdownPreviewHtml(value, emptyText) }}
    />
  );
}
