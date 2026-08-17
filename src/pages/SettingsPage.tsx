import { useEffect, useState } from "react";
import { BellRing, RefreshCw, Save } from "lucide-react";
import { StatCard } from "../components/common/StatCard";
import { CalendarExportCard } from "../components/settings/CalendarExportCard";
import { PwaInstallCard } from "../components/settings/PwaInstallCard";
import { RoutinePanel } from "../components/settings/RoutinePanel";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Memo } from "../types/memo";
import type { Project } from "../types/project";
import type { PlannerSettings, PlannerSettingsInput } from "../types/settings";

type SettingsPageProps = {
  categories: Category[];
  projects: Project[];
  stats: { total: number; completedTotal: number; archivedTotal: number };
  goals: Goal[];
  memos: Memo[];
  plannerSettings: PlannerSettings;
  onSavePlannerSettings: (input: PlannerSettingsInput) => Promise<PlannerSettings | undefined>;
  onTodosCreated: () => unknown | Promise<unknown>;
  apiStatus?: "online" | "offline";
};

const optionCardClass = (enabled: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
    enabled
      ? "border-accent-500/35 bg-accent-500/[0.06]"
      : "border-ink-700/70 bg-ink-950/25 hover:border-ink-600/80 hover:bg-ink-900/55"
  }`;

export function SettingsPage({
  categories,
  projects,
  stats,
  goals,
  memos,
  plannerSettings,
  onSavePlannerSettings,
  onTodosCreated,
  apiStatus = "online",
}: SettingsPageProps) {
  const connected = apiStatus === "online";
  const [draft, setDraft] = useState<PlannerSettingsInput>({
    carryOverEnabled: false,
    autoArchiveCompleted: false,
    reminderTodayEnabled: true,
    reminderOverdueEnabled: false,
    reminderDueSoonEnabled: false,
    reminderDueSoonDays: 3,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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
    setSaving(true);
    const result = await onSavePlannerSettings(draft);
    setSaving(false);
    setMessage(result ? "운영 설정을 저장했습니다." : "운영 설정을 저장하지 못했습니다.");
    window.setTimeout(() => setMessage(""), 3000);
  };

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">앱 정보</h2>
        <p className="mt-2 text-sm text-ink-400">앱 연결 상태, 설치, 자동화와 알림 기준, 저장된 데이터 현황을 관리합니다.</p>
      </section>

      {message ? <div className="rounded-lg border border-ink-700/70 bg-ink-900/75 px-3 py-2 text-sm font-semibold text-ink-200" aria-live="polite">{message}</div> : null}

      <section className="app-card p-4 sm:p-5" aria-labelledby="operation-info-title">
        <div className="flex flex-col gap-3 border-b border-ink-700 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div><h3 id="operation-info-title" className="text-base font-bold text-ink-100">운영 정보</h3><p className="mt-1 text-xs text-ink-400">개인 플래너의 고정 운영 기준입니다.</p></div>
          <div className={`inline-flex min-h-9 items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs font-semibold ${connected ? "border-success/30 bg-success/[0.07] text-emerald-100" : "border-danger/40 bg-danger/[0.07] text-red-100"}`} role="status">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-danger"}`} aria-hidden="true" />{connected ? "Cloudflare D1 연결됨" : "Cloudflare D1 연결 확인 필요"}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-800/70 bg-ink-950/25 p-3"><dt className="text-xs font-semibold text-ink-500">사용 모드</dt><dd className="mt-1 text-sm font-bold text-ink-100">단일 사용자</dd></div>
          <div className="rounded-lg border border-ink-800/70 bg-ink-950/25 p-3"><dt className="text-xs font-semibold text-ink-500">저장소</dt><dd className="mt-1 text-sm font-bold text-ink-100">Cloudflare D1</dd></div>
          <div className="rounded-lg border border-ink-800/70 bg-ink-950/25 p-3"><dt className="text-xs font-semibold text-ink-500">하루 시작 시각</dt><dd className="mt-1 text-sm font-bold text-ink-100">오전 3시</dd></div>
          <div className="rounded-lg border border-ink-800/70 bg-ink-950/25 p-3"><dt className="text-xs font-semibold text-ink-500">Discord Todo 알림</dt><dd className="mt-1 text-sm font-bold text-ink-100">일괄 오후 9시 · 개별 5분 주기</dd><p className="mt-1 text-xs text-ink-400">Todo 수정 화면에서 개별 알림 시각을 예약할 수 있습니다.</p></div>
        </dl>
      </section>

      <PwaInstallCard />
      <CalendarExportCard />

      <section className="app-card p-4 sm:p-5" aria-labelledby="automation-settings-title">
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

      <section className="app-card p-4 sm:p-5" aria-labelledby="reminder-settings-title">
        <div className="flex items-center gap-2"><BellRing size={18} className="text-accent-300" /><h3 id="reminder-settings-title" className="text-base font-bold text-ink-100">Discord 리마인더</h3></div>
        <p className="mt-1 text-xs text-ink-400">아래 조건은 오후 9시 일괄 알림에 사용됩니다. Todo별 알림은 Todo 수정 화면에서 따로 예약합니다.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className={optionCardClass(draft.reminderTodayEnabled)}><input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.reminderTodayEnabled} onChange={(event) => setDraft((current) => ({ ...current, reminderTodayEnabled: event.target.checked }))} /><span><span className="block text-sm font-bold text-ink-100">오늘 미완료 Todo</span><span className="mt-1 block text-xs text-ink-400">기존 오후 9시 알림 기준입니다.</span></span></label>
          <label className={optionCardClass(draft.reminderOverdueEnabled)}><input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.reminderOverdueEnabled} onChange={(event) => setDraft((current) => ({ ...current, reminderOverdueEnabled: event.target.checked }))} /><span><span className="block text-sm font-bold text-ink-100">마감 초과 Todo</span><span className="mt-1 block text-xs text-ink-400">due date가 지난 미완료 Todo를 함께 알립니다.</span></span></label>
          <label className={optionCardClass(draft.reminderDueSoonEnabled)}><input type="checkbox" className="mt-1 h-4 w-4 accent-accent-500" checked={draft.reminderDueSoonEnabled} onChange={(event) => setDraft((current) => ({ ...current, reminderDueSoonEnabled: event.target.checked }))} /><span><span className="block text-sm font-bold text-ink-100">곧 마감되는 Todo</span><span className="mt-1 block text-xs text-ink-400">오늘부터 지정한 기간 안에 마감되는 Todo를 포함합니다.</span></span></label>
          <label className={`rounded-lg border p-3 text-sm font-bold text-ink-100 transition ${draft.reminderDueSoonEnabled ? "border-accent-500/35 bg-accent-500/[0.06]" : "border-ink-700/70 bg-ink-950/25"}`}>마감 임박 기간<input className="field mt-2" type="number" min="1" max="14" value={draft.reminderDueSoonDays} onChange={(event) => setDraft((current) => ({ ...current, reminderDueSoonDays: Math.min(14, Math.max(1, Number(event.target.value) || 1)) }))} disabled={!draft.reminderDueSoonEnabled} /><span className="mt-1 block text-xs font-normal text-ink-400">1~14일 사이에서 설정합니다.</span></label>
        </div>
        <div className="mt-4 flex justify-end"><button type="button" className="btn-primary" onClick={() => void save()} disabled={saving}><Save size={16} />{saving ? "저장 중..." : "운영 설정 저장"}</button></div>
      </section>

      <RoutinePanel categories={categories} projects={projects} onTodosCreated={onTodosCreated} />

      <section aria-labelledby="data-summary-title">
        <h3 id="data-summary-title" className="mb-3 text-base font-bold text-ink-100">저장된 데이터</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Todo" value={stats.total} description={`완료 ${stats.completedTotal} · 보관 ${stats.archivedTotal}`} />
          <StatCard title="카테고리" value={categories.length} />
          <StatCard title="메모" value={memos.length} />
          <StatCard title="목표" value={goals.length} />
        </div>
      </section>
    </div>
  );
}
