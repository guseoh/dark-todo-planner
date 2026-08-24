import { Trash2, Undo2 } from "lucide-react";
import type { PendingTodoDelete } from "../../hooks/useTodos";

type TodoDeleteNoticeModalProps = {
  pending: PendingTodoDelete;
  onUndo: () => void;
};

export function TodoDeleteNoticeModal({ pending, onUndo }: TodoDeleteNoticeModalProps) {
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm" role="presentation">
      <div role="alertdialog" aria-modal="true" aria-labelledby="todo-delete-notice-title" aria-describedby="todo-delete-notice-description" className="w-full max-w-sm rounded-xl border border-ink-700/70 bg-ink-900 p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-danger/35 bg-danger/10 text-red-200"><Trash2 size={18} /></span>
          <div className="min-w-0 flex-1">
            <h2 id="todo-delete-notice-title" className="text-base font-bold text-ink-100">Todo를 삭제했습니다</h2>
            <p id="todo-delete-notice-description" className="mt-1 break-words text-sm leading-6 text-ink-400">“{pending.label}” 항목은 잠시 후 휴지통으로 이동합니다.</p>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary px-3" onClick={onUndo} autoFocus><Undo2 size={15} />실행 취소</button>
        </div>
      </div>
    </div>
  );
}
