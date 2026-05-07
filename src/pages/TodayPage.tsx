import { CheckCircle2, CircleDot, ListChecks } from "lucide-react";
import { todayKey } from "../lib/date";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Todo, TodoInput } from "../types/todo";
import { isDayStatusGoal } from "../lib/goals";
import { StatCard } from "../components/common/StatCard";
import { GoalChecklist } from "../components/goal/GoalChecklist";
import { TodoForm } from "../components/todo/TodoForm";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";

type TodayPageProps = {
  todayTodos: Todo[];
  stats: {
    todayTotal: number;
    todayCompleted: number;
    todayActive: number;
    todayRate: number;
  };
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  categories?: Category[];
  goals?: Goal[];
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function TodayPage({
  todayTodos,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  categories = [],
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: TodayPageProps) {
  const today = todayKey();
  const todayGoals = goals.filter((goal) => goal.type === "DAILY" && !isDayStatusGoal(goal) && (goal.targetDate === today || goal.dueDate === today));

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">오늘 보기</h2>
        <p className="mt-2 text-sm text-ink-400">오늘 날짜에 등록된 Todo만 모아봅니다.</p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="전체" value={stats.todayTotal} icon={<ListChecks size={20} />} />
        <StatCard title="완료" value={stats.todayCompleted} icon={<CheckCircle2 size={20} />} />
        <StatCard title="미완료" value={stats.todayActive} icon={<CircleDot size={20} />} />
        <StatCard title="완료율" value={`${stats.todayRate}%`} progress={stats.todayRate} />
      </section>

      <GoalChecklist
        title="오늘 목표"
        subtitle="오늘 꼭 챙길 핵심 목표"
        goals={todayGoals}
        type="DAILY"
        addDefaults={{ targetDate: today, dueDate: today }}
        placeholder="오늘 목표"
        emptyTitle="오늘 목표가 없습니다."
        onAdd={onAddGoal}
        onUpdate={onUpdateGoal}
        onToggle={onToggleGoal}
        onDelete={onDeleteGoal}
      />

      <TodoForm onAdd={onAdd} defaultDate={today} compact submitLabel="오늘 추가" categories={categories} />

      <GroupedTodoList
        todos={todayTodos}
        categories={categories}
        onAddTodo={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onArchive={onArchive}
        onAddCategory={onAddCategory}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        emptyTitle="오늘 할 일이 없습니다."
        emptyDescription="새로운 Todo를 추가해보세요."
        showDate={false}
        defaultDate={today}
        includeEmptyCategories
        showCategoryCreator
      />
    </div>
  );
}
