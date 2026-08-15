import { StatCard } from "../components/common/StatCard";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Memo } from "../types/memo";

type SettingsPageProps = {
  categories: Category[];
  stats: { total: number; completedTotal: number; archivedTotal: number };
  goals: Goal[];
  memos: Memo[];
  apiStatus?: "online" | "offline";
};

export function SettingsPage({
  categories,
  stats,
  goals,
  memos,
  apiStatus = "online",
}: SettingsPageProps) {
  const connected = apiStatus === "online";

  return (
    <div className="max-w-5xl space-y-6">
      <section>
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">앱 정보</h2>
          <p className="mt-2 text-sm text-ink-400">앱 연결 상태와 저장된 데이터 현황을 확인합니다.</p>
        </div>
      </section>

      <section className="app-card p-4 sm:p-5" aria-labelledby="operation-info-title">
        <div className="flex flex-col gap-3 border-b border-ink-700 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 id="operation-info-title" className="text-base font-bold text-ink-100">운영 정보</h3>
            <p className="mt-1 text-xs text-ink-400">개인 플래너의 고정 운영 기준입니다.</p>
          </div>
          <div
            className={`inline-flex min-h-9 items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs font-semibold ${
              connected
                ? "border-success/40 bg-success/10 text-emerald-100"
                : "border-danger/50 bg-danger/10 text-red-100"
            }`}
            role="status"
          >
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-success" : "bg-danger"}`} aria-hidden="true" />
            {connected ? "Cloudflare D1 연결됨" : "Cloudflare D1 연결 확인 필요"}
          </div>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-ink-700/80 bg-ink-950/40 p-3">
            <dt className="text-xs font-semibold text-ink-500">사용 모드</dt>
            <dd className="mt-1 text-sm font-bold text-ink-100">단일 사용자</dd>
          </div>
          <div className="rounded-lg border border-ink-700/80 bg-ink-950/40 p-3">
            <dt className="text-xs font-semibold text-ink-500">저장소</dt>
            <dd className="mt-1 text-sm font-bold text-ink-100">Cloudflare D1</dd>
          </div>
          <div className="rounded-lg border border-ink-700/80 bg-ink-950/40 p-3">
            <dt className="text-xs font-semibold text-ink-500">하루 시작 시각</dt>
            <dd className="mt-1 text-sm font-bold text-ink-100">오전 3시</dd>
          </div>
          <div className="rounded-lg border border-ink-700/80 bg-ink-950/40 p-3">
            <dt className="text-xs font-semibold text-ink-500">Discord 오늘 미완료 Todo 알림 예약</dt>
            <dd className="mt-1 text-sm font-bold text-ink-100">매일 오후 9시</dd>
            <p className="mt-1 text-xs text-ink-400">오늘 일정으로 표시되는 미완료 Todo만 알림 대상입니다.</p>
          </div>
        </dl>
      </section>

      <section aria-labelledby="data-summary-title">
        <h3 id="data-summary-title" className="mb-3 text-base font-bold text-ink-100">저장된 데이터</h3>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Todo" value={stats.total} description={`완료 ${stats.completedTotal} · 보관 ${stats.archivedTotal}`} />
          <StatCard title="카테고리" value={categories.length} />
          <StatCard title="메모" value={memos.length} />
          <StatCard title="목표" value={goals.length} />
        </div>
      </section>
    </div>
  );
}
