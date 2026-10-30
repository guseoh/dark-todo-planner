import { useEffect, useState, type KeyboardEvent } from "react";
import { BellRing, Moon, Monitor, RefreshCw, Save, Sun } from "lucide-react";
import { readThemePreference, setThemePreference, type ThemePreference } from "../lib/theme";
import { StatCard } from "../components/common/StatCard";
import { PageHeader } from "../components/common/PageHeader";
import { CalendarExportCard } from "../components/settings/CalendarExportCard";
import { ExportPanel } from "../components/settings/ExportPanel";
import { BackupRestoreCard } from "../components/settings/BackupRestoreCard";
import { PwaInstallCard } from "../components/settings/PwaInstallCard";
import { RoutinePanel } from "../components/settings/RoutinePanel";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Memo } from "../types/memo";
import type { Project } from "../types/project";
import type { Todo } from "../types/todo";
import type { PlannerSettings, PlannerSettingsInput } from "../types/settings";

type SettingsPageProps = {
  categories: Category[];
  projects: Project[];
  stats: { total: number; completedTotal: number; archivedTotal: number };
  goals: Goal[];
  memos: Memo[];
  todos: Todo[];
  plannerSettings: PlannerSettings;
  onSavePlannerSettings: (input: PlannerSettingsInput) => Promise<PlannerSettings | undefined>;
  onTodosCreated: () => unknown | Promise<unknown>;
  apiStatus?: "online" | "offline";
};

const optionCardClass = (enabled: boolean) =>
  `flex cursor-pointer items-start gap-3 border-b border-ui-divider px-1 py-4 transition-colors ${enabled ? "bg-ui-selected/50" : "hover:bg-ui-hover"}`;

