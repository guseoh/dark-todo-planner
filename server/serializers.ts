import type { Category, FocusSession, Goal, Reflection, Tag, TimerSettings, Todo, TodoTag } from "@prisma/client";

type TodoWithRelations = Todo & {
  category?: Category | null;
  todoTags?: Array<TodoTag & { tag: Tag }>;
};

const toIso = (date: Date | null | undefined) => (date ? date.toISOString() : undefined);

export const serializeCategory = (category: Category) => ({
  ...category,
  createdAt: category.createdAt.toISOString(),
  updatedAt: category.updatedAt.toISOString(),
});

export const serializeTodo = (todo: TodoWithRelations) => ({
  id: todo.id,
  userId: todo.userId,
  categoryId: todo.categoryId || undefined,
  title: todo.title,
  memo: todo.memo || undefined,
  date: todo.date,
  startTime: todo.startTime || undefined,
  endTime: todo.endTime || undefined,
  priority: todo.priority,
  completed: todo.completed,
  repeat: todo.repeat,
  archived: todo.archived,
  archivedAt: toIso(todo.archivedAt),
  order: todo.order,
  tags: todo.todoTags?.map((todoTag) => todoTag.tag.name) || [],
  category: todo.category ? serializeCategory(todo.category) : undefined,
  createdAt: todo.createdAt.toISOString(),
  updatedAt: todo.updatedAt.toISOString(),
});

const fallbackReflectionSections = (reflection: Reflection) =>
  reflection.content
    ? [{ id: "legacy-content", title: "메모", content: reflection.content, order: 0 }]
    : [];

export const parseSections = (reflection: Reflection) => {
  try {
    const parsed = JSON.parse(reflection.sectionsJson);
    if (!Array.isArray(parsed)) return fallbackReflectionSections(reflection);
    const sections = parsed
      .map((section, index) => ({
        id: typeof section?.id === "string" ? section.id : `section-${index}`,
        title: typeof section?.title === "string" && section.title.trim() ? section.title : `섹션 ${index + 1}`,
        content: typeof section?.content === "string" ? section.content : "",
        order: Number.isInteger(section?.order) ? section.order : index,
      }))
      .sort((a, b) => a.order - b.order);
    return sections.length ? sections : fallbackReflectionSections(reflection);
  } catch {
    return fallbackReflectionSections(reflection);
  }
};

export const serializeReflection = (reflection: Reflection) => ({
  id: reflection.id,
  userId: reflection.userId,
  date: reflection.date,
  type: reflection.type,
  content: reflection.content || undefined,
  sections: parseSections(reflection),
  createdAt: reflection.createdAt.toISOString(),
  updatedAt: reflection.updatedAt.toISOString(),
});

export const serializeGoal = (goal: Goal) => ({
  ...goal,
  description: goal.description || undefined,
  targetDate: goal.targetDate || undefined,
  weekStartDate: goal.weekStartDate || undefined,
  weekEndDate: goal.weekEndDate || undefined,
  month: goal.month || undefined,
  dueDate: goal.dueDate || undefined,
  createdAt: goal.createdAt.toISOString(),
  updatedAt: goal.updatedAt.toISOString(),
});

export const serializeFocusSession = (session: FocusSession) => ({
  ...session,
  todoId: session.todoId || undefined,
  todoTitle: session.todoTitle || undefined,
  startedAt: session.startedAt.toISOString(),
  endedAt: session.endedAt.toISOString(),
  createdAt: session.createdAt.toISOString(),
});

export const serializeTimerSettings = (settings: TimerSettings) => ({
  ...settings,
  createdAt: settings.createdAt.toISOString(),
  updatedAt: settings.updatedAt.toISOString(),
});
