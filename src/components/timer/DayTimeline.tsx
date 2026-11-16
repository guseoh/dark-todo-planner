import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useDailyReflection } from "../../hooks/useDailyReflection";
import { useTimeEntries } from "../../hooks/useTimeEntries";
import { formatDuration, clockLabel, entryCategoryName, entryColor, intervalOnDay, totalMs, totalsByCategory, activeAsEntry } from "../../lib/timeTracking";
import { formatKoreanDate, todayKey } from "../../lib/date";
import type { Category } from "../../types/category";
import type { TimeEntry } from "../../types/timeTracking";
import { useNowMs } from "./ElapsedClock";
import { TimeEntryModal } from "./TimeEntryModal";
import { useTimeTracking } from "./TimeTrackingContext";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

/** The whole planner day (03:00 → 03:00) split into hours, with measured time coloured by category. */
export function DayTimeline({ date, categories }: { date: string; categories: Category[] }) {
  const timer = useTimeTracking();
  const { entries, loaded, error, create, update, remove } = useTimeEntries(date, date);
  const [editing, setEditing] = useState<TimeEntry | "new" | null>(null);
  const active = timer?.active ?? null;
  const now = useNowMs(Boolean(active));
  const isToday = date === todayKey();
  const reflection = useDailyReflection(date);
  const goalMinutes = timer?.dailyGoalMinutes ?? 0;

  const all = useMemo(
    () => active && isToday ? [...entries, activeAsEntry(active, now + (timer?.offsetMs ?? 0))] : entries,
    [active, entries, isToday, now, timer?.offsetMs],
  );
  const totals = useMemo(() => totalsByCategory(all, [date], categories), [all, date, categories]);
  const total = totalMs(totals);

  const defaults = useMemo(() => {
    const end = isToday ? new Date() : new Date(`${date}T10:00:00`);
    return { start: new Date(end.getTime() - 3_600_000).toISOString(), end: end.toISOString() };
  }, [date, isToday]);

  return (
    <section className="day-timeline" aria-label={`${formatKoreanDate(date, "M월 d일")} 측정 타임라인`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs text-ui-muted">{formatKoreanDate(date, "M월 d일 EEEE")} 측정 시간</p>
          <p className="text-2xl font-semibold tabular-nums text-ui-text">{total ? formatDuration(total) : "기록 없음"}</p>
        </div>
        <button type="button" className="btn-secondary text-xs" onClick={() => setEditing("new")}><Plus size={14} />기록 추가</button>
      </div>

      {goalMinutes > 0 && total ? (
        <p className={`text-xs ${total >= goalMinutes * 60_000 ? "font-semibold text-success" : "text-ui-secondary"}`}>
          일일 목표 {formatDuration(goalMinutes * 60_000)} 중 {Math.round(total / (goalMinutes * 60_000) * 100)}%{total >= goalMinutes * 60_000 ? " · 달성" : ""}
        </p>
      ) : null}
      {reflection.content ? <p className="border-l-2 border-ui-divider pl-3 text-sm italic text-ui-secondary" aria-label="하루 회고">{reflection.content}</p> : null}
      {totals.length ? (
        <ul className="day-timeline__totals" aria-label="카테고리별 측정 시간">
          {totals.map((item) => (
            <li key={item.key}>
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <span className="tabular-nums text-ui-secondary">{formatDuration(item.ms)}</span>
              <span className="day-timeline__bar" aria-hidden="true"><i style={{ width: `${Math.max(2, item.ms / total * 100)}%`, backgroundColor: item.color }} /></span>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}

      <div className="day-timeline__grid" role="group" aria-label="시간대별 측정 기록">
        {HOURS.map((hour) => (
          <div key={hour} className="day-timeline__row" data-hour={hour}>
            <span className="day-timeline__label">{clockLabel(hour * 60)}</span>
            <div className="day-timeline__track">
              {all.map((entry) => {
                const part = intervalOnDay(entry.startedAt, entry.endedAt, date);
                if (!part) return null;
                const from = Math.max(part.start, hour * 60);
                const to = Math.min(part.end, (hour + 1) * 60);
                if (to <= from) return null;
                const running = entry.id === "active";
                const label = `${entryCategoryName(entry, categories)} · ${entry.title}`;
                return (
                  <button key={entry.id} type="button" disabled={running} data-running={running}
                    className="day-timeline__block"
                    style={{ left: `${(from - hour * 60) / 60 * 100}%`, width: `${(to - from) / 60 * 100}%`, backgroundColor: entryColor(entry, categories) }}
                    title={running ? `${label} · 측정 중` : label}
                    aria-label={running ? `${label} (측정 중)` : `${label} 수정`}
                    onClick={() => setEditing(entry)} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {loaded && !all.length ? <p className="text-xs text-ui-muted">Todo의 ▶ 버튼으로 측정하거나 “기록 추가”로 직접 입력할 수 있습니다.</p> : null}

      {editing ? (
        <TimeEntryModal entry={editing === "new" ? undefined : editing} categories={categories}
          defaultStart={defaults.start} defaultEnd={defaults.end}
          onClose={() => setEditing(null)} onCreate={create} onUpdate={update} onDelete={remove} />
      ) : null}
    </section>
  );
}