export function SettingsPage({
  categories,
  projects,
  stats,
  goals,
  memos,
  todos,
  plannerSettings,
  onSavePlannerSettings,
  onTodosCreated,
  apiStatus = "online",
}: SettingsPageProps) {
  const connected = apiStatus === "online";
  const [themePreference, updateThemePreference] = useState<ThemePreference>(readThemePreference);
  const chooseTheme = (next: ThemePreference) => {
    setThemePreference(next);
    updateThemePreference(next);
  };
  const [draft, setDraft] = useState<PlannerSettingsInput>({
    carryOverEnabled: false,
    autoArchiveCompleted: false,
    reminderTodayEnabled: true,
    reminderOverdueEnabled: false,
    reminderDueSoonEnabled: false,
    reminderDueSoonDays: 3,
  });
  const [section, setSection] = useState<"overview" | "automation" | "data">("overview");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const tabs = ["overview", "automation", "data"] as const;
  const handleTabKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(section);
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs[tabs.length - 1]
      : tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
    setSection(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  };

  useEffect(() => {
    setDraft({
      carryOverEnabled: plannerSettings.carryOverEnabled,
      autoArchiveCompleted: plannerSettings.autoArchiveCompleted,
      reminderTodayEnabled: plannerSettings.reminderTodayEnabled,
      reminderOverdueEnabled: plannerSettings.reminderOverdueEnabled,
      reminderDueSoonEnabled: plannerSettings.reminderDueSoonEnabled,
      reminderDueSoonDays: plannerSettings.reminderDueSoonDays,
    });
  }, [plannerSettings]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await onSavePlannerSettings(draft);
      setMessage(result ? "운영 설정을 저장했습니다." : "운영 설정을 저장하지 못했습니다.");
    } catch {
      setMessage("운영 설정을 저장하지 못했습니다. 입력값을 유지했으니 다시 시도해 주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell max-w-[1180px]">
      <PageHeader title="설정" description="앱 연결 상태, 자동화·알림 기준, 백업과 저장된 데이터를 관리합니다."
        meta={connected ? "서버 연결됨" : "연결 확인 필요"}
      />

      <nav className="page-tabs" aria-label="설정 항목" role="tablist">
        {([
          { id: "overview", label: "앱 및 연결 정보" },
          { id: "automation", label: "자동화 · 알림" },
          { id: "data", label: "데이터 · 백업" },
        ] as const).map((item) => (
          <button key={item.id} id={`settings-tab-${item.id}`} type="button" role="tab" aria-controls={`settings-panel-${item.id}`}
            aria-selected={section === item.id} tabIndex={section === item.id ? 0 : -1}
            onKeyDown={handleTabKey} onClick={() => setSection(item.id)}
            className="page-tab flex-1 sm:flex-initial">
            {item.label}
          </button>
        ))}
      </nav>
      {message ? <p className="border-l-2 border-ink-500 py-1 pl-3 text-sm text-ink-200" role="status" aria-live="polite">{message}</p> : null}

      {section === "overview" ? (
      <div id="settings-panel-overview" role="tabpanel" aria-labelledby="settings-tab-overview" tabIndex={0} className="space-y-4">
      <section className="work-section px-1 py-4" aria-labelledby="appearance-title">
        <h3 id="appearance-title" className="text-base font-semibold text-ui-text">화면 테마</h3>
        <p className="mt-1 text-sm text-ui-secondary">선택한 테마는 이 브라우저에 저장됩니다. 시스템 설정은 운영체제의 밝기 모드를 따릅니다.</p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="화면 테마 선택">
          {([
            { id: "dark", label: "다크", icon: Moon },
            { id: "light", label: "라이트", icon: Sun },
            { id: "system", label: "시스템", icon: Monitor },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} aria-pressed={themePreference === id} onClick={() => chooseTheme(id)}
              className={`btn-secondary min-w-24 gap-2 ${themePreference === id ? "border-ui-focus bg-ui-selected text-ui-text" : ""}`}>
              <Icon size={15} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      </section>
      <section className="app-card py-4" aria-labelledby="operation-info-title">
        <div className="flex flex-col gap-3 border-b border-ink-700 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h3 id="operation-info-title" className="text-base font-bold text-ink-100">운영 정보</h3><p className="mt-1 text-xs text-ink-400">개인 플래너의 고정 운영 기준입니다.</p></div>
          <div className={`inline-flex min-h-9 items-center gap-2 self-start text-xs font-medium ${connected ? "text-ink-300" : "text-danger"}`} role="status">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-danger"}`} aria-hidden="true" />{connected ? "Cloudflare D1 연결됨" : "Cloudflare D1 연결 확인 필요"}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="border-b border-ink-700/35 px-1 py-3"><dt className="text-xs font-semibold text-ink-500">사용 모드</dt><dd className="mt-1 text-sm font-bold text-ink-100">단일 사용자</dd></div>
          <div className="border-b border-ink-700/35 px-1 py-3"><dt className="text-xs font-semibold text-ink-500">저장소</dt><dd className="mt-1 text-sm font-bold text-ink-100">Cloudflare D1</dd></div>
          <div className="border-b border-ink-700/35 px-1 py-3"><dt className="text-xs font-semibold text-ink-500">하루 시작 시각</dt><dd className="mt-1 text-sm font-bold text-ink-100">오전 3시</dd></div>
          <div className="border-b border-ink-700/35 px-1 py-3"><dt className="text-xs font-semibold text-ink-500">Discord Todo 알림</dt><dd className="mt-1 text-sm font-bold text-ink-100">매일 오후 9시 일괄 알림</dd><p className="mt-1 text-xs text-ink-400">현재 개별 시각 예약 알림은 지원하지 않습니다.</p></div>
        </dl>
      </section>

      <PwaInstallCard />
      </div>
      ) : null}

      {section === "automation" ? (
      <div id="settings-panel-automation" role="tabpanel" aria-labelledby="settings-tab-automation" tabIndex={0} className="space-y-4">
      <section className="app-card py-4" aria-labelledby="automation-settings-title">
        <div className="flex items-center gap-2"><RefreshCw size={18} className="text-accent-300" /><h3 id="automation-settings-title" className="text-base font-bold text-ink-100">Todo 자동화</h3></div>
        <p className="mt-1 text-xs text-ink-400">기본값은 꺼짐입니다. 필요한 자동화만 직접 켤 수 있습니다.</p>
        <div className="mt-4 space-y-3">
          <label className={optionCardClass(draft.carryOverEnabled)}>
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.carryOverEnabled} onChange={(event) => setDraft((current) => ({ ...current, carryOverEnabled: event.target.checked }))} />
            <span><span className="block text-sm font-bold text-ink-100">미완료 Todo 자동 Carry Over</span><span className="mt-1 block text-xs text-ink-400">지난 실행일의 미완료·비반복 Scheduled Todo를 앱을 열 때 오늘로 이동합니다. 마감일은 바꾸지 않습니다.</span></span>
          </label>
          <label className={optionCardClass(draft.autoArchiveCompleted)}>
            <input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.autoArchiveCompleted} onChange={(event) => setDraft((current) => ({ ...current, autoArchiveCompleted: event.target.checked }))} />
            <span><span className="block text-sm font-bold text-ink-100">완료 Todo 자동 보관</span><span className="mt-1 block text-xs text-ink-400">완료 처리된 Todo를 자동으로 보관합니다. 설정을 켠 뒤 앱을 열면 기존 완료 Todo도 정리합니다.</span></span>
          </label>
        </div>
      </section>

      <section className="app-card py-4" aria-labelledby="reminder-settings-title">
        <div className="flex items-center gap-2"><BellRing size={18} className="text-accent-300" /><h3 id="reminder-settings-title" className="text-base font-bold text-ink-100">Discord 리마인더</h3></div>
        <p className="mt-1 text-xs text-ink-400">아래 조건은 매일 오후 9시(한국 시간) 일괄 알림에 사용됩니다.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className={optionCardClass(draft.reminderTodayEnabled)}><input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.reminderTodayEnabled} onChange={(event) => setDraft((current) => ({ ...current, reminderTodayEnabled: event.target.checked }))} /><span><span className="block text-sm font-bold text-ink-100">오늘 미완료 Todo</span><span className="mt-1 block text-xs text-ink-400">기존 오후 9시 알림 기준입니다.</span></span></label>
          <label className={optionCardClass(draft.reminderOverdueEnabled)}><input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.reminderOverdueEnabled} onChange={(event) => setDraft((current) => ({ ...current, reminderOverdueEnabled: event.target.checked }))} /><span><span className="block text-sm font-bold text-ink-100">마감 초과 Todo</span><span className="mt-1 block text-xs text-ink-400">due date가 지난 미완료 Todo를 함께 알립니다.</span></span></label>
          <label className={optionCardClass(draft.reminderDueSoonEnabled)}><input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.reminderDueSoonEnabled} onChange={(event) => setDraft((current) => ({ ...current, reminderDueSoonEnabled: event.target.checked }))} /><span><span className="block text-sm font-bold text-ink-100">곧 마감되는 Todo</span><span className="mt-1 block text-xs text-ink-400">오늘부터 지정한 기간 안에 마감되는 Todo를 포함합니다.</span></span></label>
          <label className={`flex flex-col justify-center border-b border-ink-700/40 px-1 py-3 text-sm font-medium text-ink-200 ${draft.reminderDueSoonEnabled ? "" : "opacity-65"}`}>마감 임박 기간<input className="field mt-2" type="number" min="1" max="14" value={draft.reminderDueSoonDays} onChange={(event) => setDraft((current) => ({ ...current, reminderDueSoonDays: Math.min(14, Math.max(1, Number(event.target.value) || 1)) }))} disabled={!draft.reminderDueSoonEnabled} /><span className="mt-1 block text-xs font-normal text-ink-400">1~14일 사이에서 설정합니다.</span></label>
        </div>
        <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}><Save size={16} />{saving ? "저장 중..." : "운영 설정 저장"}</button></div>
      </section>

      <RoutinePanel categories={categories} projects={projects} onTodosCreated={onTodosCreated} />
      </div>
      ) : null}

      {section === "data" ? (
      <div id="settings-panel-data" role="tabpanel" aria-labelledby="settings-tab-data" tabIndex={0} className="space-y-4">
      <CalendarExportCard />
      <BackupRestoreCard onRestored={async () => { await onTodosCreated(); }} />
      <ExportPanel todos={todos} projects={projects} goals={goals} memos={memos} />

      <section aria-labelledby="data-summary-title">
        <h3 id="data-summary-title" className="mb-3 text-base font-bold text-ink-100">저장된 데이터</h3>
        <div className="grid gap-x-5 gap-y-2 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Todo" value={stats.total} description={`완료 ${stats.completedTotal} · 보관 ${stats.archivedTotal}`} />
          <StatCard title="카테고리" value={categories.length} />
          <StatCard title="메모" value={memos.length} />
          <StatCard title="목표" value={goals.length} />
        </div>
      </section>
      </div>
      ) : null}
    </div>
  );
}
