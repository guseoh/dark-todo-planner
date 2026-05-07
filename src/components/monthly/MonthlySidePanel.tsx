import { Plus } from "lucide-react";
import { formatKoreanDate, toDateKey } from "../../lib/date";
import type { Category } from "../../types/category";
import type { Goal } from "../../types/goal";
import type { Todo, TodoInput } from "../../types/todo";
import { GoalChecklist } from "../goal/GoalChecklist";
import { GroupedTodoList } from "../todo/GroupedTodoList";
import { TodoForm } from "../todo/TodoForm";

type MonthlySidePanelProps = {
  currentMonth: Date;
  selectedDate: string;
  selectedTodos: Todo[];
  categories: Category[];
  goals: Goal[];
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
};

export function MonthlySidePanel({
  currentMonth,
  selectedDate,
  selectedTodos,
  categories,
  goals,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onFocusTodo,
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}: MonthlySidePanelProps) {
  const monthKey = toDateKey(currentMonth).slice(0, 7);
  const monthlyGoals = goals.filter((goal) => goal.type === "MONTHLY" && (goal.month === monthKey || goal.dueDate?.startsWith(monthKey)));

  return (
    <aside className="scroll-mt-24 space-y-4">
      <GoalChecklist
        title="이번 달 목표"
        subtitle={`${monthKey} · 월간 체크리스트`}
        goals={monthlyGoals}
        type="MONTHLY"
        addDefaults={{ month: monthKey, dueDate: `${monthKey}-01` }}
        placeholder="이번 달 목표"
        emptyTitle="이번 달 목표가 없습니다."
        onAdd={onAddGoal}
        onUpdate={onUpdateGoal}
        onToggle={onToggleGoal}
        onDelete={onDeleteGoal}
      />

      <section className="app-card space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="truncate text-sm font-semibold text-ink-100">선택한 날짜 Todo</h3>
          <span className="shrink-0 rounded-full border border-ink-700 bg-ink-950/70 px-2.5 py-0.5 text-xs text-ink-400">
            {selectedTodos.length}개
          </span>
        </div>
        <GroupedTodoList
          todos={selectedTodos}
          categories={categories}
          onAddTodo={onAdd}
          onToggle={onToggle}
          onDelete={onDelete}
          onUpdate={onUpdate}
          onArchive={onArchive}
          onFocusTodo={onFocusTodo}
          onAddCategory={onAddCategory}
          onUpdateCategory={onUpdateCategory}
          onDeleteCategory={onDeleteCategory}
          emptyTitle="선택한 날짜의 Todo가 없습니다."
          emptyDescription="오른쪽 위 빠른 추가로 바로 등록할 수 있습니다."
          showDate={false}
          defaultDate={selectedDate}
          showCategoryCreator={false}
          layout="list"
        />
      </section>

      <section className="app-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Plus size={17} className="text-accent-400" />
          <h3 className="truncate text-sm font-semibold text-ink-100">
            {formatKoreanDate(selectedDate, "M월 d일 EEEE")}에 추가
          </h3>
        </div>
        <TodoForm onAdd={onAdd} defaultDate={selectedDate} compact categories={categories} />
      </section>
    </aside>
  );
}
