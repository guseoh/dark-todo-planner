import type { Todo } from "../types/todo";
import { TodoList } from "../components/todo/TodoList";

type ArchivePageProps = {
  archivedTodos: Todo[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Omit<Todo, "id" | "createdAt">>) => void;
  onUnarchive: (id: string) => void;
};

export function ArchivePage({ archivedTodos, onToggle, onDelete, onUpdate, onUnarchive }: ArchivePageProps) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-bold text-ink-100 sm:text-3xl">보관함</h2>
        <p className="mt-2 text-sm text-ink-400">완료 후 보관한 Todo를 확인하고 되돌릴 수 있습니다.</p>
      </section>
      <TodoList
        todos={archivedTodos}
        onToggle={onToggle}
        onDelete={onDelete}
        onUpdate={onUpdate}
        onUnarchive={onUnarchive}
        emptyTitle="보관된 Todo가 없습니다."
        emptyDescription="완료한 Todo 카드의 보관 버튼을 눌러 목록을 정리할 수 있습니다."
      />
    </div>
  );
}
