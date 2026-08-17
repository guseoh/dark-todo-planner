import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, CalendarCheck2, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { api, jsonBody } from "../lib/api/client";
import { todayKey } from "../lib/date";
import type { LearningImportInput, LearningItem, LearningItemStatus, LearningItemType } from "../types/learning";

const statusLabel: Record<LearningItemStatus, string> = {
  UNREAD: "안 읽음",
  READING: "읽는 중",
  DONE: "완료",
  SKIPPED: "건너뜀",
};

const typeMeta: Record<LearningItemType, { title: string; description: string; empty: string }> = {
  DAILY_PROBLEM: {
    title: "오늘의 문제",
    description: "Notion 데일리 코드 읽기 기록을 자동으로 가져옵니다.",
    empty: "동기화된 데일리 문제가 없습니다.",
  },
  TECH_BLOG: {
    title: "오늘 읽을 기술 글",
    description: "매일 추천된 기술 블로그를 Notion에서 자동으로 가져옵니다.",
    empty: "동기화된 기술 글이 없습니다.",
  },
};

type LearningSyncStatus = {
  configured: boolean;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  codeReading: { count: number; error: string | null };
  techBlog: { count: number; error: string | null };
};

const messageOf = (error: unknown) => error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
const formatSyncTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "아직 없음";

