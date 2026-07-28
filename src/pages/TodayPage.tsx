import { useState } from "react";
import { CheckCheck, History } from "lucide-react";
import { formatKoreanDate, todayKey } from "../lib/date";
import type { OverdueTodoImportMode, OverdueTodoImportResult } from "../lib/todoRecovery";
import type { Category } from "../types/category";
import type { Todo, TodoInput } from "../types/todo";
import { ProgressBar } from "../components/common/ProgressBar";
import { TodoForm } from "../components/todo/TodoForm";
import { GroupedTodoList } from "../components/todo/GroupedTodoList";
import { OverdueTodoImportModal } from "../components/todo/OverdueTodoImportModal";

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
  onAddCategory: (input: { name: string; description?: string; color?: string; icon?: string }) => void | Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => void | Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => void | Promise<void>;
  onReorderCategories: (ids: string[]) => void | Promise<void>;
  overdueTodos: Todo[];
  onBringOverdueTodos: (
    selectedIds: ReadonlySet<string>,
    mode: OverdueTodoImportMode,
  ) => Promise<OverdueTodoImportResult>;
};

export function TodayPage({
  todayTodos,
  stats,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  categories = [],
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onReorderCategories,
  overdueTodos,
  onBringOverdueTodos,
}: TodayPageProps) {
  const [showOverdueImport, setShowOverdueImport] = useState(false);
  const today = todayKey();
  const oldestOverdueDate = overdueTodos[0]?.date;

  return (
    <div className="space-y-4">
      <section>
        <p className="text-sm text-ink-400">{formatKoreanDate(today, "yyyy년 M월 d일 EEEE")} · 오전 3시 기준</p>
        <h2 className="mt-1 text-2xl font-bold text-ink-100">오늘</h2>
      </section>

      <section className="app-card p-4" aria-labelledby="today-summary-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-accent-300">
                  <CheckCheck size={18} />
                </span>
                <div className="min-w-0">
                  <h3 id="today-summary-title" className="text-sm font-bold text-ink-100">오늘 요약</h3>
                  <p className="text-xs text-ink-500">오늘 Todo 완료율</p>
                </div>
              </div>
              <p className="shrink-0 text-2xl font-bold text-ink-100">{stats.todayRate}%</p>
            </div>
            <ProgressBar value={stats.todayRate} label="오늘 진행률" />
          </div>

          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:w-[28rem]">
            <div className="rounded-lg border border-ink-700/80 bg-ink-950/45 px-3 py-2.5">
              <dt className="text-[11px] font-semibold text-ink-500">완료 / 전체</dt>
              <dd className="mt-1 text-base font-bold text-ink-100">{stats.todayCompleted} / {stats.todayTotal}</dd>
            </div>
            <div className="rounded-lg border border-ink-700/80 bg-ink-950/45 px-3 py-2.5">
              <dt className="text-[11px] font-semibold text-ink-500">남은 Todo</dt>
              <dd className="mt-1 text-base font-bold text-ink-100">{stats.todayActive}개</dd>
            </div>
            <div className="col-span-2 rounded-lg border border-ink-700/80 bg-ink-950/45 px-3 py-2.5 sm:col-span-1">
              <dt className="text-[11px] font-semibold text-ink-500">이번 주 완료율</dt>
              <dd className="mt-1 text-base font-bold text-ink-100">{stats.weekRate}%</dd>
            </div>
          </dl>
        </div>
      </section>

      {overdueTodos.length > 0 ? (
        <section className="app-card flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink-100">미처리 Todo {overdueTodos.length}개</h3>
            <p className="mt-0.5 text-xs text-ink-500">
              가장 오래된 일정: {oldestOverdueDate ? formatKoreanDate(oldestOverdueDate, "M월 d일") : "-"}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary min-h-10 shrink-0 justify-center px-3 py-2 text-sm"
            onClick={() => setShowOverdueImport(true)}
          >
            <History size={15} />
            가져오기
          </button>
        </section>
      ) : null}

      <TodoForm onAdd={onAdd} defaultDate={today} compact submitLabel="오늘 추가" categories={categories} />

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
        onReorderCategories={onReorderCategories}
        emptyTitle="오늘 할 일이 없습니다."
        emptyDescription="새로운 Todo를 추가해보세요."
        showDate={false}
        defaultDate={today}
        includeEmptyCategories
        showCategoryCreator
        sortableCategories
      />

      {showOverdueImport ? (
        <OverdueTodoImportModal
          todos={overdueTodos}
          onImport={onBringOverdueTodos}
          onClose={() => setShowOverdueImport(false)}
        />
      ) : null}
    </div>
  );
}
