import { useState } from "react";
import { GoalForm } from "../components/goal/GoalForm";
import { GoalList } from "../components/goal/GoalList";
import type { Goal, GoalType } from "../types/goal";

const tabs: Array<{ id: GoalType; label: string }> = [
  { id: "DAILY", label: "일간 목표" },
  { id: "WEEKLY", label: "주간 목표" },
  { id: "MONTHLY", label: "월간 목표" },
];

type GoalsPageProps = {
  goals: Goal[];
  onAdd: (input: Partial<Goal> & { title: string }) => void;
  onUpdate: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function GoalsPage({ goals, onAdd, onUpdate, onToggle, onDelete }: GoalsPageProps) {
  const [activeType, setActiveType] = useState<GoalType>("DAILY");
  const filteredGoals = goals.filter((goal) => goal.type === activeType);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">목표</h2>
        <p className="mt-2 text-sm text-ink-400">일간, 주간, 월간 목표를 기간별로 관리합니다.</p>
      </section>
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={activeType === tab.id ? "btn-primary min-w-28" : "btn-secondary min-w-28"} onClick={() => setActiveType(tab.id)}>
            {tab.label}
          </button>
        ))}
      </div>
      <GoalForm activeType={activeType} onAdd={onAdd} />
      <GoalList goals={filteredGoals} onUpdate={onUpdate} onToggle={onToggle} onDelete={onDelete} />
    </div>
  );
}
