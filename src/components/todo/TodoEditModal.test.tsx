import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Todo } from "../../types/todo";
import { TodoEditModal } from "./TodoEditModal";

const todo: Todo = {
  id: "t1", title: "마감 있는 할 일", date: "2026-11-20", dueDate: "2026-11-30", planningState: "SCHEDULED",
  workflowStatus: "TODO", priority: "MEDIUM", completed: false, archived: false,
  createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
};
const noop = () => undefined;

describe("todo edit dialog", () => {
  it("shows the due date field by default so every caller can change or clear a deadline", () => {
    const html = renderToStaticMarkup(<TodoEditModal todo={todo} onClose={noop} onSave={noop} />);
    expect(html).toContain("마감일");
  });

  it("hides the due date field only when a caller opts out", () => {
    const html = renderToStaticMarkup(<TodoEditModal hideDueDate todo={todo} onClose={noop} onSave={noop} />);
    expect(html).not.toContain("마감일");
  });

  it("keeps save and cancel in a sticky footer with one name for the blocked status", () => {
    const html = renderToStaticMarkup(<TodoEditModal todo={todo} onClose={noop} onSave={noop} />);
    expect(html).toMatch(/class="todo-edit-footer sticky[^"]*"/);
    expect(html).toContain(">저장</button>");
    expect(html).toContain('<option value="BLOCKED">보류</option>');
    expect(html).not.toContain("차단됨");
  });
});
