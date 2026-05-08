import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Download, ExternalLink, Music2, Pencil, Plus, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Memo } from "../types/memo";
import type { MusicLink, MusicLinkInput, MusicProvider } from "../types/music";
import type { Reflection } from "../types/reflection";
import type { Topic } from "../types/topic";
import { StatCard } from "../components/common/StatCard";
import { MarkdownEditor } from "../components/editor/MarkdownEditor";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { LEGACY_STORAGE_KEYS } from "../lib/storageKeys";

type SettingsPageProps = {
  categories: Category[];
  stats: { total: number; completedTotal: number; archivedTotal: number };
  reflections: Reflection[];
  goals: Goal[];
  memos: Memo[];
  topics: Topic[];
  musicLinks: MusicLink[];
  onExportBackup: () => Promise<Record<string, unknown>>;
  onImportBackup: (data: unknown) => Promise<void>;
  onMigrateLocalStorage: (data: unknown) => Promise<void>;
  onAddMusicLink: (input: MusicLinkInput) => unknown | Promise<unknown>;
  onUpdateMusicLink: (id: string, input: MusicLinkInput) => unknown | Promise<unknown>;
  onDeleteMusicLink: (id: string) => unknown | Promise<unknown>;
  apiStatus?: "online" | "offline";
};

const providerLabel: Record<MusicProvider, string> = {
  YOUTUBE: "YouTube",
  YOUTUBE_MUSIC: "YouTube Music",
  MELON: "Melon",
  SPOTIFY: "Spotify",
  ETC: "기타",
};

const providerOptions = Object.keys(providerLabel) as MusicProvider[];

const inferProvider = (url: string): MusicProvider => {
  const normalized = url.toLowerCase();
  if (normalized.includes("music.youtube.com")) return "YOUTUBE_MUSIC";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "YOUTUBE";
  if (normalized.includes("melon.com")) return "MELON";
  if (normalized.includes("spotify.com")) return "SPOTIFY";
  return "ETC";
};

function MusicLinkForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: MusicLink;
  submitLabel: string;
  onSubmit: (input: MusicLinkInput) => unknown | Promise<unknown>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [url, setUrl] = useState(initial?.url || "");
  const [provider, setProvider] = useState<MusicProvider>(initial?.provider || "ETC");
  const [memo, setMemo] = useState(initial?.memo || "");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const parsed = new URL(url.trim());
      await onSubmit({
        title: title.trim(),
        url: parsed.toString(),
        provider: provider === "ETC" ? inferProvider(parsed.toString()) : provider,
        memo: memo.trim() || undefined,
      });
      if (!initial) {
        setTitle("");
        setUrl("");
        setProvider("ETC");
        setMemo("");
      }
      setError("");
      onCancel?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "올바른 URL을 입력해주세요.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_9rem]">
        <input className="field" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="링크 이름" />
        <input className="field" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
        <select className="field" value={provider} onChange={(event) => setProvider(event.target.value as MusicProvider)}>
          {providerOptions.map((item) => (
            <option key={item} value={item}>
              {providerLabel[item]}
            </option>
          ))}
        </select>
      </div>
      <MarkdownEditor value={memo} onChange={setMemo} placeholder="언제 들으면 좋은지 짧게 메모" />
      {error ? <p className="text-xs text-red-200">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={!title.trim() || !url.trim()}>
          {initial ? <Save size={16} /> : <Plus size={16} />}
          {submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            <X size={16} />
            취소
          </button>
        ) : null}
      </div>
    </form>
  );
}

