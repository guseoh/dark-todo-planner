import { useLayoutEffect, useMemo, useRef } from "react";
import { activitySummary, getActivityWeeks, type ActivityDay } from "../../lib/activity";

type HeatmapProps = {
  days: ActivityDay[] | null;
  /** Compact: only the most recent weeks, no stats/footer, sized for a narrow side rail. */
  compact?: boolean;
  weeks?: number;
  loading?: boolean;
  error?: string;
  sourceLabel?: string;
};

const formatNumber = (value: number) => value.toLocaleString("ko-KR");

export function ActivityHeatmap({ days, compact = false, weeks: weekLimit = 16, loading = false, error, sourceLabel }: HeatmapProps) {
  const calendar = useMemo(() => getActivityWeeks(), []);
  const { from, to } = calendar;
  const weeks = compact ? calendar.weeks.slice(-weekLimit) : calendar.weeks;
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

  if (!hasData) {
    return (
      <div className="activity-panel__empty" role="status">
        <p>{loading ? "활동 기록을 불러오는 중…" : error || "아직 불러온 활동 기록이 없습니다."}</p>
      </div>
    );
  }

  const grid = (
    <div className="activity-heatmap">
      <div className="activity-heatmap__months" aria-hidden="true">
        {months.map(({ index, label }) => (
          <span key={index} style={{ gridColumnStart: index + 1 }}>{label}</span>
        ))}
      </div>
      <div className="activity-heatmap__body">
        {compact ? null : (
          <div className="activity-heatmap__weekdays" aria-hidden="true">
            <span /><span>월</span><span /><span>수</span><span /><span>금</span><span />
          </div>
        )}
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
                    formatNumber(amount ?? 0) + " 기여");
                return <span key={cell.date} role={cell.inside ? "gridcell" : undefined}
                  tabIndex={cell.inside && level > 0 && !compact ? 0 : undefined}
                  title={label} aria-label={cell.inside ? label : undefined}
                  className={"activity-heatmap__day " + (!cell.inside ? "activity-heatmap__day--outside" :
                    unavailable ? "activity-heatmap__day--unknown" : "activity-heatmap__day--" + level)} />;
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (compact) {
    return (
      <div className="activity-panel activity-panel--github activity-panel--compact">
        {error ? <p role="alert" className="activity-panel__error">{error}</p> : null}
        <div className="activity-heatmap__scroll" role="region" aria-label={"GitHub 최근 " + weekLimit + "주 활동 그래프"}>{grid}</div>
      </div>
    );
  }

  return (
    <div className="activity-panel activity-panel--github">
      {error ? <p role="alert" className="activity-panel__error">{error}</p> : null}
      <div className="activity-panel__stats">
        <div><span>활동한 날</span><strong>{formatNumber(summary.activeDays)}일</strong></div>
        <div><span>기간 합계</span><strong>{summary.total === null ? "집계 불가" : formatNumber(summary.total) + " 기여"}</strong></div>
        <div><span>기간</span><strong>최근 365일</strong></div>
      </div>
      <div ref={scrollRef} className="activity-heatmap__scroll" role="region" aria-label="GitHub 최근 365일 활동 그래프" tabIndex={0}>
        {grid}
      </div>
      <div className="activity-panel__footer">
        <span>{sourceLabel}</span>
        <div className="activity-heatmap__legend" aria-label="활동 강도: 낮음부터 높음까지">
          <span>적음</span>{[0, 1, 2, 3, 4].map((level) =>
            <i key={level} className={"activity-heatmap__day activity-heatmap__day--" + level} aria-hidden="true" />)}
          <span>많음</span>
        </div>
      </div>
    </div>
  );
}
