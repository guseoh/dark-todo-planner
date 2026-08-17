import { addDays, differenceInCalendarDays } from "date-fns";
import { CalendarDays, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { parseDateKey, todayKey, toDateKey } from "../../lib/date";

const presetButtonClass = "btn-secondary min-h-9 px-3 py-1.5 text-xs";

export function CalendarExportCard() {
  const initialFrom = todayKey();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(toDateKey(addDays(parseDateKey(initialFrom), 89)));

  const validation = useMemo(() => {
    if (!from || !to) return { valid: false, message: "시작일과 종료일을 지정해 주세요.", days: 0 };
    const days = differenceInCalendarDays(parseDateKey(to), parseDateKey(from)) + 1;
    if (days <= 0) return { valid: false, message: "종료일은 시작일보다 빠를 수 없습니다.", days };
    if (days > 366) return { valid: false, message: "한 번에 최대 366일까지 내보낼 수 있습니다.", days };
    return { valid: true, message: `${days}일 범위를 내보냅니다.`, days };
  }, [from, to]);

  const applyPreset = (days: number) => {
    const start = todayKey();
    setFrom(start);
    setTo(toDateKey(addDays(parseDateKey(start), days - 1)));
  };

  const href = validation.valid
    ? `/api/calendar/export.ics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    : "";

  return (
    <section className="app-card p-4 sm:p-5" aria-labelledby="calendar-export-title">
      <div className="flex items-center gap-2">
        <CalendarDays size={18} className="text-accent-300" />
        <h3 id="calendar-export-title" className="text-base font-bold text-ink-100">Calendar Export</h3>
      </div>
      <p className="mt-1 text-xs text-ink-400">Scheduled Todo와 시간 블록을 ICS 파일로 내려받아 Google Calendar, Apple Calendar, Outlook 등에 가져올 수 있습니다.</p>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="Calendar 내보내기 기간 프리셋">
        <button type="button" className={presetButtonClass} onClick={() => applyPreset(30)}>30일</button>
        <button type="button" className={presetButtonClass} onClick={() => applyPreset(90)}>90일</button>
        <button type="button" className={presetButtonClass} onClick={() => applyPreset(365)}>1년</button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm text-ink-400">시작일<input className="field" type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="space-y-1 text-sm text-ink-400">종료일<input className="field" type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
      </div>

      <div className="mt-3 rounded-lg border border-ink-800/70 bg-ink-950/25 px-3 py-2 text-xs text-ink-400">
        시간 블록에 연결된 Todo는 시간 일정으로 내보내고, 연결된 시간 블록이 없는 Scheduled Todo는 종일 일정으로 내보냅니다. 완료·보관 Todo는 제외합니다.
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-xs ${validation.valid ? "text-ink-500" : "font-semibold text-red-200"}`} role={validation.valid ? undefined : "alert"}>{validation.message}</p>
        {validation.valid ? (
          <a className="btn-primary min-h-10" href={href} download>
            <Download size={16} />ICS 다운로드
          </a>
        ) : (
          <button type="button" className="btn-primary min-h-10" disabled><Download size={16} />ICS 다운로드</button>
        )}
      </div>
    </section>
  );
}
