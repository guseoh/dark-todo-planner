import { ChangeEvent, useEffect, useRef, useState } from "react";
import { Bell, Download, ExternalLink, Music2, RotateCcw, Trash2, Upload, Volume2 } from "lucide-react";
import type { Category } from "../types/category";
import type { FocusMusicLink, FocusMusicProvider } from "../types/focusMusic";
import type { FocusSession, TimerSettings } from "../types/timer";
import type { Goal } from "../types/goal";
import type { Reflection } from "../types/reflection";
import { StatCard } from "../components/common/StatCard";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { LEGACY_STORAGE_KEYS } from "../lib/storageKeys";
import { createId } from "../lib/id";

type SettingsPageProps = {
  categories: Category[];
  stats: { total: number; completedTotal: number; archivedTotal: number };
  reflections: Reflection[];
  goals: Goal[];
  focusSessions: FocusSession[];
  timerSettings: TimerSettings;
  onExportBackup: () => Promise<Record<string, unknown>>;
  onImportBackup: (data: unknown) => Promise<void>;
  onMigrateLocalStorage: (data: unknown) => Promise<void>;
  onUpdateTimerSettings: (settings: Partial<TimerSettings>) => void;
  onRequestNotificationPermission: () => void;
  apiStatus?: "online" | "offline";
};

const providerLabel: Record<FocusMusicProvider, string> = {
  YOUTUBE: "YouTube",
  YOUTUBE_MUSIC: "YouTube Music",
  MELON: "Melon",
  SPOTIFY: "Spotify",
  ETC: "기타",
};

const inferProvider = (url: string): FocusMusicProvider => {
  const normalized = url.toLowerCase();
  if (normalized.includes("music.youtube.com")) return "YOUTUBE_MUSIC";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "YOUTUBE";
  if (normalized.includes("melon.com")) return "MELON";
  if (normalized.includes("spotify.com")) return "SPOTIFY";
  return "ETC";
};

const readMusicLinks = () => {
  if (typeof localStorage === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.FOCUS_MUSIC_LINKS) || "[]") as FocusMusicLink[];
  } catch {
    return [];
  }
};

