import { FormEvent, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2 } from "lucide-react";
import type { Category } from "../types/category";
import type { Todo, TodoInput } from "../types/todo";
import { calculateRate } from "../lib/todo";
import { EmptyState } from "../components/common/EmptyState";
import { ProgressBar } from "../components/common/ProgressBar";
import { TodoForm } from "../components/todo/TodoForm";
import { TodoList } from "../components/todo/TodoList";

const uncategorized: Category = {
  id: "uncategorized",
  userId: "",
  name: "미분류",
  description: "카테고리 없이 추가된 Todo",
  color: "#64748b",
  order: 9999,
  createdAt: "",
  updatedAt: "",
};

export function CategoriesPage({
  categories,
  todos,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddTodo,
  onToggle,
  onDelete,
  onUpdate,
  onArchive,
  onFocusTodo,
}: {
  categories: Category[];
  todos: Todo[];
  onAddCategory: (input: { name: string; description?: string; color?: string }) => Promise<void>;
  onUpdateCategory: (id: string, input: Partial<Category>) => Promise<void>;
  onDeleteCategory: (id: string, mode: "moveTodos" | "deleteTodos") => Promise<void>;
  onAddTodo: (todo: TodoInput) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onArchive: (id: string) => void;
  onFocusTodo: (todo: Todo) => void;
}) {
  const [selectedId, setSelectedId] = useState(categories[0]?.id || "uncategorized");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([selectedId]));
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#6366f1");

  const categoryList = [...categories, uncategorized];
  const selectedCategory = categoryList.find((category) => category.id === selectedId) || uncategorized;
  const selectedTodos = todos.filter((todo) =>
    selectedCategory.id === "uncategorized" ? !todo.categoryId : todo.categoryId === selectedCategory.id,
  );

  const statsByCategory = useMemo(
    () =>
      categoryList.map((category) => {
        const items = todos.filter((todo) => (category.id === "uncategorized" ? !todo.categoryId : todo.categoryId === category.id));
        const oldestActive = [...items].filter((todo) => !todo.completed).sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        const recent = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return {
          category,
          items,
          completed: items.filter((todo) => todo.completed).length,
          active: items.filter((todo) => !todo.completed).length,
          rate: calculateRate(items),
          oldestActive,
          recent,
        };
      }),
    [categoryList, todos],
  );

  const submitCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    await onAddCategory({ name, description, color });
    setName("");
    setDescription("");
    setColor("#6366f1");
  };

  const deleteCategory = async (category: Category) => {
    if (category.id === "uncategorized") return;
    const deleteTodos = window.confirm("카테고리 안의 Todo도 함께 삭제할까요? 취소하면 Todo는 미분류로 이동합니다.");
    const ok = window.confirm(`"${category.name}" 카테고리를 삭제할까요?`);
    if (ok) await onDeleteCategory(category.id, deleteTodos ? "deleteTodos" : "moveTodos");
  };

  const toggleOpen = (id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">카테고리</h2>
        <p className="mt-2 text-sm text-ink-400">JPA 책, Spring 프로젝트처럼 큰 묶음 아래에 하위 Todo를 관리합니다.</p>
      </section>

      <form onSubmit={submitCategory} className="app-card grid gap-3 p-4 md:grid-cols-[1fr_1fr_120px_auto]">
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} placeholder="카테고리 이름" />
        <input className="field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="설명" />
        <input className="field h-11 p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="색상" />
        <button type="submit" className="btn-primary">추가</button>
      </form>

      {!categories.length ? (
        <EmptyState title="아직 카테고리가 없습니다." description="JPA 책, Spring 프로젝트처럼 할 일을 묶어보세요." />
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-3 overflow-x-auto xl:overflow-visible">
          <div className="flex gap-2 xl:block xl:space-y-3">
            {statsByCategory.map(({ category, items, completed, active, rate }) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedId(category.id)}
                className={`app-card min-w-64 p-4 text-left transition hover:border-accent-500/60 xl:w-full ${
                  selectedId === category.id ? "border-accent-500/70 bg-accent-500/10" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-full" style={{ background: category.color || "#64748b" }} />
                      <h3 className="truncate font-bold text-ink-100">{category.name}</h3>
                    </div>
                    {category.description ? <p className="mt-1 truncate text-xs text-ink-400">{category.description}</p> : null}
                  </div>
                  <span className="text-xs text-ink-400">{completed}/{items.length}</span>
                </div>
                <div className="mt-3">
                  <ProgressBar value={rate} />
                </div>
                <p className="mt-2 text-xs text-ink-500">미완료 {active}개</p>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          <section className="app-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: selectedCategory.color || "#64748b" }} />
                  <h3 className="text-xl font-bold text-ink-100">{selectedCategory.name}</h3>
                </div>
                <p className="mt-2 text-sm text-ink-400">{selectedCategory.description || "설명이 없습니다."}</p>
              </div>
              {selectedCategory.id !== "uncategorized" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => {
                      const nextName = window.prompt("카테고리 이름", selectedCategory.name);
                      if (nextName) onUpdateCategory(selectedCategory.id, { ...selectedCategory, name: nextName });
                    }}
                    aria-label="카테고리 수정"
                  >
                    <Pencil size={16} />
                  </button>
                  <button type="button" className="icon-btn hover:border-danger hover:text-red-100" onClick={() => deleteCategory(selectedCategory)} aria-label="카테고리 삭제">
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <TodoForm
            onAdd={onAddTodo}
            compact
            categories={categories}
            defaultCategoryId={selectedCategory.id === "uncategorized" ? "" : selectedCategory.id}
            submitLabel="하위 Todo 추가"
          />

          <section className="space-y-3">
            {statsByCategory.map(({ category, items, completed, rate, oldestActive, recent }) => {
              const isOpen = openIds.has(category.id);
              return (
                <div key={category.id} className="app-card p-4">
                  <button type="button" className="flex w-full items-center justify-between gap-3 text-left" onClick={() => toggleOpen(category.id)}>
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
                      <span className="h-3 w-3 rounded-full" style={{ background: category.color || "#64748b" }} />
                      <span className="truncate font-bold text-ink-100">{category.name}</span>
                    </div>
                    <span className="text-xs text-ink-400">{completed}/{items.length} 완료</span>
                  </button>
                  <div className="mt-3 grid gap-3 text-xs text-ink-500 sm:grid-cols-3">
                    <span>완료율 {rate}%</span>
                    <span>최근 추가: {recent?.title || "-"}</span>
                    <span>오래 미완료: {oldestActive?.title || "-"}</span>
                  </div>
                  {isOpen ? (
                    <div className="mt-4">
                      <TodoList
                        todos={items}
                        onToggle={onToggle}
                        onDelete={onDelete}
                        onUpdate={onUpdate}
                        onArchive={onArchive}
                        onFocusTodo={onFocusTodo}
                        categories={categories}
                        emptyTitle="이 카테고리에 Todo가 없습니다."
                        emptyDescription="첫 번째 하위 Todo를 추가해보세요."
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>

          <TodoList
            todos={selectedTodos}
            onToggle={onToggle}
            onDelete={onDelete}
            onUpdate={onUpdate}
            onArchive={onArchive}
            onFocusTodo={onFocusTodo}
            categories={categories}
            emptyTitle="이 카테고리에 Todo가 없습니다."
            emptyDescription="첫 번째 하위 Todo를 추가해보세요."
            groupByCompletion
          />
        </div>
      </section>
    </div>
  );
}
