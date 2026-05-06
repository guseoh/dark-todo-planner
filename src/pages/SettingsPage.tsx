import { ChangeEvent, useRef, useState } from "react";
import { Bell, Download, FileJson, Keyboard, RotateCcw, Trash2, Upload, Volume2 } from "lucide-react";
import { buildBackupData, validateBackupData } from "../lib/storage";
import { STORAGE_KEYS } from "../lib/storageKeys";
import { todayKey } from "../lib/date";
import type { FocusSession, TimerSettings } from "../types/timer";
import type { Goal } from "../types/goal";
import type { Reflection } from "../types/reflection";
import type { Todo } from "../types/todo";
import { StatCard } from "../components/common/StatCard";

type SettingsPageProps = {
  todos: Todo[];
  stats: {
    total: number;
    completedTotal: number;
    archivedTotal: number;
  };
  reflections: Reflection[];
  goals: Goal[];
  focusSessions: FocusSession[];
  timerSettings: TimerSettings;
  onReplaceTodos: (todos: Todo[]) => void;
  onReplaceReflections: (reflections: Reflection[]) => void;
  onReplaceGoals: (goals: Goal[]) => void;
  onReplaceFocusSessions: (sessions: FocusSession[]) => void;
  onUpdateTimerSettings: (settings: Partial<TimerSettings>) => void;
  onRequestNotificationPermission: () => void;
  onClearAll: () => void;
};

const shortcutItems = [
  ["N", "새 Todo 입력창 포커스"],
  ["T", "오늘 보기"],
  ["W", "주간 보기"],
  ["M", "월간 보기"],
  ["A", "전체 Todo"],
  ["R", "회고 페이지"],
  ["G", "목표 페이지"],
  ["F", "타이머 페이지"],
  ["Esc", "모달 닫기"],
  ["Ctrl + Enter", "저장"],
];

