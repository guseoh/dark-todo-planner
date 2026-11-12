import type { Project } from "../types/project";
import type { Todo, TodoInput } from "../types/todo";
import type { Category } from "../types/category";
import type { Goal } from "../types/goal";
import { WeeklyView } from "../components/calendar/WeeklyView";

type WeekPageProps = {
  embedded?: boolean;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  todos?: Todo[];
  projects?: Project[];
  getTodosByDate: (date: string) => Todo[];
  onAdd: (todo: TodoInput) => Promise<Todo | undefined> | Todo | undefined;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => Promise<Todo | undefined> | Todo | undefined | void;
  onAddGoal: (input: Partial<Goal> & { title: string }) => Promise<Goal | undefined>;
  onUpdateGoal: (id: string, updates: Partial<Omit<Goal, "id" | "createdAt">>) => Promise<Goal | undefined>;
  onToggleGoal: (id: string) => Promise<boolean>;
  onDeleteGoal: (id: string) => Promise<boolean>;
  categories?: Category[];
  goals?: Goal[];
};

export function WeekPage({
  embedded = false,
  selectedDate,
  onSelectDate,
  todos,
  projects,
  getTodosByDate,
  onAdd,
  onToggle,
  onDelete,
  onUpdate,
  onAddGoal,
  onUpdateGoal,
  onToggleGoal,
  onDeleteGoal,
  categories = [],
  goals = [],
}: WeekPageProps) {
  return (
    <div className="weekly-page mx-auto w-full max-w-[1320px] space-y-4">
      {!embedded ? (
        <section>
          <h2 className="text-2xl font-bold text-ink-100">주간</h2>
          <p className="mt-1 text-sm text-ink-500">한 주의 작업 분포를 보고, 선택한 날짜의 Todo를 집중해서 관리합니다.</p>
        </section>
      ) : null}
      <WeeklyView todos={todos} projects={projects} selectedDate={selectedDate} onSelectDate={onSelectDate}
        getTodosByDate={getTodosByDate}
        onAdd={onAdd}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onAddGoal={onAddGoal}
        onUpdateGoal={onUpdateGoal}
        onToggleGoal={onToggleGoal}
        onDeleteGoal={onDeleteGoal}
        categories={categories}
        goals={goals}
      />
    </div>
  );
}
