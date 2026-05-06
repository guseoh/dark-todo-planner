import { Bell, BellOff } from "lucide-react";
import { TimerControls } from "../components/timer/TimerControls";
import { TimerDisplay } from "../components/timer/TimerDisplay";
import { TimerModeBadge } from "../components/timer/TimerModeBadge";
import { TimerStats } from "../components/timer/TimerStats";
import { TodoSelector } from "../components/timer/TodoSelector";
import type { Todo } from "../types/todo";
import type { TimerMode, TimerSettings, TimerState } from "../types/timer";

type TimerPageProps = {
  todos: Todo[];
  timer: {
    state: TimerState;
    settings: TimerSettings;
    remainingSeconds: number;
    notice: string;
    start: () => void;
    pause: () => void;
    reset: () => void;
    switchMode: (mode: TimerMode) => void;
    goNextMode: () => void;
    selectTodo: (todo?: { id: string; title: string }) => void;
    requestNotificationPermission: () => void;
  };
  focusStats: {
    todayMinutes: number;
    todayCompletedSessions: number;
    weekMinutes: number;
    totalMinutes: number;
  };
};

export function TimerPage({ todos, timer, focusStats }: TimerPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">타이머</h2>
        <p className="mt-2 text-sm text-ink-400">Todo를 선택하고 집중 세션을 기록합니다.</p>
      </section>

      <TimerStats {...focusStats} />

      {timer.notice ? (
        <div className="rounded-lg border border-accent-500/40 bg-accent-500/10 px-4 py-3 text-sm text-indigo-100">
          {timer.notice}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          <TimerDisplay
            mode={timer.state.mode}
            remainingSeconds={timer.remainingSeconds}
            selectedTodoTitle={timer.state.selectedTodoTitle}
          />
          <TimerControls
            isRunning={timer.state.isRunning}
            onStart={timer.start}
            onPause={timer.pause}
            onReset={timer.reset}
            onNext={timer.goNextMode}
          />
        </div>
        <aside className="space-y-5">
          <TodoSelector todos={todos} selectedTodoId={timer.state.selectedTodoId} onSelect={timer.selectTodo} />
          <section className="app-card p-5">
            <h3 className="text-lg font-bold text-ink-100">모드 전환</h3>
            <div className="mt-4 grid gap-2">
              {(["FOCUS", "SHORT_BREAK", "LONG_BREAK"] as TimerMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className="flex min-h-12 items-center justify-between rounded-lg border border-ink-700 bg-ink-950/45 px-3 transition hover:border-accent-500/60"
                  onClick={() => timer.switchMode(mode)}
                >
                  <TimerModeBadge mode={mode} />
                  {timer.state.mode === mode ? <span className="text-xs text-accent-400">현재</span> : null}
                </button>
              ))}
            </div>
          </section>
          <section className="app-card p-5">
            <div className="flex items-center gap-2">
              {timer.settings.notificationEnabled ? <Bell size={18} className="text-accent-400" /> : <BellOff size={18} className="text-ink-500" />}
              <h3 className="text-lg font-bold text-ink-100">브라우저 알림</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-ink-400">권한이 거부되어도 타이머는 정상 동작합니다.</p>
            <button type="button" className="btn-secondary mt-4 w-full" onClick={timer.requestNotificationPermission}>
              알림 권한 요청
            </button>
          </section>
        </aside>
      </section>
    </div>
  );
}
