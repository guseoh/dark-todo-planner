import { useMemo, useState } from "react";
import { Check, Clock, Target } from "lucide-react";
import { useTimeEntries } from "../../hooks/useTimeEntries";
import { todayKey } from "../../lib/date";
import { activeAsEntry, formatDuration, totalMs, totalsByCategory } from "../../lib/timeTracking";
import { Modal } from "../common/Modal";
import { useTodoQuickActions } from "../todo/TodoQuickActionsContext";
import { DayTimeline } from "./DayTimeline";
import { useNowMs } from "./ElapsedClock";
import { useTimeTracking } from "./TimeTrackingContext";

/** Today's measured time per category; opens the whole-day timeline. */
export function TodayTimeCard() {
  const timer = useTimeTracking();
  const categories = useTodoQuickActions()?.categories ?? [];
  const today = todayKey();
  const { entries } = useTimeEntries(today, today);
  const active = timer?.active ?? null;
  const now = useNowMs(Boolean(active));
  const [open, setOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalHours, setGoalHours] = useState("");

  const totals = useMemo(
    () => totalsByCategory(active ? [...entries, activeAsEntry(active, now + (timer?.offsetMs ?? 0))] : entries, [today], categories),
    [active, categories, entries, now, timer?.offsetMs, today],
  );
  if (!timer) return null;
  const total = totalMs(totals);
  const goalMinutes = timer.dailyGoalMinutes;
  const reached = goalMinutes > 0 && total >= goalMinutes * 60_000;
  const saveGoal = async () => {
    const hours = Number(goalHours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) return;
    if (await timer.setDailyGoalMinutes(Math.round(hours * 60))) setEditingGoal(false);
  };

  return (
    <section aria-label="오늘 측정 시간" className="today-time-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="!mb-0">오늘 측정 시간</h2>
        <button type="button" className="icon-btn h-7 w-7" onClick={() => setOpen(true)} title="하루 타임라인 보기" aria-label="하루 타임라인 보기"><Clock size={13} /></button>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-ui-text">{total ? formatDuration(total) : "0분"}</p>
      {goalMinutes > 0 && !editingGoal ? (
        <div className="mt-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={reached ? "font-semibold text-success" : "text-ui-secondary"}>
              {reached ? "목표 달성" : `목표 ${formatDuration(goalMinutes * 60_000)}`} · {Math.min(999, Math.round(total / (goalMinutes * 60_000) * 100))}%
            </span>
            <button type="button" className="text-ui-muted underline-offset-2 hover:text-ui-text hover:underline" onClick={() => { setGoalHours(String(goalMinutes / 60)); setEditingGoal(true); }}>수정</button>
          </div>
          <div className="day-timeline__bar mt-1" role="progressbar" aria-label="일일 목표 달성률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.round(total / (goalMinutes * 60_000) * 100))}>
            <i style={{ width: `${Math.min(100, total / (goalMinutes * 60_000) * 100)}%`, backgroundColor: reached ? "var(--success)" : "var(--ui-text-secondary)" }} />
          </div>
        </div>
      ) : null}
      {editingGoal ? (
        <form className="mt-2 flex items-center gap-1.5" onSubmit={(event) => { event.preventDefault(); void saveGoal(); }}>
          <label className="sr-only" htmlFor="daily-goal-hours">일일 목표 시간(시간 단위)</label>
          <input id="daily-goal-hours" className="field h-8 min-h-8 w-20 px-2 py-1 text-xs" type="number" min={0} max={24} step={0.5} value={goalHours} autoFocus
            onChange={(event) => setGoalHours(event.target.value)} placeholder="예: 4" />
          <span className="text-xs text-ui-muted">시간</span>
          <button type="submit" className="icon-btn h-8 w-8" aria-label="목표 저장" title="저장 (0이면 목표 해제)"><Check size={14} /></button>
        </form>
      ) : goalMinutes === 0 ? (
        <button type="button" className="mt-1.5 inline-flex items-center gap-1 text-xs text-ui-muted hover:text-ui-text" onClick={() => { setGoalHours("4"); setEditingGoal(true); }}>
          <Target size={12} aria-hidden="true" />일일 목표 시간 정하기
        </button>
      ) : null}
      {totals.length ? (
        <ul className="mt-2 space-y-1.5">
          {totals.slice(0, 4).map((item) => (
            <li key={item.key} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="tabular-nums text-ui-secondary">{formatDuration(item.ms)}</span>
              </div>
              <div className="day-timeline__bar mt-1" aria-hidden="true"><i style={{ width: `${Math.max(3, item.ms / total * 100)}%`, backgroundColor: item.color }} /></div>
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-xs text-ui-muted">할 일의 ▶ 버튼을 눌러 측정을 시작하세요.</p>}
      {open ? (
        <Modal title="하루 타임라인" description="새벽 3시부터 다음 날 새벽 3시까지입니다." size="lg" onClose={() => setOpen(false)}>
          <DayTimeline date={today} categories={categories} />
        </Modal>
      ) : null}
    </section>
  );
}
