import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, CalendarCheck, ClipboardList, FileText, FolderKanban, ListTodo, Plus, Search, Square, MoonStar, Settings, StickyNote, Trash2 } from "lucide-react";
import type { Memo } from "../../types/memo";
import type { Project } from "../../types/project";
import type { Todo } from "../../types/todo";
import type { AppView } from "../layout/Sidebar";
import { Modal } from "./Modal";

type CommandPaletteProps = {
  onClose: () => void;
  onNavigate: (view: AppView) => void;
  onQuickAdd: () => void;
  onDayClose: () => void;
  onNewMemo?: () => void;
  onWeek?: () => void;
  onStartTodo?: (id: string) => void;
  onStopTimer?: () => void;
  onOpenItem: (kind: "Todo" | "메모" | "프로젝트", id: string) => void;
  todos: Todo[];
  memos: Memo[];
  projects: Project[];
};

type Result = {
  id: string;
  label: string;
  detail: string;
  view?: AppView;
  targetId?: string;
  action?: "quick-add" | "day-close" | "stop-timer" | "new-memo" | "week" | "start-todo";
  kind: "이동" | "Todo" | "메모" | "프로젝트" | "명령";
};

export const navigation: Result[] = [
  { id: "quick-add", label: "빠른 Todo 추가", detail: "Ctrl+Shift+K", action: "quick-add", kind: "명령" },
  { id: "nav-today", label: "오늘", detail: "오늘 실행할 Todo", view: "today", kind: "이동" },
  { id: "nav-all", label: "전체 할 일", detail: "모든 할 일 검색과 관리", view: "all", kind: "이동" },
  { id: "nav-projects", label: "프로젝트", detail: "프로젝트와 Kanban", view: "projects", kind: "이동" },
  { id: "nav-calendar", label: "캘린더", detail: "월간·주간 일정 보기", view: "calendar", kind: "이동" },
  { id: "nav-memo", label: "메모", detail: "메모 검색과 작성", view: "memo", kind: "이동" },
  { id: "nav-scratchpad", label: "낙서장", detail: "계속 이어 쓰는 개인 메모장", view: "scratchpad", kind: "이동" },
  { id: "nav-settings", label: "설정", detail: "Planner 설정과 내보내기", view: "settings", kind: "이동" },
  { id: "nav-trash", label: "휴지통", detail: "삭제한 항목 확인과 복원", view: "trash", kind: "이동" },
];

const resultIcon = (result: Result) => {
  if (result.action === "quick-add") return Plus;
  if (result.action === "day-close") return MoonStar;
  if (result.action === "stop-timer") return Square;
  if (result.kind === "Todo") return ListTodo;
  if (result.kind === "메모") return StickyNote;
  if (result.kind === "프로젝트" || result.view === "projects") return FolderKanban;
  if (result.view === "memo") return StickyNote;
  if (result.view === "scratchpad") return FileText;
  if (result.view === "calendar") return Calendar;
  if (result.view === "all") return ClipboardList;
  if (result.view === "trash") return Trash2;
  if (result.view === "settings") return Settings;
  return CalendarCheck;
};

