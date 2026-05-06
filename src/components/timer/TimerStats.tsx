import { Clock3, Flame, History, TimerReset } from "lucide-react";
import { StatCard } from "../common/StatCard";

const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
};

export function TimerStats({
  todayMinutes,
  todayCompletedSessions,
  weekMinutes,
  totalMinutes,
}: {
  todayMinutes: number;
  todayCompletedSessions: number;
  weekMinutes: number;
  totalMinutes: number;
}) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard title="오늘 집중 시간" value={formatMinutes(todayMinutes)} icon={<Clock3 size={20} />} />
      <StatCard title="오늘 완료 세션" value={`${todayCompletedSessions}회`} icon={<Flame size={20} />} />
      <StatCard title="이번 주 집중" value={formatMinutes(weekMinutes)} icon={<TimerReset size={20} />} />
      <StatCard title="전체 집중" value={formatMinutes(totalMinutes)} icon={<History size={20} />} />
    </section>
  );
}
