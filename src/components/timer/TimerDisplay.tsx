import { TimerModeBadge } from "./TimerModeBadge";
import type { TimerMode } from "../../types/timer";

const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
};

export function TimerDisplay({
  mode,
  remainingSeconds,
  selectedTodoTitle,
}: {
  mode: TimerMode;
  remainingSeconds: number;
  selectedTodoTitle?: string;
}) {
  return (
    <section className="app-card flex flex-col items-center p-6 text-center sm:p-8">
      <TimerModeBadge mode={mode} />
      <div className="my-7 flex aspect-square w-full max-w-xs items-center justify-center rounded-full border border-accent-500/35 bg-ink-950/55 shadow-inner">
        <span className="text-5xl font-black tabular-nums tracking-normal text-ink-100 sm:text-6xl">
          {formatSeconds(remainingSeconds)}
        </span>
      </div>
      <div className="min-h-12">
        <p className="text-sm text-ink-400">선택된 Todo</p>
        <p className="mt-1 max-w-md break-words text-base font-semibold text-ink-100">
          {selectedTodoTitle || "선택하지 않음"}
        </p>
      </div>
    </section>
  );
}
