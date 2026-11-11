import { useLayoutEffect, useMemo, useRef } from "react";
import { activitySummary, getActivityWeeks, type ActivityDay, type ActivityMetric } from "../../lib/activity";

type HeatmapProps = {
  title: string;
  subtitle: string;
  sourceLabel: string;
  days: ActivityDay[] | null;
  palette: "github" | "codex";
  metric: ActivityMetric | "contributions";
  loading?: boolean;
  error?: string;
  actions?: React.ReactNode;
};

const formatNumber = (value: number) => value.toLocaleString("ko-KR");

export function ActivityHeatmap({
  title, subtitle, sourceLabel, days, palette, metric, loading = false, error, actions,
}: HeatmapProps) {
  const { from, to, weeks } = useMemo(() => getActivityWeeks(), []);
  const byDate = useMemo(() => new Map((days ?? []).map((day) => [day.date, day])), [days]);
  const summary = useMemo(() => activitySummary(days ?? [], from, to), [days, from, to]);
  const months = weeks.map((week, i) => {
    const first = week.find((day) => day.inside && day.date.endsWith("-01"));
    if (first) return { index: i, label: Number(first.date.slice(5, 7)) + "월" };
    if (i === 0) {
      const firstInside = week.find((day) => day.inside);
      if (firstInside) return { index: i, label: Number(firstInside.date.slice(5, 7)) + "월" };
    }
    return null;
  }).filter((month): month is { index: number; label: string } => month !== null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hasData = Boolean(days && days.length > 0);
  // Start at the most recent weeks; older history is reachable by scrolling left.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollLeft = element.scrollWidth;
  }, [hasData]);

  const unit = metric === "tokens" ? "토큰" : metric === "sessions" ? "세션" : "기여";
  return (
    <section className={"activity-panel activity-panel--" + palette} aria-label={title}>
      <div className="activity-panel__heading">
        <div className="min-w-0">
          <h2 className="activity-panel__title">{title}</h2>
          <p className="activity-panel__subtitle">{subtitle}</p>
        </div>
        {actions ? <div className="activity-panel__actions">{actions}</div> : null}
      </div>
      {error && hasData ? <p role="alert" className="activity-panel__error">{error}</p> : null}
      {hasData ? (
        <>
          <div className="activity-panel__stats">
            <div><span>활동한 날</span><strong>{formatNumber(summary.activeDays)}일</strong></div>
            <div><span>기간 합계</span><strong>{summary.total === null ? "집계 불가" : formatNumber(summary.total) + " " + unit}</strong></div>
            <div><span>기간</span><strong>최근 365일</strong></div>
          </div>
          <div ref={scrollRef} className="activity-heatmap__scroll" role="region" aria-label={title + " 최근 365일 활동 그래프"} tabIndex={0}>
            <div className="activity-heatmap">
              <div className="activity-heatmap__months" aria-hidden="true">
                {months.map(({ index, label }) => (
                  <span key={index} style={{ gridColumnStart: index + 1 }}>{label}</span>
                ))}
              </div>
              <div className="activity-heatmap__body">
                <div className="activity-heatmap__weekdays" aria-hidden="true">
                  <span /><span>월</span><span /><span>수</span><span /><span>금</span><span />
                </div>
                <div className="activity-heatmap__weeks">
                  {weeks.map((week, wi) => (
                    <div className="activity-heatmap__week" key={wi}>
                      {week.map((cell) => {
                        const item = byDate.get(cell.date);
                        const unavailable = cell.inside && !item;
                        const level = !cell.inside || unavailable ? 0 : (item?.level ?? 0);
                        const amount = item?.count;
                        const label = !cell.inside ? "" : cell.date + ": " +
                          (unavailable ? "기록 없음" : amount === null ? "활동 있음 · 정확한 수 미제공" :
                            formatNumber(amount ?? 0) + " " + unit);
                        return <span key={cell.date} role={cell.inside ? "gridcell" : undefined}
                          tabIndex={cell.inside && level > 0 ? 0 : undefined}
                          title={label} aria-label={cell.inside ? label : undefined}
                          className={"activity-heatmap__day " + (!cell.inside ? "activity-heatmap__day--outside" :
                            unavailable ? "activity-heatmap__day--unknown" : "activity-heatmap__day--" + level)} />;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="activity-panel__footer">
            <span>{sourceLabel}</span>
            <div className="activity-heatmap__legend" aria-label="활동 강도: 낮음부터 높음까지">
              <span>적음</span>{[0, 1, 2, 3, 4].map((level) =>
                <i key={level} className={"activity-heatmap__day activity-heatmap__day--" + level} aria-hidden="true" />)}
              <span>많음</span>
            </div>
          </div>
        </>
      ) : (
        <div className="activity-panel__empty" role="status">
          <p>{loading ? "활동 기록을 불러오는 중…" : error || "아직 가져온 활동 기록이 없습니다."}</p>
          {!loading && !error ? <p className="mt-1">가져오기 전에는 활동이 없는 것으로 표시하지 않습니다.</p> : null}
        </div>
      )}
    </section>
  );
}
