import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, CopyPlus, MoveRight, Trash2 } from "lucide-react";
import { Button } from "../ui/Button";
import { formatKoreanDate } from "../../lib/date";
import {
  getDuplicateTodoIds,
  type OverdueTodoImportMode,
  type OverdueTodoImportResult,
} from "../../lib/todoRecovery";
import type { Todo } from "../../types/todo";
import { Modal } from "../common/Modal";

type OverdueTodoImportModalProps = {
  todos: Todo[];
  onImport: (
    selectedIds: ReadonlySet<string>,
    mode: OverdueTodoImportMode,
  ) => Promise<OverdueTodoImportResult>;
  onDeleteMany: (ids: string[]) => Promise<boolean> | boolean;
  onClose: () => void;
};

export function OverdueTodoImportModal({ todos, onImport, onDeleteMany, onClose }: OverdueTodoImportModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [submitting, setSubmitting] = useState(false);
  const [deletingDate, setDeletingDate] = useState<string | null>(null);
  const [result, setResult] = useState<OverdueTodoImportResult | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteNotice, setDeleteNotice] = useState("");
  const duplicateTodoIds = useMemo(() => getDuplicateTodoIds(todos), [todos]);
  const groupedTodos = useMemo(() => {
    const groups = new Map<string, Todo[]>();
    todos.forEach((todo) => groups.set(todo.date, [...(groups.get(todo.date) || []), todo]));
    return [...groups.entries()]
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([date, dateTodos]) => [
        date,
        [...dateTodos].sort((left, right) => {
          if (left.completed !== right.completed) return left.completed ? 1 : -1;
          return right.createdAt.localeCompare(left.createdAt);
        }),
      ] as const);
  }, [todos]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(
    () => new Set(groupedTodos.slice(0, 2).map(([date]) => date)),
  );
  const busy = submitting || deletingDate !== null;
  const visibleIds = useMemo(() => new Set(todos.map((todo) => todo.id)), [todos]);
  const selectedVisibleIds = useMemo(
    () => [...selectedIds].filter((id) => visibleIds.has(id)),
    [selectedIds, visibleIds],
  );
  // Parent refreshes after a failed/partial request. Never keep vanished IDs selected.
  useEffect(() => {
    setSelectedIds((current) => {
      if ([...current].every((id) => visibleIds.has(id))) return current;
      return new Set([...current].filter((id) => visibleIds.has(id)));
    });
  }, [visibleIds]);


  const toggleTodo = (id: string) => {
    if (busy) return;
    setResult(null);
    setDeleteError("");
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDate = (date: string) => {
    if (busy) return;
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const toggleDateSelection = (dateTodos: Todo[]) => {
    if (busy) return;
    setResult(null);
    setDeleteError("");
    setSelectedIds((current) => {
      const ids = dateTodos.map((todo) => todo.id);
      const allSelected = ids.every((id) => current.has(id));
      const next = new Set(current);
      ids.forEach((id) => {
        if (allSelected) next.delete(id);
        else next.add(id);
      });
      return next;
    });
  };

  const deleteSelected = async (ids: string[], label: string, date: string | null = null) => {
    if (busy) return;
    const targets = [...new Set(ids)].filter((id) => visibleIds.has(id));
    if (!targets.length) return;
    if (!window.confirm(label + " " + targets.length + "개를 휴지통으로 이동할까요? 휴지통에서 복원할 수 있습니다.")) return;
    setDeletingDate(date || "selected");
    setResult(null);
    setDeleteNotice("");
    setDeleteError("");
    try {
      const deleted = await Promise.resolve(onDeleteMany(targets));
      if (!deleted) {
        setDeleteError("일괄 삭제를 완료하지 못했습니다. 일부 항목이 처리되었을 수 있으니 최신 목록을 확인해주세요.");
        return;
      }
      setSelectedIds((current) => {
        const next = new Set(current);
        targets.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteNotice(targets.length + "개를 휴지통으로 이동했습니다. 휴지통에서 복원할 수 있습니다.");
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "선택한 Todo를 휴지통으로 이동하지 못했습니다.");
    } finally {
      setDeletingDate(null);
    }
  };

  const deleteDateTodos = async (date: string, dateTodos: Todo[]) => {
    const label = formatKoreanDate(date, "M월 d일 EEEE");
    await deleteSelected(dateTodos.map((todo) => todo.id), label + "의 Todo");
  };

  const selectAll = () => {
    setDeleteNotice("");
    if (busy) return;
    setResult(null);
    setDeleteError("");
    setSelectedIds(new Set(todos.map((todo) => todo.id)));
  };

  const selectExpanded = () => {
    if (busy) return;
    setResult(null);
    setDeleteError("");
    setSelectedIds(
      new Set(
        groupedTodos
          .filter(([date]) => expandedDates.has(date))
          .flatMap(([, dateTodos]) => dateTodos.map((todo) => todo.id)),
      ),
    );
  };

  const clearSelection = () => {
    setDeleteNotice("");
    if (busy) return;
    setResult(null);
    setDeleteError("");
    setSelectedIds(new Set());
  };

  const runImport = async (mode: OverdueTodoImportMode) => {
    if (!selectedVisibleIds.length || busy) return;
    setSubmitting(true);
    setResult(null);
    setDeleteError("");
    try {
      setResult(await onImport(new Set(selectedVisibleIds), mode));
      setSelectedIds(new Set());
    } catch {
      setResult({
        total: selectedVisibleIds.length,
        success: 0,
        skipped: 0,
        failed: selectedVisibleIds.length,
        mode,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const resultMessage = result
    ? `${result.mode === "move" ? "이동" : "복사"} 성공 ${result.success}개 · 건너뜀 ${result.skipped}개 · 실패 ${result.failed}개`
    : "";

  return (
    <Modal
      title="지난 일정 정리"
      description="필요한 작업을 선택해 오늘로 이동하거나 복사할 수 있습니다. 삭제한 Todo는 휴지통에서 복원할 수 있습니다."
      onClose={() => { if (!busy) onClose(); }}
      size="lg"
    >
      <div className="overdue-review" aria-busy={busy}>
        <div className="overdue-review__toolbar">
          <div className="overdue-review__summary" role="status" aria-live="polite">
            <strong>{selectedVisibleIds.length}</strong>개 선택
            <span> · {groupedTodos.length}개 날짜</span>
          </div>
          <div className="overdue-review__selection-actions">
            <button type="button" className="overdue-review__text-action" onClick={selectAll}
              disabled={!todos.length || busy}>전체 선택</button>
            <button type="button" className="overdue-review__text-action" onClick={selectExpanded}
              disabled={!expandedDates.size || busy}>펼친 날짜 선택</button>
            <button type="button" className="overdue-review__text-action" onClick={clearSelection}
              disabled={!selectedVisibleIds.length || busy}>선택 해제</button>
          </div>
        </div>
        <div className="overdue-review__expand-actions">
          <button type="button" onClick={() => setExpandedDates(new Set(groupedTodos.map(([date]) => date)))}
            disabled={!groupedTodos.length || busy}>모두 펼치기</button>
          <span aria-hidden="true">·</span>
          <button type="button" onClick={() => setExpandedDates(new Set())}
            disabled={!expandedDates.size || busy}>모두 접기</button>
          <span className="overdue-review__hint">최근 날짜 2개만 기본으로 펼쳐집니다.</span>
        </div>

        <div className="overdue-review__list" role="region" aria-label="날짜별 미처리 Todo 목록">
          {groupedTodos.map(([date, dateTodos]) => {
            const expanded = expandedDates.has(date);
            const selectedCount = dateTodos.filter((todo) => selectedIds.has(todo.id)).length;
            const allSelected = dateTodos.length > 0 && selectedCount === dateTodos.length;
            const dateLabel = formatKoreanDate(date, "M월 d일 EEEE");
            return (
              <section key={date} className="overdue-review__date" aria-labelledby={"overdue-" + date}>
                <div className="overdue-review__date-header">
                  <input type="checkbox" className="overdue-review__check"
                    aria-label={dateLabel + " Todo 전체 선택"}
                    checked={allSelected}
                    ref={(input) => { if (input) input.indeterminate = selectedCount > 0 && !allSelected; }}
                    onChange={() => toggleDateSelection(dateTodos)} disabled={busy} />
                  <button type="button" className="overdue-review__date-toggle" onClick={() => toggleDate(date)}
                    aria-expanded={expanded} aria-controls={"overdue-list-" + date} disabled={busy}>
                    <span id={"overdue-" + date} className="overdue-review__date-title">{dateLabel}</span>
                    <span className="overdue-review__date-count">{dateTodos.length}개</span>
                    {selectedCount > 0 ? <span className="overdue-review__date-selected">{selectedCount}개 선택</span> : null}
                    {expanded ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronRight size={16} aria-hidden="true" />}
                  </button>
                  <button type="button" className="overdue-review__date-delete"
                    onClick={() => void deleteDateTodos(date, dateTodos)}
                    disabled={busy} aria-label={formatKoreanDate(date, "M월 d일") + " Todo 전체 삭제"}
                    title="이 날짜의 Todo를 휴지통으로 이동">
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
                {expanded ? (
                  <div id={"overdue-list-" + date} className="overdue-review__tasks">
                    {dateTodos.map((todo) => (
                      <label key={todo.id}
                        className={selectedIds.has(todo.id) ? "overdue-review__task is-selected" : "overdue-review__task"}>
                        <input type="checkbox" className="overdue-review__check" checked={selectedIds.has(todo.id)}
                          onChange={() => toggleTodo(todo.id)} disabled={busy} />
                        <span className="overdue-review__task-info">
                          <span className={todo.completed ? "overdue-review__task-title is-completed" : "overdue-review__task-title"}>{todo.title}</span>
                          <span className="overdue-review__task-meta">
                            {todo.category?.name || "미분류"} · 원래 일정 {formatKoreanDate(todo.date, "M월 d일")}
                            {duplicateTodoIds.has(todo.id) ? <span className="overdue-review__duplicate"> · 중복 후보</span> : null}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}
          {!groupedTodos.length ? <p className="overdue-review__empty">정리할 지난 일정이 없습니다.</p> : null}
        </div>

        {deleteError ? <p role="alert" className="overdue-review__notice is-error">{deleteError}</p> : null}
        {deleteNotice ? <p role="status" className="overdue-review__notice is-success">{deleteNotice}</p> : null}
        {resultMessage ? (
          <p role="status" className={result?.failed ? "overdue-review__notice is-error" : "overdue-review__notice is-success"}>{resultMessage}</p>
        ) : null}

        <div className="overdue-review__footer">
          <Button variant="danger" size="sm" className="overdue-review__bulk-delete"
            onClick={() => void deleteSelected(selectedVisibleIds, "선택한 Todo")}
            disabled={!selectedVisibleIds.length || busy}>
            <Trash2 size={15} aria-hidden="true" />선택 {selectedVisibleIds.length}개 삭제
          </Button>
          <div className="overdue-review__footer-actions">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>닫기</Button>
            <Button variant="secondary" size="sm" onClick={() => void runImport("copy")}
              disabled={!selectedVisibleIds.length || busy}>
              <CopyPlus size={15} aria-hidden="true" />선택 {selectedVisibleIds.length}개 복사
            </Button>
            <Button variant="primary" size="sm" onClick={() => void runImport("move")}
              disabled={!selectedVisibleIds.length || busy}>
              <MoveRight size={15} aria-hidden="true" />
              {submitting ? "처리 중..." : "선택 " + selectedVisibleIds.length + "개 이동"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
