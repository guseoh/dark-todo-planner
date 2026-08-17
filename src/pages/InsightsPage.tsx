import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays } from "date-fns";
import { BarChart3, Clock3, Flame, ListChecks, RefreshCw, TimerReset } from "lucide-react";
import { EstimateAccuracyPanel } from "../components/insights/EstimateAccuracyPanel";
import { ProgressBar } from "../components/common/ProgressBar";
import { api } from "../lib/api/client";
import { formatKoreanDate, parseDateKey, todayKey, toDateKey } from "../lib/date";
import { buildInsightsSnapshot, formatInsightMinutes } from "../lib/insights";
import type { Project, ProjectStatus } from "../types/project";
import type { FocusSession, TimeBlock } from "../types/time";
import type { Todo } from "../types/todo";

type InsightsPageProps = {
  todos: Todo[];
  projects: Project[];
};

type PeriodDays = 7 | 30;

const projectStatusLabel: Record<ProjectStatus, string> = {
  PLANNING: "계획",
  ACTIVE: "진행 중",
  ON_HOLD: "보류",
  DONE: "완료",
};

function MetricCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-lg border border-ink-700/60 bg-ink-900/55 px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-400">{icon}<span>{label}</span></div>
      <p className="mt-2 text-xl font-bold tracking-tight text-ink-100">{value}</p>
      <p className="mt-1 text-[11px] leading-4 text-ink-500">{detail}</p>
    </article>
  );
}

