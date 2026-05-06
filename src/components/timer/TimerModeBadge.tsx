import { TIMER_MODE_LABEL, type TimerMode } from "../../types/timer";

const modeClassName: Record<TimerMode, string> = {
  FOCUS: "border-accent-500/45 bg-accent-500/15 text-indigo-100",
  SHORT_BREAK: "border-success/45 bg-success/15 text-emerald-100",
  LONG_BREAK: "border-sky-400/45 bg-sky-500/15 text-sky-100",
};

export function TimerModeBadge({ mode }: { mode: TimerMode }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${modeClassName[mode]}`}>
      {TIMER_MODE_LABEL[mode]}
    </span>
  );
}
