import { Download } from "lucide-react";
import { buildPlannerMarkdown, buildTodoCsv, downloadText } from "../../lib/export";
import type { Goal } from "../../types/goal";
import type { Memo } from "../../types/memo";
import type { Project } from "../../types/project";
import type { Todo } from "../../types/todo";

export function ExportPanel({ todos, projects, goals, memos }: { todos: Todo[]; projects: Project[]; goals: Goal[]; memos: Memo[] }) {
  const date = new Date().toISOString().slice(0, 10);
  return (
    <section className="app-card p-4 sm:p-5" aria-labelledby="data-export-title">
      <div className="flex items-center gap-2"><Download size={18} className="text-accent-300" /><h3 id="data-export-title" className="text-base font-bold text-ink-100">읽기용 내보내기</h3></div>
      <p className="mt-1 text-xs text-ink-400">JSON 백업과 별개로, 다른 도구에서 바로 읽거나 정리할 수 있는 Markdown/CSV 파일을 만듭니다.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" className="btn-secondary min-h-12 justify-center" onClick={() => downloadText(`dark-todo-planner-${date}.md`, buildPlannerMarkdown({ todos, projects, goals, memos }), "text/markdown;charset=utf-8")}><Download size={16} />Markdown 내보내기</button>
        <button type="button" className="btn-secondary min-h-12 justify-center" onClick={() => downloadText(`dark-todo-planner-todos-${date}.csv`, `\uFEFF${buildTodoCsv(todos, projects)}`, "text/csv;charset=utf-8")}><Download size={16} />Todo CSV 내보내기</button>
      </div>
      <p className="mt-3 text-[11px] text-ink-500">Markdown에는 프로젝트·Todo·계획 큐·목표·메모를, CSV에는 Todo의 주요 필드를 포함합니다.</p>
    </section>
  );
}