export function SettingsPage({
  categories,
  stats,
  reflections,
  goals,
  focusSessions,
  timerSettings,
  onExportBackup,
  onImportBackup,
  onMigrateLocalStorage,
  onUpdateTimerSettings,
  onRequestNotificationPermission,
  apiStatus = "online",
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [musicLinks, setMusicLinks] = useState<FocusMusicLink[]>(readMusicLinks);
  const [musicTitle, setMusicTitle] = useState("");
  const [musicUrl, setMusicUrl] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FOCUS_MUSIC_LINKS, JSON.stringify(musicLinks));
  }, [musicLinks]);

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
      const sessionsRaw = localStorage.getItem(STORAGE_KEYS.FOCUS_SESSIONS);
      const settingsRaw = localStorage.getItem(STORAGE_KEYS.TIMER_SETTINGS);
      const data = {
        version: 3,
        exportedAt: new Date().toISOString(),
        categories: [],
        todos: todosRaw ? JSON.parse(todosRaw) : [],
        reflections: reflectionsRaw ? JSON.parse(reflectionsRaw) : [],
        goals: goalsRaw ? JSON.parse(goalsRaw) : [],
        focusSessions: sessionsRaw ? JSON.parse(sessionsRaw) : [],
        timerSettings: settingsRaw ? JSON.parse(settingsRaw) : undefined,
      };
      if (!data.todos.length && !data.reflections.length && !data.goals.length && !data.focusSessions.length) {
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

  const updateNumberSetting = (key: keyof TimerSettings, value: string) => {
    onUpdateTimerSettings({ [key]: Number(value) } as Partial<TimerSettings>);
  };

  const addMusicLink = () => {
    const title = musicTitle.trim();
    const url = musicUrl.trim();
    if (!title || !url) return;
    try {
      const parsed = new URL(url);
      const nextLink: FocusMusicLink = {
        id: createId(),
        title,
        url: parsed.toString(),
        provider: inferProvider(parsed.toString()),
        createdAt: new Date().toISOString(),
      };
      setMusicLinks((current) => [nextLink, ...current]);
      setMusicTitle("");
      setMusicUrl("");
      setMessage("집중 음악 링크를 저장했습니다.");
      setError("");
    } catch {
      setError("올바른 URL을 입력해주세요.");
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">설정</h2>
          <p className="mt-2 text-sm text-ink-400">단일 사용자 모드, 서버 DB, 백업, 타이머 설정, 집중 음악 링크를 관리합니다.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="사용 모드" value="단일 사용자" description={apiStatus === "online" ? "Server DB 연결됨" : "API 연결 오류"} />
        <StatCard title="Todo" value={stats.total} />
        <StatCard title="카테고리" value={categories.length} />
        <StatCard title="회고 / 목표" value={`${reflections.length}/${goals.length}`} />
        <StatCard title="집중 기록" value={`${focusSessions.length}개`} />
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

      <section className="app-card p-5">
        <div className="flex items-center gap-2"><Volume2 size={18} className="text-accent-400" /><h3 className="text-lg font-bold text-ink-100">타이머 설정</h3></div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <input className="field" type="number" min="1" value={timerSettings.focusMinutes} onChange={(event) => updateNumberSetting("focusMinutes", event.target.value)} aria-label="집중 시간" />
          <input className="field" type="number" min="1" value={timerSettings.shortBreakMinutes} onChange={(event) => updateNumberSetting("shortBreakMinutes", event.target.value)} aria-label="짧은 휴식" />
          <input className="field" type="number" min="1" value={timerSettings.longBreakMinutes} onChange={(event) => updateNumberSetting("longBreakMinutes", event.target.value)} aria-label="긴 휴식" />
          <input className="field" type="number" min="1" value={timerSettings.sessionsBeforeLongBreak} onChange={(event) => updateNumberSetting("sessionsBeforeLongBreak", event.target.value)} aria-label="긴 휴식까지 세션" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-300">
            <input type="checkbox" checked={timerSettings.soundEnabled} onChange={(event) => onUpdateTimerSettings({ soundEnabled: event.target.checked })} className="h-4 w-4 accent-accent-500" />알림음
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-300">
            <input type="checkbox" checked={timerSettings.notificationEnabled} onChange={(event) => onUpdateTimerSettings({ notificationEnabled: event.target.checked })} className="h-4 w-4 accent-accent-500" />브라우저 알림
          </label>
          <button type="button" className="btn-secondary" onClick={onRequestNotificationPermission}><Bell size={18} />알림 권한 요청</button>
        </div>
      </section>

      <section className="app-card p-5">
        <div className="flex items-center gap-2"><Music2 size={18} className="text-accent-400" /><h3 className="text-lg font-bold text-ink-100">집중 음악 링크</h3></div>
        <p className="mt-2 text-sm leading-6 text-ink-400">
          음원을 앱 안에서 직접 재생하지 않고, YouTube Music, Melon, Spotify 같은 외부 플레이리스트 링크만 저장합니다. 링크는 이 브라우저의 LocalStorage에 보관됩니다.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto]">
          <input className="field" value={musicTitle} onChange={(event) => setMusicTitle(event.target.value)} placeholder="예: Lo-fi 집중 플레이리스트" />
          <input className="field" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder="https://..." />
          <button type="button" className="btn-primary" onClick={addMusicLink} disabled={!musicTitle.trim() || !musicUrl.trim()}>
            링크 저장
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {musicLinks.length ? (
            musicLinks.map((link) => (
              <article key={link.id} className="flex flex-col gap-2 rounded-lg border border-ink-700 bg-ink-950/45 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-100">{link.title}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">{providerLabel[link.provider || "ETC"]} · {link.url}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <a className="btn-secondary min-h-9 px-3 py-1.5 text-sm" href={link.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} />
                    열기
                  </a>
                  <button
                    type="button"
                    className="icon-btn min-h-9 min-w-9 rounded-md hover:border-danger hover:text-red-100"
                    onClick={() => setMusicLinks((current) => current.filter((item) => item.id !== link.id))}
                    aria-label="집중 음악 링크 삭제"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-ink-700 bg-ink-950/35 px-4 py-4 text-center text-sm text-ink-500">
              아직 저장된 집중 음악 링크가 없습니다.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
