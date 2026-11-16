import { useMemo, useState } from "react";
import { ExternalLink, Maximize2, RefreshCw } from "lucide-react";
import { useGithubActivity } from "../../hooks/useGithubActivity";
import { activitySummary, getActivityWeeks, localActivityDate } from "../../lib/activity";
import { Modal } from "../common/Modal";
import { ActivityHeatmap } from "./ActivityHeatmap";

const GITHUB_PROFILE = "https://github.com/guseoh";
const COMPACT_WEEKS = 16;

/** GitHub contribution grass as a compact widget; the full 365-day view opens in a dialog. */
export function GithubGrassCard() {
  const { data, loading, error, reload } = useGithubActivity();
  const [open, setOpen] = useState(false);
  const { recentFrom, today } = useMemo(() => {
    const { weeks, to } = getActivityWeeks();
    const first = weeks.slice(-COMPACT_WEEKS)[0].find((day) => day.inside) ?? weeks[0][0];
    return { recentFrom: first.date, today: to };
  }, []);
  const recent = useMemo(() => activitySummary(data?.days ?? [], recentFrom, today), [data, recentFrom, today]);
  const todayCount = data?.days.find((day) => day.date === localActivityDate())?.count;
  const sourceLabel = data?.stale ? "마지막으로 가져온 기록 · 현재 갱신 실패" :
    data?.source === "github-graphql" ? "GitHub GraphQL · 최대 1시간 캐시" : "GitHub 공개 기여 달력 · 최대 1시간 캐시";

  return (
    <section aria-label="GitHub 잔디" className="github-grass-card">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="!mb-0">GitHub 잔디</h2>
        <div className="flex items-center gap-1">
          <button type="button" className="icon-btn h-7 w-7" onClick={() => void reload()} disabled={loading}
            title="다시 불러오기" aria-label="GitHub 잔디 다시 불러오기"><RefreshCw size={13} className={loading ? "animate-spin" : ""} /></button>
          <button type="button" className="icon-btn h-7 w-7" onClick={() => setOpen(true)} disabled={!data}
            title="최근 365일 보기" aria-label="GitHub 잔디 365일 전체 보기"><Maximize2 size={13} /></button>
        </div>
      </div>
      <ActivityHeatmap days={data?.days ?? null} compact weeks={COMPACT_WEEKS} loading={loading} error={error} />
      {data ? (
        <p className="mt-2 text-xs text-ui-muted">
          최근 {COMPACT_WEEKS}주 {recent.total === null ? `${recent.activeDays}일 활동` : `${recent.total.toLocaleString("ko-KR")}회`}
          {typeof todayCount === "number" ? ` · 오늘 ${todayCount}회` : ""}
        </p>
      ) : null}
      {open && data ? (
        <Modal title="GitHub 잔디" description="최근 365일 공개 기여 기록입니다." size="lg" onClose={() => setOpen(false)}>
          <ActivityHeatmap days={data.days} sourceLabel={sourceLabel} />
          <div className="mt-3 flex justify-end">
            <a href={GITHUB_PROFILE} target="_blank" rel="noreferrer" className="btn-secondary text-xs">
              <ExternalLink size={14} />GitHub 프로필
            </a>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
