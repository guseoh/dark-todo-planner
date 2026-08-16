import { useState, type ComponentProps } from "react";
import { Clock3, ListChecks } from "lucide-react";
import { TimePlanningPanel } from "../components/planning/TimePlanningPanel";
import type { FocusSession, FocusSessionInput, TimeBlock, TimeBlockInput, TimerSettings, TimerSettingsInput } from "../types/time";
import { PlanningPage } from "./PlanningPage";

type PlanningHubPageProps = ComponentProps<typeof PlanningPage> & {
  focusSessions: FocusSession[];
  timeBlocks: TimeBlock[];
  timerSettings: TimerSettings;
  onAddFocusSession: (input: FocusSessionInput) => Promise<FocusSession | undefined>;
  onSaveTimerSettings: (input: TimerSettingsInput) => Promise<TimerSettings | undefined>;
  onAddTimeBlock: (input: TimeBlockInput) => Promise<TimeBlock | undefined>;
  onUpdateTimeBlock: (id: string, input: TimeBlockInput) => Promise<TimeBlock | undefined>;
  onDeleteTimeBlock: (id: string) => Promise<boolean>;
};

export function PlanningHubPage({
  focusSessions,
  timeBlocks,
  timerSettings,
  onAddFocusSession,
  onSaveTimerSettings,
  onAddTimeBlock,
  onUpdateTimeBlock,
  onDeleteTimeBlock,
  ...planningProps
}: PlanningHubPageProps) {
  const [mode, setMode] = useState<"planning" | "time">("planning");

  const modeButtonClass = (active: boolean) =>
    `relative flex min-h-9 items-center gap-2 rounded-md px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 ${
      active
        ? "bg-ink-800 text-ink-100 ring-1 ring-inset ring-ink-700/80"
        : "text-ink-400 hover:bg-ink-800/70 hover:text-ink-100"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border border-ink-700/70 bg-ink-950/45 p-1">
          <button
            type="button"
            className={modeButtonClass(mode === "planning")}
            onClick={() => setMode("planning")}
            aria-pressed={mode === "planning"}
          >
            {mode === "planning" ? <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent-500" /> : null}
            <ListChecks size={15} />
            계획·리뷰
          </button>
          <button
            type="button"
            className={modeButtonClass(mode === "time")}
            onClick={() => setMode("time")}
            aria-pressed={mode === "time"}
          >
            {mode === "time" ? <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent-500" /> : null}
            <Clock3 size={15} />
            시간 계획
          </button>
        </div>
      </div>

      {mode === "planning" ? (
        <PlanningPage {...planningProps} />
      ) : (
        <div className="space-y-5">
          <section>
            <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">시간 계획</h2>
            <p className="mt-2 text-sm text-ink-400">Time Block으로 시간을 예약하고 Focus Timer의 실제 집중 기록과 비교합니다.</p>
          </section>
          <TimePlanningPanel
            todos={planningProps.todos}
            focusSessions={focusSessions}
            timeBlocks={timeBlocks}
            timerSettings={timerSettings}
            onAddFocusSession={onAddFocusSession}
            onSaveTimerSettings={onSaveTimerSettings}
            onAddTimeBlock={onAddTimeBlock}
            onUpdateTimeBlock={onUpdateTimeBlock}
            onDeleteTimeBlock={onDeleteTimeBlock}
          />
        </div>
      )}
    </div>
  );
}
