import type { KeyboardEvent, ReactNode } from "react";
import type { CalendarMode } from "../lib/viewNavigation";

type CalendarPageProps = {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  children: ReactNode;
};
const modes = [
  { id: "month", label: "월간" },
  { id: "week", label: "주간" },
] as const;

export function CalendarPage({ mode, onModeChange, children }: CalendarPageProps) {
  const selectWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: CalendarMode = event.key === "ArrowLeft" || event.key === "Home" ? "month" : "week";
    onModeChange(next);
    document.getElementById(`calendar-tab-${next}`)?.focus();
  };

  return (
    <div className="page-shell max-w-[1500px]">
      <header className="page-header">
        <div>
          <h1 className="text-[23px] font-semibold tracking-tight text-ui-text">캘린더</h1>
          <p className="mt-1 text-sm text-ink-400">
            {mode === "month" ? "한 달의 작업 분포와 목표를 확인하고 날짜별 Todo를 관리합니다." : "한 주의 작업과 목표를 살펴보고 날짜별 Todo를 관리합니다."}
          </p>
        </div>
        <div role="tablist" aria-label="캘린더 보기" className="page-tabs inline-flex shrink-0 self-start sm:self-auto">
          {modes.map((item) => (
            <button
              key={item.id}
              id={`calendar-tab-${item.id}`}
              type="button"
              role="tab"
              aria-controls="calendar-view-panel"
              aria-selected={mode === item.id}
              tabIndex={mode === item.id ? 0 : -1}
              onClick={() => onModeChange(item.id)}
              onKeyDown={selectWithKeyboard}
              className={`page-tab min-h-9 px-4 ${
                mode === item.id ? "text-ink-100" : "text-ink-400 hover:text-ink-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <section id="calendar-view-panel" role="tabpanel" aria-labelledby={`calendar-tab-${mode}`} tabIndex={0}>
        {children}
      </section>
    </div>
  );
}