export function SettingsPage({
  todos,
  stats,
  reflections,
  goals,
  focusSessions,
  timerSettings,
  onReplaceTodos,
  onReplaceReflections,
  onReplaceGoals,
  onReplaceFocusSessions,
  onUpdateTimerSettings,
  onRequestNotificationPermission,
  onClearAll,
}: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const exportJson = () => {
    const backup = buildBackupData({
      todos,
      reflections,
      goals,
      focusSessions,
      timerSettings,
    });
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dark-todo-planner-backup-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("백업 JSON 파일을 내보냈습니다.");
    setError("");
  };

  const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const result = validateBackupData(parsed);
        if (!result.data) {
          setError(result.error || "백업 데이터 구조가 올바르지 않습니다.");
          setMessage("");
          return;
        }
        const overwrite = window.confirm("현재 Todo, 회고, 목표, 집중 기록 데이터를 백업 파일로 덮어쓸까요?");
        if (!overwrite) return;

        onReplaceTodos(result.data.todos);
        onReplaceReflections(result.data.reflections || []);
        onReplaceGoals(result.data.goals || []);
        onReplaceFocusSessions(result.data.focusSessions || []);
        if (result.data.timerSettings) onUpdateTimerSettings(result.data.timerSettings);
        setMessage(`백업 데이터를 가져왔습니다. 내보낸 시각: ${result.data.exportedAt}`);
        setError("");
      } catch {
        setError("잘못된 JSON 파일입니다.");
        setMessage("");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const clearAll = () => {
    if (window.confirm("모든 Todo, 회고, 목표, 집중 기록을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) {
      onClearAll();
      setMessage("전체 데이터를 초기화했습니다.");
      setError("");
    }
  };

  const updateNumberSetting = (key: keyof TimerSettings, value: string) => {
    onUpdateTimerSettings({ [key]: Number(value) } as Partial<TimerSettings>);
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">설정</h2>
        <p className="mt-2 text-sm text-ink-400">브라우저 저장소, 백업, 타이머 설정, 단축키를 관리합니다.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="저장된 Todo" value={stats.total} icon={<FileJson size={20} />} />
        <StatCard title="완료한 Todo" value={stats.completedTotal} />
        <StatCard title="보관된 Todo" value={stats.archivedTotal} />
        <StatCard title="저장 방식" value="LocalStorage" description="현재 브라우저에만 저장됩니다." />
      </section>

      {(message || error) ? (
        <div className={`rounded-lg border px-4 py-3 text-sm ${
          error ? "border-danger/40 bg-danger/10 text-red-100" : "border-success/40 bg-success/10 text-emerald-100"
        }`}>
          {error || message}
        </div>
      ) : null}

      <section className="app-card p-5">
        <h3 className="text-lg font-bold text-ink-100">데이터 관리</h3>
        <p className="mt-2 text-sm leading-6 text-ink-400">
          Todo, 회고, 목표, 집중 기록은 서버로 전송되지 않고 현재 브라우저의 LocalStorage에 저장됩니다.
          브라우저나 프로필이 바뀌면 별도의 데이터로 취급됩니다.
        </p>
        <div className="mt-4 rounded-lg border border-accent-500/35 bg-accent-500/10 px-4 py-3 text-sm leading-6 text-indigo-100">
          백업 JSON에는 version, exportedAt, todos, reflections, goals, focusSessions, timerSettings가 포함됩니다.
          이전 형식의 Todo 배열 백업도 가져올 수 있습니다.
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <button type="button" className="btn-secondary" onClick={exportJson}>
            <Download size={18} />
            JSON 내보내기
          </button>
          <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload size={18} />
            JSON 가져오기
          </button>
          <button type="button" className="btn-danger" onClick={clearAll}>
            <Trash2 size={18} />
            전체 초기화
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImport} />
      </section>

      <section className="app-card p-5">
        <div className="flex items-center gap-2">
          <Volume2 size={18} className="text-accent-400" />
          <h3 className="text-lg font-bold text-ink-100">타이머 설정</h3>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm text-ink-400">
            집중 시간
            <input className="field" type="number" min="1" value={timerSettings.focusMinutes} onChange={(event) => updateNumberSetting("focusMinutes", event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-ink-400">
            짧은 휴식
            <input className="field" type="number" min="1" value={timerSettings.shortBreakMinutes} onChange={(event) => updateNumberSetting("shortBreakMinutes", event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-ink-400">
            긴 휴식
            <input className="field" type="number" min="1" value={timerSettings.longBreakMinutes} onChange={(event) => updateNumberSetting("longBreakMinutes", event.target.value)} />
          </label>
          <label className="space-y-1 text-sm text-ink-400">
            긴 휴식까지 세션
            <input className="field" type="number" min="1" value={timerSettings.sessionsBeforeLongBreak} onChange={(event) => updateNumberSetting("sessionsBeforeLongBreak", event.target.value)} />
          </label>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-300">
            <input type="checkbox" checked={timerSettings.soundEnabled} onChange={(event) => onUpdateTimerSettings({ soundEnabled: event.target.checked })} className="h-4 w-4 accent-accent-500" />
            알림음
          </label>
          <label className="flex min-h-11 items-center gap-3 rounded-lg border border-ink-700 bg-ink-950/60 px-3 text-sm text-ink-300">
            <input type="checkbox" checked={timerSettings.notificationEnabled} onChange={(event) => onUpdateTimerSettings({ notificationEnabled: event.target.checked })} className="h-4 w-4 accent-accent-500" />
            브라우저 알림
          </label>
          <button type="button" className="btn-secondary" onClick={onRequestNotificationPermission}>
            <Bell size={18} />
            알림 권한 요청
          </button>
        </div>
      </section>

      <section className="app-card p-5">
        <div className="flex items-center gap-2">
          <Keyboard size={18} className="text-accent-400" />
          <h3 className="text-lg font-bold text-ink-100">단축키</h3>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {shortcutItems.map(([key, description]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-950/45 px-3 py-2 text-sm">
              <kbd className="rounded border border-ink-600 bg-ink-800 px-2 py-1 font-semibold text-ink-100">{key}</kbd>
              <span className="text-right text-ink-400">{description}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="app-card p-5">
        <div className="flex items-center gap-2">
          <RotateCcw size={18} className="text-accent-400" />
          <h3 className="text-lg font-bold text-ink-100">LocalStorage 키</h3>
        </div>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-ink-400">
          {Object.values(STORAGE_KEYS).map((key) => (
            <li key={key}>
              <code className="rounded bg-ink-950/70 px-2 py-1 text-ink-200">{key}</code>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
