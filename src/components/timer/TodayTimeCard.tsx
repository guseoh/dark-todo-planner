import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
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

  const totals = useMemo(
    () => totalsByCategory(active ? [...entries, activeAsEntry(active, now + (timer?.offsetMs ?? 0))] : entries, [today], categories),
    [active, categories, entries, now, timer?.offsetMs, today],
  );
  if (!timer) return null;
  const total = totalMs(totals);

  return (
    <section aria-label="오늘 측정 시간" className="today-time-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="!mb-0">오늘 측정 시간</h2>
        <button type="button" className="icon-btn h-7 w-7" onClick={() => setOpen(true)} title="하루 타임라인 보기" aria-label="하루 타임라인 보기"><Clock size={13} /></button>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-ui-text">{total ? formatDuration(total) : "0분"}</p>
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
