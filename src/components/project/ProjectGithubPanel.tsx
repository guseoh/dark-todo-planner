import { useEffect, useMemo, useState } from "react";
import { ExternalLink, GitPullRequest, CircleDot, RefreshCw } from "lucide-react";
import { api } from "../../lib/api/client";
import type { Project } from "../../types/project";
import type { Todo, TodoInput } from "../../types/todo";

type Kind = "issues" | "pulls";
type Item = { number: number; title: string; url: string; state: "OPEN" | "CLOSED" | "DRAFT" | "MERGED"; author: string; updatedAt: string };
type Result = { items: Item[]; fetchedAt: string; limited: boolean };
export function githubRepoFromUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "github.com" || url.port || url.username || url.password || url.search || url.hash) return;
    const match = url.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100})\/?$/);
    if (match && match[2] !== "." && match[2] !== "..") return `${match[1]}/${match[2]}`;
  } catch { /* invalid resource URL */ }
}

export function ProjectGithubPanel({ project, todos, kind, onAdd, onUpdate, onConnect }: {
  project: Project; todos: Todo[]; kind: Kind;
  onAdd: (input: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined;
  onConnect: () => void;
}) {
  const repos = useMemo(() => [...new Set((project.resources ?? []).flatMap(resource => {
    const repo = githubRepoFromUrl(resource.url); return repo ? [repo] : [];
  }))], [project.resources]);
  const [chosen, setChosen] = useState("");
  const repo = repos.includes(chosen) ? chosen : repos[0];
  const [state, setState] = useState("open");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [loadedKey, setLoadedKey] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [linkNumber, setLinkNumber] = useState<number | null>(null);
  const [todoId, setTodoId] = useState("");
  const key = `${repo ?? ""}:${kind}:${state}`;
  useEffect(() => {
    setResult(null); setLoadedKey(""); setError("");
    setLinkNumber(null); setTodoId(""); setActionError("");
    if (!repo) return;
    const controller = new AbortController();
    const [owner, name] = repo.split("/");
    void api<Result>(`/api/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${kind}?state=${state}`, { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) { setResult(data); setLoadedKey(key); } })
      .catch(cause => { if (!controller.signal.aborted) { setError(cause instanceof Error ? cause.message : "조회 실패"); setLoadedKey(key); } });
    return () => controller.abort();
  }, [repo, kind, state, refresh, key]);
  const linked = (item: Item) => todos.find(todo => todo.referenceUrl?.toLowerCase() === item.url.toLowerCase());
  const apply = async (item: Item, existing?: string) => {
    if (busy || project.archived || linked(item)) return;
    setBusy(true); setActionError("");
    try {
      const reference = { referenceUrl: item.url, referenceLabel: `GitHub #${item.number}` };
      const target = todos.find(todo => todo.id === existing && !todo.referenceUrl);
      const saved = existing ? (target ? await onUpdate(existing, reference) : undefined)
        : await onAdd({ title: `#${item.number} ${item.title}`.slice(0, 200), projectId: project.id, planningState: "INBOX", ...reference });
      if (!saved) throw new Error("Todo를 연결하지 못했습니다.");
      setLinkNumber(null); setTodoId("");
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : "Todo 연결 실패"); }
    finally { setBusy(false); }
  };
  if (!repo) return <section className="space-y-3 py-4"><p className="text-sm text-ui-muted">자료 링크에 공개 GitHub 저장소 주소(https://github.com/owner/repo)를 추가하세요.</p><button type="button" className="btn-secondary" onClick={onConnect}>저장소 연결</button></section>;
  const visible = loadedKey === key ? result?.items.filter(item => `${item.title} #${item.number} ${item.author}`.toLowerCase().includes(query.trim().toLowerCase())) ?? [] : [];
  return <section className="space-y-2 py-3" aria-label={kind === "issues" ? "GitHub Issues" : "GitHub Pull Requests"}>
    <div className="flex flex-wrap items-center gap-2">
      <select className="field w-auto min-h-8 text-xs" aria-label="저장소" value={repo} onChange={event => setChosen(event.target.value)}>{repos.map(name => <option key={name}>{name}</option>)}</select>
      <input className="field min-w-32 flex-1 min-h-8 text-xs" aria-label="GitHub 작업 검색" placeholder="제목, 번호, 작성자 검색" value={query} onChange={event => setQuery(event.target.value)} />
      <select className="field min-h-8 w-auto text-xs" aria-label="GitHub 상태" value={state} onChange={event => setState(event.target.value)}><option value="open">열림</option><option value="closed">종료</option><option value="all">전체</option></select>
      <button type="button" className="btn-secondary text-xs" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} />새로고침</button>
    </div>
    <p className="text-xs text-ui-muted">공개 저장소 · 최근 갱신 항목 최대 100개 · 읽기 전용 GitHub 조회{result?.limited ? " · 더 많은 항목이 있습니다" : ""}</p>
    {error && loadedKey === key ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    {loadedKey !== key ? <p role="status" className="text-xs text-ui-muted">GitHub 조회 중…</p> : null}
    {actionError ? <p role="alert" className="text-xs text-danger">{actionError}</p> : null}
    {visible.map(item => { const todo = linked(item); return <div key={item.number} className="border-t border-ui-divider py-3">
      <div className="flex flex-wrap items-center gap-2">
        {kind === "pulls" ? <GitPullRequest size={16} /> : <CircleDot size={16} />}
        <div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{item.title}</p><p className="text-xs text-ui-muted">#{item.number} · {item.state} · {item.author}</p></div>
        {todo ? <span className="text-xs text-ui-muted">연결됨 · {todo.title}</span> : !project.archived ? <>
          <button className="btn-secondary text-xs" type="button" disabled={busy} onClick={() => void apply(item)}>Todo 생성</button>
          <button className="btn-secondary text-xs" type="button" disabled={busy} onClick={() => { setLinkNumber(item.number); setTodoId(""); }}>기존 Todo 연결</button>
        </> : null}
        <a className="btn-secondary text-xs" href={item.url} target="_blank" rel="noreferrer" aria-label={`GitHub #${item.number} 원본 열기`}><ExternalLink size={14} /></a>
      </div>
      {linkNumber === item.number && !todo ? <div className="mt-2 flex gap-2">
        <select className="field min-w-0 flex-1" aria-label="연결할 Todo" value={todoId} onChange={event => setTodoId(event.target.value)}><option value="">연결할 Todo 선택</option>{todos.filter(todo => !todo.referenceUrl && !todo.archived).map(todo => <option key={todo.id} value={todo.id}>{todo.title}</option>)}</select>
        <button className="btn-secondary" type="button" disabled={!todoId || busy} onClick={() => void apply(item, todoId)}>연결</button>
        <button className="btn-secondary" type="button" onClick={() => setLinkNumber(null)}>취소</button>
      </div> : null}
    </div>; })}
    {loadedKey === key && result && !visible.length ? <p className="py-4 text-xs text-ui-muted">조회된 항목이 없습니다.</p> : null}
  </section>;
}
