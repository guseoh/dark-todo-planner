import { useMemo, useState } from "react";
import { CalendarCheck, FolderKanban, Inbox, ListTodo, Plus, Search, StickyNote } from "lucide-react";
import type { Memo } from "../../types/memo";
import type { Project } from "../../types/project";
import type { Todo } from "../../types/todo";
import type { AppView } from "../layout/Sidebar";
import { Modal } from "./Modal";

type CommandPaletteProps = {
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onQuickAdd: () => void;
  todos: Todo[];
  memos: Memo[];
  projects: Project[];
};

type Result = {
  id: string;
  label: string;
  detail: string;
  view?: AppView;
  action?: "quick-add";
  kind: "이동" | "Todo" | "메모" | "프로젝트" | "명령";
};

const navigation: Result[] = [
  { id: "nav-today", label: "오늘", detail: "오늘 실행할 Todo", view: "today", kind: "이동" },
  { id: "nav-inbox", label: "Inbox", detail: "아직 분류하지 않은 Todo", view: "inbox", kind: "이동" },
  { id: "nav-projects", label: "프로젝트", detail: "프로젝트와 Kanban", view: "projects", kind: "이동" },
  { id: "nav-all", label: "전체 Todo", detail: "모든 Todo 검색과 관리", view: "all", kind: "이동" },
  { id: "nav-memo", label: "메모", detail: "메모 검색과 작성", view: "memo", kind: "이동" },
  { id: "quick-add", label: "빠른 Todo 추가", detail: "Ctrl+Shift+K", action: "quick-add", kind: "명령" },
];

export function CommandPalette({ onClose, onNavigate, onQuickAdd, todos, memos, projects }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase("ko");
    if (!keyword) return navigation;

    const matches: Result[] = [];
    for (const item of navigation) {
      if (`${item.label} ${item.detail}`.toLocaleLowerCase("ko").includes(keyword)) matches.push(item);
    }
    for (const todo of todos) {
      const haystack = `${todo.title} ${todo.memo || ""} ${(todo.tags || []).join(" ")} ${todo.category?.name || ""}`.toLocaleLowerCase("ko");
      if (haystack.includes(keyword)) matches.push({ id: `todo-${todo.id}`, label: todo.title, detail: todo.dueDate ? `마감 ${todo.dueDate}` : todo.date, view: "all", kind: "Todo" });
    }
    for (const memo of memos) {
      const title = memo.title?.trim() || memo.content.split("\n").find((line) => line.trim())?.trim() || "제목 없는 메모";
      if (`${title} ${memo.content}`.toLocaleLowerCase("ko").includes(keyword)) matches.push({ id: `memo-${memo.id}`, label: title, detail: "메모에서 열기", view: "memo", kind: "메모" });
    }
    for (const project of projects) {
      if (`${project.name} ${project.description || ""}`.toLocaleLowerCase("ko").includes(keyword)) matches.push({ id: `project-${project.id}`, label: project.name, detail: project.archived ? "보관된 프로젝트" : "프로젝트에서 열기", view: "projects", kind: "프로젝트" });
    }
    return matches.slice(0, 14);
  }, [memos, projects, query, todos]);

  const run = (result: Result) => {
    onClose();
    if (result.action === "quick-add") {
      onQuickAdd();
      return;
    }
    if (result.view) onNavigate(result.view);
  };

  return (
    <Modal title="검색 및 명령" description="Todo, 메모, 프로젝트를 한 번에 찾거나 화면 이동 명령을 실행합니다. Ctrl+K로 열 수 있습니다." onClose={onClose} size="lg">
      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" size={17} />
          <input data-modal-initial-focus className="field pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Todo, 메모, 프로젝트 검색" />
        </label>
        <div className="max-h-[min(60vh,32rem)] space-y-1 overflow-y-auto pr-1">
          {results.length ? results.map((result) => {
            const Icon = result.action === "quick-add" ? Plus : result.kind === "Todo" ? ListTodo : result.kind === "메모" ? StickyNote : result.kind === "프로젝트" ? FolderKanban : result.view === "inbox" ? Inbox : CalendarCheck;
            return (
              <button key={result.id} type="button" onClick={() => run(result)} className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:border-ink-700 hover:bg-ink-900">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-950 text-ink-400"><Icon size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-100">{result.label}</span><span className="mt-0.5 block truncate text-xs text-ink-500">{result.detail}</span></span>
                <span className="shrink-0 rounded-full border border-ink-700 px-2 py-0.5 text-[10px] font-semibold text-ink-400">{result.kind}</span>
              </button>
            );
          }) : <p className="py-8 text-center text-sm text-ink-500">검색 결과가 없습니다.</p>}
        </div>
      </div>
    </Modal>
  );
}