export function SettingsPage({
  categories,
  stats,
  reflections,
  goals,
  memos,
  topics,
  musicLinks,
  onExportBackup,
  onImportBackup,
  onMigrateLocalStorage,
  onAddMusicLink,
  onUpdateMusicLink,
  onDeleteMusicLink,
  apiStatus = "online",
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [editingMusicId, setEditingMusicId] = useState<string | null>(null);

  const exportJson = async () => {
    try {
      const backup = await onExportBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dark-todo-planner-server-backup.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("서버 DB 기준 백업 JSON을 내보냈습니다.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "백업 내보내기에 실패했습니다.");
    }
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!window.confirm("서버 DB의 기존 데이터를 백업 파일로 덮어쓸까요?")) return;
        await onImportBackup(parsed);
        setMessage("서버 DB로 백업 데이터를 가져왔습니다.");
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "잘못된 JSON 파일입니다.");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const migrateLocalStorage = async () => {
    try {
      const todosRaw = localStorage.getItem(STORAGE_KEYS.TODOS) || localStorage.getItem(LEGACY_STORAGE_KEYS.TODOS);
      const reflectionsRaw = localStorage.getItem(STORAGE_KEYS.REFLECTIONS);
      const goalsRaw = localStorage.getItem(STORAGE_KEYS.GOALS);
      const data = {
        version: 6,
        exportedAt: new Date().toISOString(),
        categories: [],
        todos: todosRaw ? JSON.parse(todosRaw) : [],
        reflections: reflectionsRaw ? JSON.parse(reflectionsRaw) : [],
        goals: goalsRaw ? JSON.parse(goalsRaw) : [],
      };
      if (!data.todos.length && !data.reflections.length && !data.goals.length) {
        setError("마이그레이션할 LocalStorage 데이터가 없습니다.");
        return;
      }
      if (!window.confirm("LocalStorage 데이터를 서버 DB로 가져올까요? 기존 서버 데이터는 덮어씁니다.")) return;
      await onMigrateLocalStorage(data);
      if (window.confirm("마이그레이션 후 LocalStorage 데이터를 삭제할까요?")) {
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        Object.values(LEGACY_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      }
      setMessage("LocalStorage 데이터를 서버 DB로 가져왔습니다.");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "LocalStorage 마이그레이션에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">설정</h2>
          <p className="mt-2 text-sm text-ink-400">단일 사용자 모드, 서버 DB, 백업과 데이터 관리를 정리합니다.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="사용 모드" value="단일 사용자" description={apiStatus === "online" ? "Server DB 연결됨" : "API 연결 오류"} />
        <StatCard title="Todo" value={stats.total} />
        <StatCard title="카테고리" value={categories.length} />
        <StatCard title="회고 / 메모" value={`${reflections.length}/${memos.length}`} />
        <StatCard title="목표 / 주제 / 음악" value={`${goals.length}/${topics.length}/${musicLinks.length}`} />
      </section>

      {(message || error) ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${error ? "border-danger/40 bg-danger/10 text-red-100" : "border-success/40 bg-success/10 text-emerald-100"}`}>
          {error || message}
        </div>
      ) : null}

      <section className="app-card p-5">
        <h3 className="text-lg font-bold text-ink-100">서버 데이터 관리</h3>
        <p className="mt-2 text-sm leading-6 text-ink-400">
          현재 데이터는 LocalStorage가 아니라 단일 사용자 default user 기준의 SQLite DB에 저장됩니다. GitHub Pages만으로는 이 서버 기능을 사용할 수 없습니다.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button type="button" className="btn-secondary" onClick={exportJson}><Download size={18} />JSON 내보내기</button>
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}><Upload size={18} />JSON 가져오기</button>
          <button type="button" className="btn-secondary" onClick={migrateLocalStorage}><RotateCcw size={18} />LocalStorage 가져오기</button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
      </section>

      <section className="app-card space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Music2 size={17} className="text-accent-400" />
          <div>
            <h3 className="text-base font-bold text-ink-100">음악 링크</h3>
            <p className="mt-1 text-xs text-ink-500">음악 API를 직접 연결하지 않고 플레이리스트 URL만 저장합니다.</p>
          </div>
        </div>

        <MusicLinkForm submitLabel="링크 저장" onSubmit={onAddMusicLink} />

        <div className="space-y-2">
          {musicLinks.length ? (
            musicLinks.map((link) => (
              <article key={link.id} className="rounded-lg border border-ink-700 bg-ink-950/40 px-3 py-2">
                {editingMusicId === link.id ? (
                  <MusicLinkForm
                    initial={link}
                    submitLabel="수정 저장"
                    onSubmit={(input) => onUpdateMusicLink(link.id, input)}
                    onCancel={() => setEditingMusicId(null)}
                  />
                ) : (
                  <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink-100">{link.title}</p>
                        <span className="rounded-full border border-ink-700 bg-ink-900 px-2 py-0.5 text-[11px] text-ink-300">
                          {providerLabel[link.provider || "ETC"]}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-500">{link.url}</p>
                      {link.memo ? <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-xs leading-5 text-ink-400">{link.memo}</p> : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <a className="icon-btn min-h-8 min-w-8 rounded-md" href={link.url} target="_blank" rel="noreferrer" aria-label="음악 링크 열기">
                        <ExternalLink size={14} />
                      </a>
                      <button type="button" className="icon-btn min-h-8 min-w-8 rounded-md" onClick={() => setEditingMusicId(link.id)} aria-label="음악 링크 수정">
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn min-h-8 min-w-8 rounded-md hover:border-danger hover:text-red-100"
                        onClick={() => window.confirm("음악 링크를 삭제할까요?") && onDeleteMusicLink(link.id)}
                        aria-label="음악 링크 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-ink-700 bg-ink-950/35 px-4 py-3 text-center text-sm text-ink-500">
              저장된 음악 링크가 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
