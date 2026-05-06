import type { Goal } from "../../types/goal";
import { EmptyState } from "../common/EmptyState";
import { GoalCard } from "./GoalCard";

export function GoalList({
  goals,
  onUpdate,
  onToggle,
  onDelete,
}: {
  goals: Goal[];
  onUpdate: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!goals.length) {
    return <EmptyState title="등록된 목표가 없습니다." description="가까운 D-Day 목표를 하나 만들어보세요." />;
  }
  return (
    <div className="space-y-3">
      {goals.map((goal) => (
        <GoalCard key={goal.id} goal={goal} onUpdate={onUpdate} onToggle={onToggle} onDelete={onDelete} />
      ))}
    </div>
  );
}