export function LearningPage({ onTodoCreated }: { onTodoCreated: () => unknown | Promise<unknown> }) {
  const [date, setDate] = useState(todayKey());
  const [items, setItems] = useState<LearningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [type, setType] = useState<LearningItemType>("DAILY_PROBLEM");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<LearningSyncStatus | null>(null);

  const load = useCallback(async (targetDate = date) => {
    setLoading(true);
    setError("");
    try {
      const result = await api<{ items: LearningItem[] }>(`/api/learning-items?date=${encodeURIComponent(targetDate)}`);
      setItems(result.items);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setLoading(false);
    }
  }, [date]);

  const loadSyncStatus = useCallback(async () => {
    try {
      setSyncStatus(await api<LearningSyncStatus>("/api/learning-items/sync-status"));
    } catch {
      setSyncStatus(null);
    }
  }, []);

  useEffect(() => { void load(date); }, [date, load]);
  useEffect(() => { void loadSyncStatus(); }, [loadSyncStatus]);

  const groups = useMemo(() => ({
    DAILY_PROBLEM: items.filter((item) => item.type === "DAILY_PROBLEM"),
    TECH_BLOG: items.filter((item) => item.type === "TECH_BLOG"),
  }), [items]);

  const doneCount = items.filter((item) => item.status === "DONE").length;
  const resetForm = () => {
    setTitle(""); setSummary(""); setSourceUrl(""); setSourceName(""); setType("DAILY_PROBLEM");
  };

  const syncNow = async () => {
    setSyncing(true);
    setError("");
    try {
      const result = await api<LearningSyncStatus>("/api/learning-items/sync", { method: "POST" });
      setSyncStatus(result);
      if (date === todayKey()) await load(date);
    } catch (cause) {
      setError(messageOf(cause));
      await loadSyncStatus();
    } finally {
      setSyncing(false);
    }
  };

  const addItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSavingId("new");
    setError("");
    const externalKey = `manual:${date}:${type}:${globalThis.crypto?.randomUUID?.() || Date.now()}`;
    const input: LearningImportInput = {
      learningDate: date,
      type,
      title: title.trim(),
      summary: summary.trim() || undefined,
      sourceUrl: sourceUrl.trim() || undefined,
      sourceName: sourceName.trim() || undefined,
      externalKey,
    };
    try {
      await api("/api/learning-items/import", { method: "POST", ...jsonBody({ items: [input] }) });
      resetForm();
      setShowAdd(false);
      await load(date);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSavingId("");
    }
  };

  const changeStatus = async (item: LearningItem, status: LearningItemStatus) => {
    setSavingId(item.id);
    setError("");
    try {
      const result = await api<{ item: LearningItem }>(`/api/learning-items/${item.id}/status`, {
        method: "PATCH",
        ...jsonBody({ status }),
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? result.item : entry));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSavingId("");
    }
  };

  const addToToday = async (item: LearningItem) => {
    setSavingId(item.id);
    setError("");
    try {
      const result = await api<{ todoId: string; created: boolean }>(`/api/learning-items/${item.id}/todo`, {
        method: "POST",
        ...jsonBody({ date: todayKey() }),
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? {
        ...entry,
        todoId: result.todoId,
        status: entry.status === "UNREAD" ? "READING" : entry.status,
      } : entry));
      if (result.created) await Promise.resolve(onTodoCreated());
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSavingId("");
    }
  };

  const removeItem = async (item: LearningItem) => {
    if (!window.confirm(`“${item.title}” 학습 항목을 삭제할까요? 연결된 Todo는 삭제되지 않습니다.`)) return;
    setSavingId(item.id);
    setError("");
    try {
      await api(`/api/learning-items/${item.id}`, { method: "DELETE" });
      setItems((current) => current.filter((entry) => entry.id !== item.id));
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setSavingId("");
    }
  };

  const renderGroup = (itemType: LearningItemType) => {
    const meta = typeMeta[itemType];
    const rows = groups[itemType];
    return (
      <section className="app-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-ink-100">{meta.title}</h2>
            <p className="mt-1 text-xs text-ink-500">{meta.description}</p>
          </div>
          <span className="rounded-full border border-ink-700 px-2.5 py-1 text-xs font-semibold text-ink-400">{rows.length}개</span>
        </div>
        {rows.length ? <div className="space-y-3">{rows.map((item) => (
          <article key={item.id} className="rounded-xl border border-ink-700/70 bg-ink-950/35 p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-ink-800 px-2 py-0.5 text-[10px] font-bold text-ink-400">{item.sourceName || (itemType === "DAILY_PROBLEM" ? "문제" : "블로그")}</span>
                  {item.todoId ? <span className="rounded-full border border-accent-500/30 bg-accent-500/[0.06] px-2 py-0.5 text-[10px] font-bold text-accent-100">오늘 Todo 추가됨</span> : null}
                </div>
                <h3 className="mt-2 text-sm font-bold text-ink-100">{item.title}</h3>
                {item.summary ? <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-ink-400">{item.summary}</p> : null}
              </div>
              <select className="field w-full shrink-0 sm:w-28" value={item.status} disabled={savingId === item.id} onChange={(event) => void changeStatus(item, event.target.value as LearningItemStatus)} aria-label={`${item.title} 학습 상태`}>
                {(Object.keys(statusLabel) as LearningItemStatus[]).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}
              </select>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-3">
              {item.sourceUrl ? <a className="btn-secondary min-h-9 px-3 py-1.5 text-xs" href={item.sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />원문 열기</a> : null}
              <button type="button" className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={savingId === item.id || Boolean(item.todoId)} onClick={() => void addToToday(item)}><CalendarCheck2 size={14} />{item.todoId ? "Todo 추가됨" : "오늘 할 일로 추가"}</button>
              <button type="button" className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-ink-500 transition hover:bg-red-500/10 hover:text-red-200" disabled={savingId === item.id} onClick={() => void removeItem(item)}><Trash2 size={14} />삭제</button>
            </div>
          </article>
        ))}</div> : <p className="rounded-lg border border-dashed border-ink-700 px-4 py-7 text-center text-sm text-ink-500">{meta.empty}</p>}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      <section className="app-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2"><BookOpen size={20} className="text-accent-300" /><h1 className="text-lg font-bold text-ink-100">Learning Inbox</h1></div>
            <p className="mt-1 text-sm text-ink-500">Notion의 데일리 문제와 추천 기술 글을 자동으로 모아 정리합니다.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" className="field w-auto" value={date} onChange={(event) => setDate(event.target.value)} aria-label="학습 날짜" />
            <button type="button" className="btn-secondary" onClick={() => setDate(todayKey())}>오늘</button>
            <button type="button" className="btn-secondary" onClick={() => void load(date)} disabled={loading}><RefreshCw size={15} className={loading ? "animate-spin" : ""} />새로고침</button>
            <button type="button" className="btn-primary" onClick={() => void syncNow()} disabled={syncing || syncStatus?.configured === false}><RefreshCw size={15} className={syncing ? "animate-spin" : ""} />{syncing ? "동기화 중" : "Notion 동기화"}</button>
            <button type="button" className="btn-secondary" onClick={() => setShowAdd((value) => !value)}><Plus size={16} />수동 추가</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-400">
          <span className="rounded-full border border-ink-700 px-2.5 py-1">전체 {items.length}</span>
          <span className="rounded-full border border-ink-700 px-2.5 py-1">완료 {doneCount}</span>
          <span className="rounded-full border border-ink-700 px-2.5 py-1">남음 {items.length - doneCount}</span>
        </div>
        <div className="mt-4 rounded-xl border border-ink-800 bg-ink-950/30 px-3.5 py-3 text-xs text-ink-400">
          {!syncStatus ? <span>동기화 상태를 확인하는 중...</span> : syncStatus.configured ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>마지막 성공: <strong className="text-ink-200">{formatSyncTime(syncStatus.lastSuccessAt)}</strong></span>
              <span>문제 {syncStatus.codeReading.count}개</span>
              <span>기술 글 {syncStatus.techBlog.count}개</span>
              {syncStatus.codeReading.error ? <span className="text-red-300">문제 동기화 오류</span> : null}
              {syncStatus.techBlog.error ? <span className="text-red-300">블로그 동기화 오류</span> : null}
            </div>
          ) : <span className="text-amber-200">Notion Integration 연결이 필요합니다. 연결 전에는 수동 추가만 사용할 수 있습니다.</span>}
        </div>
      </section>

      {showAdd ? <section className="app-card p-4 sm:p-5">
        <form className="space-y-3" onSubmit={addItem}>
          <div><h2 className="text-sm font-bold text-ink-100">수동 학습 항목 추가</h2><p className="mt-1 text-xs text-ink-500">자동 동기화 누락이나 일회성 자료를 직접 넣을 때만 사용합니다.</p></div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm text-ink-400">유형<select className="field" value={type} onChange={(event) => setType(event.target.value as LearningItemType)}><option value="DAILY_PROBLEM">데일리 문제</option><option value="TECH_BLOG">기술 블로그</option></select></label>
            <label className="space-y-1 text-sm text-ink-400">출처 이름<input className="field" value={sourceName} maxLength={80} onChange={(event) => setSourceName(event.target.value)} placeholder="Notion, 우아한형제들 기술블로그" /></label>
            <label className="space-y-1 text-sm text-ink-400 md:col-span-2">제목<input className="field" value={title} maxLength={240} required onChange={(event) => setTitle(event.target.value)} placeholder="오늘의 코드 읽기 / 읽을 글 제목" /></label>
            <label className="space-y-1 text-sm text-ink-400 md:col-span-2">원문 URL<input className="field" type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://..." /></label>
            <label className="space-y-1 text-sm text-ink-400 md:col-span-2">요약<textarea className="field min-h-24 resize-y" value={summary} maxLength={8000} onChange={(event) => setSummary(event.target.value)} placeholder="오늘 문제의 범위나 글을 읽어야 하는 이유" /></label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => { setShowAdd(false); resetForm(); }}>취소</button><button type="submit" className="btn-primary" disabled={!title.trim() || savingId === "new"}>{savingId === "new" ? "추가 중..." : "Learning Inbox에 추가"}</button></div>
        </form>
      </section> : null}

      {error ? <div role="alert" className="rounded-lg border border-danger/40 bg-danger/[0.06] px-4 py-3 text-sm font-semibold text-red-100">{error}</div> : null}
      {loading && !items.length ? <div className="app-card py-10 text-center text-sm text-ink-500">학습 항목을 불러오는 중...</div> : <>{renderGroup("DAILY_PROBLEM")}{renderGroup("TECH_BLOG")}</>}
    </div>
  );
}
