/** Unscheduled buckets use this placeholder instead of a calendar date. */
export const UNSCHEDULED_TODO_DATE = "9999-12-31";

/** Never reuse an Inbox/Someday placeholder when scheduling an item. */
export function resolveTodoScheduledDate(editedDate: string, previousDate: string, today: string): string {
  const candidate = editedDate.trim() || previousDate.trim();
  return !candidate || candidate === UNSCHEDULED_TODO_DATE ? today : candidate;
}
