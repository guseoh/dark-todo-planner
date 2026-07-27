import { StatCard } from "../components/common/StatCard";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Memo } from "../types/memo";
import type { Reflection } from "../types/reflection";

type SettingsPageProps = {
  categories: Category[];
  stats: { total: number; completedTotal: number; archivedTotal: number };
  reflections: Reflection[];
  goals: Goal[];
  memos: Memo[];
  apiStatus?: "online" | "offline";
};

export function SettingsPage({
  categories,
  stats,
  reflections,
  goals,
  memos,
  apiStatus = "online",
}: SettingsPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <div>
          <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">설정</h2>
          <p className="mt-2 text-sm text-ink-400">앱 상태와 주요 데이터 개수를 확인합니다.</p>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="사용 모드" value="단일 사용자" description={apiStatus === "online" ? "D1 연결됨" : "API 연결 오류"} />
        <StatCard title="Todo" value={stats.total} />
        <StatCard title="카테고리" value={categories.length} />
        <StatCard title="회고 / 메모" value={`${reflections.length}/${memos.length}`} />
        <StatCard title="목표" value={goals.length} />
      </section>
    </div>
  );
}
