import { Gauge, Scale } from "lucide-react";
import { formatInsightMinutes, type EstimateAccuracyProject, type EstimateAccuracyTodo } from "../../lib/insights";

type EstimateAccuracy = {
  sampleCount: number;
  estimateMinutes: number;
  actualMinutes: number;
  actualVsEstimateRate?: number;
  planningMultiplier?: number;
  todos: EstimateAccuracyTodo[];
  projects: EstimateAccuracyProject[];
};

const signedMinutes = (value: number) => `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatInsightMinutes(Math.abs(value))}`;

export function EstimateAccuracyPanel({ accuracy }: { accuracy: EstimateAccuracy }) {
  return (
    <section className="rounded-lg border border-ink-700/60 bg-ink-900/45 p-3.5" aria-labelledby="estimate-accuracy-title">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Gauge size={15} className="text-ink-400" />
            <h2 id="estimate-accuracy-title" className="text-sm font-bold text-ink-100">예상 시간 정확도</h2>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-ink-500">완료된 Todo 중 예상 시간이 있고, 해당 Todo에 완료된 FOCUS 세션이 연결된 기록만 비교합니다.</p>
        </div>
        <span className="self-start rounded-full border border-ink-700 px-2 py-0.5 text-[11px] font-semibold text-ink-400">표본 {accuracy.sampleCount}개</span>
      </div>

      {!accuracy.sampleCount ? (
        <div className="mt-4 rounded-md border border-dashed border-ink-700/65 px-4 py-7 text-center">
          <p className="text-sm font-semibold text-ink-300">아직 비교할 수 있는 기록이 없습니다.</p>
          <p className="mt-1 text-xs leading-5 text-ink-500">Todo에 예상 시간을 넣고 Focus Timer를 그 Todo와 연결해 완료하면 실제 집중 시간과 비교할 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-md bg-ink-950/45 px-3 py-2.5"><p className="text-[10px] font-semibold text-ink-500">예상 합계</p><p className="mt-1 text-base font-bold text-ink-100">{formatInsightMinutes(accuracy.estimateMinutes)}</p></div>
            <div className="rounded-md bg-ink-950/45 px-3 py-2.5"><p className="text-[10px] font-semibold text-ink-500">실제 집중 합계</p><p className="mt-1 text-base font-bold text-ink-100">{formatInsightMinutes(accuracy.actualMinutes)}</p></div>
            <div className="rounded-md bg-ink-950/45 px-3 py-2.5"><p className="text-[10px] font-semibold text-ink-500">예상 대비 실제</p><p className="mt-1 text-base font-bold text-ink-100">{accuracy.actualVsEstimateRate ?? 0}%</p></div>
          </div>

          <div className={`mt-3 rounded-md border px-3 py-2.5 ${accuracy.planningMultiplier ? "border-accent-500/25 bg-accent-500/[0.05]" : "border-ink-800/80 bg-ink-950/25"}`}>
            <div className="flex items-start gap-2">
              <Scale size={14} className="mt-0.5 shrink-0 text-ink-400" />
              {accuracy.planningMultiplier ? (
                <p className="text-xs leading-5 text-ink-300">최근 표본에서 실제 집중 시간은 예상의 <strong className="text-accent-200">{accuracy.planningMultiplier}배</strong>였습니다. 다음 예상 시간을 잡을 때 참고값으로만 사용하세요.</p>
              ) : (
                <p className="text-xs leading-5 text-ink-500">보정 배수는 표본이 5개 이상 쌓였을 때만 표시합니다. 현재 표본으로 성급하게 계획 기준을 바꾸지 않습니다.</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
            <div>
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-bold text-ink-300">Todo별 비교</h3><span className="text-[10px] text-ink-600">오차 큰 순 · 최대 8개</span></div>
              <div className="space-y-1.5">
                {accuracy.todos.slice(0, 8).map((sample) => (
                  <article key={sample.id} className="rounded-md border border-ink-800/70 bg-ink-950/20 px-3 py-2">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0"><p className="truncate text-xs font-semibold text-ink-200">{sample.title}</p>{sample.projectName ? <p className="mt-0.5 truncate text-[10px] text-ink-600">{sample.projectName}</p> : null}</div>
                      <span className={`shrink-0 text-[11px] font-semibold ${sample.deltaMinutes > 0 ? "text-amber-200" : sample.deltaMinutes < 0 ? "text-emerald-300" : "text-ink-400"}`}>{signedMinutes(sample.deltaMinutes)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-500"><span>예상 {formatInsightMinutes(sample.estimateMinutes)}</span><span>실제 {formatInsightMinutes(sample.actualMinutes)}</span><span>예상 대비 {sample.actualVsEstimateRate}%</span><span>절대 오차 {sample.errorRate}%</span></div>
                  </article>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-bold text-ink-300">프로젝트별 비교</h3><span className="text-[10px] text-ink-600">최대 6개</span></div>
              {accuracy.projects.length ? <div className="space-y-1.5">{accuracy.projects.slice(0, 6).map((project) => (
                <article key={project.id} className="rounded-md border border-ink-800/70 bg-ink-950/20 px-3 py-2">
                  <div className="flex items-center justify-between gap-3"><p className="truncate text-xs font-semibold text-ink-200">{project.name}</p><span className="shrink-0 text-[10px] text-ink-500">표본 {project.sampleCount}</span></div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-500"><span>예상 {formatInsightMinutes(project.estimateMinutes)}</span><span>실제 {formatInsightMinutes(project.actualMinutes)}</span><span>예상 대비 {project.actualVsEstimateRate}%</span><span>오차 {project.errorRate}%</span></div>
                </article>
              ))}</div> : <div className="rounded-md border border-dashed border-ink-700/65 px-3 py-6 text-center text-xs text-ink-500">프로젝트에 연결된 비교 표본이 없습니다.</div>}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
