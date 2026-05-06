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

export const parseSections = (reflection: Reflection) => {
  try {
    const parsed = JSON.parse(reflection.sectionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
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
