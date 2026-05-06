import { GoalForm } from "../components/goal/GoalForm";
import { GoalList } from "../components/goal/GoalList";
import type { Goal } from "../types/goal";

type GoalsPageProps = {
  goals: Goal[];
  onAdd: (input: { title: string; description?: string; dueDate: string; progress: number }) => void;
  onUpdate: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

export function GoalsPage({ goals, onAdd, onUpdate, onToggle, onDelete }: GoalsPageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">목표</h2>
        <p className="mt-2 text-sm text-ink-400">D-Day와 진행률을 보며 중요한 목표를 관리합니다.</p>
      </section>
      <GoalForm onAdd={onAdd} />
      <GoalList goals={goals} onUpdate={onUpdate} onToggle={onToggle} onDelete={onDelete} />
    </div>
  );
}