export function CommandPalette({ onClose, onNavigate, onQuickAdd, onDayClose, onNewMemo, onWeek, onStartTodo, onStopTimer, onOpenItem, todos, memos, projects }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    const commands: Result[] = [...navigation, { id: "day-close", label: "오늘 정리", detail: "측정 기록 및 하루 회고", action: "day-close", kind: "명령" }];
    if (onStopTimer) commands.unshift({ id: "stop-timer", label: "시간 측정 종료", detail: "현재 측정 중인 작업 저장", action: "stop-timer", kind: "명령" });
    if (onNewMemo) commands.unshift({ id: "new-memo", label: "새 메모 작성", detail: "빈 메모 탭 열기", action: "new-memo", kind: "명령" });
    if (onWeek) commands.push({ id: "week", label: "주간 캘린더", detail: "계획 및 실측 시간", action: "week", kind: "명령" });
    const keyword = query.trim().toLocaleLowerCase("ko");
    if (!keyword) return commands;

    const matches: Result[] = [];
    for (const item of commands) {
      if (`${item.label} ${item.detail}`.toLocaleLowerCase("ko").includes(keyword)) matches.push(item);
    }
    for (const todo of todos) {
      if (onStartTodo && !todo.archived && !todo.completed && `측정 시작 ${todo.title}`.toLocaleLowerCase("ko").includes(keyword)) matches.push({ id: `start-${todo.id}`, label: `측정 시작: ${todo.title}`, detail: "Todo 시간 측정", action: "start-todo", targetId: todo.id, kind: "명령" });
      const haystack = `${todo.title} ${todo.memo || ""} ${todo.category?.name || ""}`.toLocaleLowerCase("ko");
      if (haystack.includes(keyword)) matches.push({ id: `todo-${todo.id}`, label: todo.title, detail: todo.planningState === "SCHEDULED" ? todo.date : "일정 미지정", view: "all", targetId: todo.id, kind: "Todo" });
    }
    for (const memo of memos) {
      const title = memo.title?.trim() || memo.content.split("\n").find((line) => line.trim())?.trim() || "제목 없는 메모";
      if (`${title} ${memo.content}`.toLocaleLowerCase("ko").includes(keyword)) matches.push({ id: `memo-${memo.id}`, label: title, detail: "메모에서 열기", view: "memo", targetId: memo.id, kind: "메모" });
    }
    for (const project of projects) {
      if (`${project.name} ${project.description || ""}`.toLocaleLowerCase("ko").includes(keyword)) matches.push({ id: `project-${project.id}`, label: project.name, detail: project.archived ? "보관된 프로젝트" : "프로젝트에서 열기", view: "projects", targetId: project.id, kind: "프로젝트" });
    }
    return matches.slice(0, 16);
  }, [memos, projects, query, todos, onStopTimer, onNewMemo, onWeek, onStartTodo]);
  useEffect(() => { resultsRef.current?.querySelector<HTMLElement>(`[data-command-index="${Math.min(activeIndex, results.length - 1)}"]`)?.scrollIntoView({ block: "nearest" }); }, [activeIndex, results.length]);

  const run = (result: Result) => {
    onClose();
    if (result.action === "new-memo") { onNewMemo?.(); return; }
    if (result.action === "week") { onWeek?.(); return; }
    if (result.action === "start-todo" && result.targetId) { onStartTodo?.(result.targetId); return; }
    if (result.action === "day-close") { onDayClose(); return; }
    if (result.action === "stop-timer") { onStopTimer?.(); return; }
    if (result.action === "quick-add") {
      onQuickAdd();
      return;
    }
    if (result.targetId && (result.kind === "Todo" || result.kind === "메모" || result.kind === "프로젝트")) {
      onOpenItem(result.kind, result.targetId);
      return;
    }
    if (result.view) onNavigate(result.view);
  };

  return (
    <Modal title="검색 및 명령" description="검색과 화면 이동, 빠른 실행을 한 곳에서 사용합니다. Ctrl+K로 열 수 있습니다." onClose={onClose} size="lg">
      <div className="space-y-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" size={17} />
          <input data-modal-initial-focus className="field pl-10" value={query}
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => results.length ? (index + 1) % results.length : 0); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => results.length ? (index - 1 + results.length) % results.length : 0); }
              if (event.key === "Enter" && results.length) { event.preventDefault(); run(results[Math.min(activeIndex, results.length - 1)]); }
            }}
            aria-describedby="command-keyboard-help"
            placeholder="검색하거나 실행할 명령 입력" />
        </label>
        <p id="command-keyboard-help" className="text-xs text-ink-400">↑ ↓ 이동 · Enter 열기 · Esc 닫기</p>
        <div ref={resultsRef} className="max-h-[min(60vh,32rem)] space-y-1 overflow-y-auto pr-1">
          {results.length ? results.map((result, index) => {
            const Icon = resultIcon(result);
            return (
              <button key={result.id} data-command-index={index} type="button" onClick={() => run(result)} onMouseEnter={() => setActiveIndex(index)}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`flex w-full items-center gap-3 rounded-[3px] border px-3 py-2.5 text-left transition ${index === activeIndex ? "border-ui-focus bg-ui-selected" : "border-transparent hover:border-ui-divider hover:bg-ui-hover"}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[3px] border border-ui-divider bg-transparent text-ui-secondary"><Icon size={16} /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-100">{result.label}</span><span className="mt-0.5 block truncate text-xs text-ink-400">{result.detail}</span></span>
                <span className="shrink-0 border-l border-ui-divider pl-2 text-[11px] font-medium text-ui-muted">{result.kind}</span>
              </button>
            );
          }) : <p className="py-8 text-center text-sm text-ink-500">검색 결과가 없습니다.</p>}
        </div>
      </div>
    </Modal>
  );
}