export function InsightsPage({ todos, projects }: InsightsPageProps) {
  const [periodDays, setPeriodDays] = useState<PeriodDays>(7);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = todayKey();
  const from = useMemo(() => toDateKey(addDays(parseDateKey(today), -(periodDays - 1))), [periodDays, today]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [focusResult, blockResult] = await Promise.all([
        api<{ focusSessions: FocusSession[] }>(`/api/focus-sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(today)}`),
        api<{ timeBlocks: TimeBlock[] }>(`/api/time-blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(today)}`),
      ]);
      setFocusSessions(focusResult.focusSessions);
      setTimeBlocks(blockResult.timeBlocks);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "집중 및 시간 계획 기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [from, today]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  const summary = useMemo(() => buildInsightsSnapshot({
    todos,
    projects,
    focusSessions,
    timeBlocks,
    from,
    to: today,
    today,
  }), [focusSessions, from, projects, timeBlocks, today, todos]);

  const visibleProjects = summary.projects.filter((project) => project.total > 0).slice(0, 8);
  const recentDaily = summary.daily.slice(-7).reverse();

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink-100">인사이트</h1>
            {loading ? <span className="text-[11px] text-ink-500">시간 기록 갱신 중...</span> : null}
          </div>
          <p className="mt-1 text-xs text-ink-500">{formatKoreanDate(from, "M월 d일")} ~ {formatKoreanDate(today, "M월 d일")} · Todo 계획일 기준</p>
        </div>
        <div className="inline-flex self-start rounded-md border border-ink-700/65 bg-ink-950/55 p-1 sm:self-auto" aria-label="인사이트 기간">
          {([7, 30] as const).map((days) => (
            <button key={days} type="button" onClick={() => setPeriodDays(days)} className={`min-h-8 rounded px-3 text-xs font-semibold transition ${periodDays === days ? "bg-accent-500/15 text-accent-200" : "text-ink-500 hover:bg-ink-800 hover:text-ink-200"}`} aria-pressed={periodDays === days}>{days}일</button>
          ))}
        </div>
      </header>

      {error ? (
        <div className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/[0.05] px-3 py-2.5 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between">
          <span>{error} Todo 통계는 계속 표시합니다.</span>
          <button type="button" className="btn-secondary min-h-8 shrink-0 px-2.5 text-xs" onClick={() => void loadHistory()}><RefreshCw size={13} />다시 불러오기</button>
        </div>
      ) : null}

      <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label="기간 요약">
        <MetricCard icon={<BarChart3 size={14} />} label={`${periodDays}일 완료율`} value={summary.periodTodoTotal ? `${summary.completionRate}%` : "—"} detail={summary.periodTodoTotal ? `완료 ${summary.periodTodoCompleted} / ${summary.periodTodoTotal}` : "기간에 계획된 Todo가 없습니다."} />
        <MetricCard icon={<ListChecks size={14} />} label="현재 밀린 Todo" value={`${summary.overdueTotal}개`} detail="오늘 이전 실행일의 현재 미완료 Todo" />
        <MetricCard icon={<Clock3 size={14} />} label={`${periodDays}일 예상 작업량`} value={formatInsightMinutes(summary.estimatedMinutes)} detail={`예상 시간 입력 ${summary.estimatedTodoCount} / ${summary.periodTodoTotal}개 Todo`} />
        <MetricCard icon={<Flame size={14} />} label={`${periodDays}일 실제 집중`} value={formatInsightMinutes(summary.focusMinutes)} detail={`완료한 집중 세션 ${summary.focusSessionCount}회`} />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <section className="rounded-lg border border-ink-700/60 bg-ink-900/45 p-3.5">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-ink-100">프로젝트 진행량</h2>
              <p className="mt-0.5 text-[11px] text-ink-500">활성 프로젝트 · 연결된 전체 Todo 기준</p>
            </div>
            <span className="text-[11px] text-ink-500">최대 8개</span>
          </div>
          {visibleProjects.length ? (
            <div className="space-y-2.5">
              {visibleProjects.map((project) => (
                <article key={project.id} className="rounded-md border border-ink-800/75 bg-ink-950/25 px-3 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" style={project.color ? { backgroundColor: project.color } : undefined} aria-hidden="true" />
                      <span className="truncate text-sm font-semibold text-ink-100">{project.name}</span>
                      <span className="shrink-0 text-[10px] text-ink-500">{projectStatusLabel[project.status]}</span>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ink-300">{project.completed}/{project.total}</span>
                  </div>
                  <div className="mt-2"><ProgressBar value={project.completionRate} empty={project.total === 0} emptyLabel="Todo 없음" /></div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-500">
                    <span>완료율 {project.completionRate}%</span>
                    {project.overdue ? <span className="font-semibold text-amber-200">밀림 {project.overdue}개</span> : <span>밀림 없음</span>}
                    {project.remainingEstimateMinutes ? <span>남은 예상 {formatInsightMinutes(project.remainingEstimateMinutes)}</span> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : <p className="rounded-md border border-dashed border-ink-700/65 px-3 py-6 text-center text-sm text-ink-500">Todo가 연결된 활성 프로젝트가 없습니다.</p>}
        </section>

        <section className="rounded-lg border border-ink-700/60 bg-ink-900/45 p-3.5">
          <div className="flex items-center gap-2">
            <TimerReset size={15} className="text-ink-400" />
            <h2 className="text-sm font-bold text-ink-100">계획 대비 실제 집중</h2>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-ink-500">시간 블록의 계획 시간과 완료된 FOCUS 세션 시간을 비교합니다.</p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-ink-950/45 px-3 py-2.5"><p className="text-[10px] font-semibold text-ink-500">계획</p><p className="mt-1 text-base font-bold text-ink-100">{formatInsightMinutes(summary.plannedMinutes)}</p></div>
            <div className="rounded-md bg-ink-950/45 px-3 py-2.5"><p className="text-[10px] font-semibold text-ink-500">실제 집중</p><p className="mt-1 text-base font-bold text-ink-100">{formatInsightMinutes(summary.focusMinutes)}</p></div>
          </div>
          <div className="mt-3"><ProgressBar label="계획 대비 집중" value={summary.focusVsPlanRate || 0} empty={summary.plannedMinutes === 0} emptyLabel="시간 블록 계획 없음" /></div>
          <div className="mt-3 border-t border-ink-800/80 pt-3 text-[11px] leading-5 text-ink-500">
            <p>시간 블록 {summary.completedTimeBlockCount}/{summary.timeBlockCount}개 완료</p>
            <p>{summary.plannedMinutes ? `집중 시간은 계획 시간의 ${summary.focusVsPlanRate}%입니다.` : "시간 블록을 계획하면 실제 집중 시간과 비교할 수 있습니다."}</p>
          </div>
        </section>
      </div>

      <EstimateAccuracyPanel accuracy={summary.estimateAccuracy} />

      <section className="rounded-lg border border-ink-700/60 bg-ink-900/45 p-3.5">
        <div className="mb-3">
          <h2 className="text-sm font-bold text-ink-100">최근 7일 상세</h2>
          <p className="mt-0.5 text-[11px] text-ink-500">Todo 완료 흐름과 실제 집중 시간을 날짜별로 봅니다.</p>
        </div>
        <div className="space-y-1.5">
          {recentDaily.map((day) => (
            <article key={day.date} className={`grid gap-2 rounded-md border px-3 py-2 sm:grid-cols-[7rem_minmax(0,1fr)_7rem] sm:items-center ${day.date === today ? "border-accent-500/30 bg-accent-500/[0.04]" : "border-ink-800/70 bg-ink-950/20"}`}>
              <div className="flex items-center justify-between gap-2 sm:block">
                <p className="text-xs font-semibold text-ink-300">{formatKoreanDate(day.date, "M/d E")}</p>
                {day.date === today ? <span className="text-[10px] font-semibold text-accent-200">오늘</span> : null}
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] text-ink-500"><span>{day.total ? `${day.completed}/${day.total} 완료` : "Todo 없음"}</span><span>{day.total ? `${day.completionRate}%` : "—"}</span></div>
                <ProgressBar value={day.completionRate} empty={day.total === 0} emptyLabel="계획 없음" />
              </div>
              <p className="text-[11px] text-ink-500 sm:text-right">집중 <span className="font-semibold text-ink-300">{formatInsightMinutes(day.focusMinutes)}</span></p>
            </article>
          ))}
        </div>
      </section>

      <p className="px-1 text-[10px] leading-4 text-ink-600">완료율은 Todo의 실제 완료 시각이 아니라 현재 저장된 계획일(date)을 기준으로 계산합니다. ‘현재 밀린 Todo’도 실행일이 오늘보다 이전인 미완료 일정만 집계합니다.</p>
    </div>
  );
}
