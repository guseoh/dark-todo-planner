import { useState } from "react";
import { CheckCheck, CircleDot, CopyPlus, ListTodo, MoveRight, TrendingUp } from "lucide-react";
import { formatKoreanDate, todayKey } from "../lib/date";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import type { Todo, TodoInput } from "../types/todo";
import { isDayStatusGoal } from "../lib/goals";
import { StatCard } from "../components/common/StatCard";
import { EmptyState } from "../components/common/EmptyState";
import { ProgressBar } from "../components/common/ProgressBar";
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
    weekRate: number;
  };
  onAdd: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  categories?: Category[];
  goals?: Goal[];
  onAddGoal: (input: Partial<Goal> & { title: string }) => void;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => void;
  onToggleGoal: (id: string) => void;
  onDeleteGoal: (id: string) => void;
  onAddCategory: (input: { name: string; description?: string; color?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  yesterdayActiveCount: number;
  onBringYesterdayTodos: (mode: "copy" | "move") => Promise<{ total: number; imported: number; skipped: number; mode: "copy" | "move" }>;
};

export function TodayPage({
  todayTodos,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  categories = [],
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  yesterdayActiveCount,
  onBringYesterdayTodos,
}: TodayPageProps) {
  const [importMessage, setImportMessage] = useState("");
  const today = todayKey();
  const todayGoals = goals.filter((goal) => goal.type === "DAILY" && !isDayStatusGoal(goal) && (goal.targetDate === today || goal.dueDate === today));
  const categorySummaries = [
    ...categories.map((category) => {
      const categoryTodos = todayTodos.filter((todo) => todo.categoryId === category.id);
      const completed = categoryTodos.filter((todo) => todo.completed).length;
      return {
        id: category.id,
        name: category.name,
        color: category.color || "#6366f1",
        total: categoryTodos.length,
        completed,
        active: categoryTodos.length - completed,
        rate: categoryTodos.length ? Math.round((completed / categoryTodos.length) * 100) : 0,
      };
    }),
    (() => {
      const uncategorized = todayTodos.filter((todo) => !todo.categoryId);
      const completed = uncategorized.filter((todo) => todo.completed).length;
      return {
        id: "uncategorized",
        name: "미분류",
        color: "#64748b",
        total: uncategorized.length,
        completed,
        active: uncategorized.length - completed,
        rate: uncategorized.length ? Math.round((completed / uncategorized.length) * 100) : 0,
      };
    })(),
  ]
    .filter((summary) => summary.total > 0)
    .sort((a, b) => b.active - a.active)
    .slice(0, 4);

  const bringYesterdayTodos = async (mode: "copy" | "move") => {
    if (!yesterdayActiveCount) return;
    const actionLabel = mode === "copy" ? "복사" : "이동";
    const confirmed = window.confirm(
      `어제 미완료 Todo ${yesterdayActiveCount}개를 오늘로 ${actionLabel}할까요?\n\n이미 오늘 같은 제목과 카테고리로 등록된 Todo는 건너뜁니다.`,
    );
    if (!confirmed) return;
    const result = await onBringYesterdayTodos(mode);
    const skipped = result.skipped ? `, 중복 ${result.skipped}개 제외` : "";
    setImportMessage(`${actionLabel} ${result.imported}개 완료${skipped}`);
  };

  return (
    <div className="space-y-4">
      <section>
        <p className="text-sm text-ink-400">{formatKoreanDate(today, "yyyy년 M월 d일 EEEE")} · 오전 3시 기준</p>
        <h2 className="mt-1 text-2xl font-bold text-ink-100">오늘</h2>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="오늘 완료율" value={`${stats.todayRate}%`} description={`${stats.todayCompleted}/${stats.todayTotal} 완료`} icon={<CheckCheck size={19} />} progress={stats.todayRate} />
        <StatCard title="남은 Todo" value={stats.todayActive} description="오늘 처리할 항목" icon={<ListTodo size={19} />} />
        <StatCard title="이번 주 완료율" value={`${stats.weekRate}%`} description="이번 주 Todo 기준" icon={<TrendingUp size={19} />} progress={stats.weekRate} />
        <StatCard title="오늘 목표" value={`${todayGoals.filter((goal) => goal.completed).length}/${todayGoals.length}`} description="완료 / 전체" icon={<CircleDot size={19} />} />
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

      <section className="app-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-ink-100">어제 미완료 가져오기</h3>
          <p className="mt-1 text-xs text-ink-500">
            오전 3시 기준 어제 남은 Todo {yesterdayActiveCount}개를 오늘로 가져올 수 있습니다.
          </p>
          {importMessage ? <p className="mt-2 text-xs font-semibold text-emerald-200">{importMessage}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary min-h-10 px-3 py-2 text-sm"
            onClick={() => bringYesterdayTodos("copy")}
            disabled={!yesterdayActiveCount}
          >
            <CopyPlus size={15} />
            복사하기
          </button>
          <button
            type="button"
            className="btn-secondary min-h-10 px-3 py-2 text-sm"
            onClick={() => bringYesterdayTodos("move")}
            disabled={!yesterdayActiveCount}
          >
            <MoveRight size={15} />
            이동하기
          </button>
        </div>
      </section>

      <TodoForm onAdd={onAdd} defaultDate={today} compact submitLabel="오늘 추가" categories={categories} />

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink-100">카테고리별 오늘 진행 현황</h3>
          <span className="text-xs text-ink-500">{todayTodos.length}개 Todo</span>
        </div>
        {categorySummaries.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {categorySummaries.map((summary) => (
              <article key={summary.id} className="app-card p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: summary.color }} aria-hidden="true" />
                      <h3 className="truncate text-sm font-semibold text-ink-100">{summary.name}</h3>
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-500">미완료 {summary.active}개</p>
                  </div>
                  <span className="rounded-full border border-ink-700 bg-ink-950/70 px-2 py-0.5 text-xs text-ink-300">
                    {summary.completed}/{summary.total}
                  </span>
                </div>
                <ProgressBar value={summary.rate} label={`${summary.rate}%`} />
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="오늘 등록된 카테고리 Todo가 없습니다." description="빠른 추가나 카테고리 안의 하위 Todo 추가를 사용해보세요." />
        )}
      </section>

      <GroupedTodoList
        todos={todayTodos}
        categories={categories}
        onAddTodo={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
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
