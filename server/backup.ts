import { prisma } from "./db";

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseTags = (tags?: unknown) =>
  Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean)))
    : [];

const defaultTimerSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  soundEnabled: true,
  notificationEnabled: false,
};

const normalizeTimerSettings = (settings: Record<string, any>) => ({
  focusMinutes: Number(settings.focusMinutes) || defaultTimerSettings.focusMinutes,
  shortBreakMinutes: Number(settings.shortBreakMinutes) || defaultTimerSettings.shortBreakMinutes,
  longBreakMinutes: Number(settings.longBreakMinutes) || defaultTimerSettings.longBreakMinutes,
  sessionsBeforeLongBreak:
    Number(settings.sessionsBeforeLongBreak) || defaultTimerSettings.sessionsBeforeLongBreak,
  soundEnabled: settings.soundEnabled !== false,
  notificationEnabled: settings.notificationEnabled === true,
});

export const importBackupForUser = async (userId: string, data: Record<string, any>) => {
  if (!data || !Array.isArray(data.todos)) {
    throw new Error("todos 배열이 필요합니다.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.focusSession.deleteMany({ where: { userId } });
    await tx.todoTag.deleteMany({ where: { todo: { userId } } });
    await tx.todo.deleteMany({ where: { userId } });
    await tx.tag.deleteMany({ where: { userId } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.reflection.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });

    const categoryIds = new Set<string>();
    for (const category of data.categories || []) {
      if (!category?.id || !category?.name) continue;
      categoryIds.add(category.id);
      await tx.category.create({
        data: {
          id: category.id,
          userId,
          name: category.name,
          description: normalizeOptional(category.description),
          color: category.color || "#6366f1",
          order: category.order || 0,
        },
      });
    }

    for (const todo of data.todos || []) {
      if (!todo?.id || !todo?.title || !todo?.date) continue;
      const categoryId = todo.categoryId && categoryIds.has(todo.categoryId) ? todo.categoryId : null;
      await tx.todo.create({
        data: {
          id: todo.id,
          userId,
          categoryId,
          title: todo.title,
          memo: normalizeOptional(todo.memo),
          date: todo.date,
          startTime: normalizeOptional(todo.startTime),
          endTime: normalizeOptional(todo.endTime),
          priority: todo.priority || "MEDIUM",
          completed: !!todo.completed,
          repeat: todo.repeat || "NONE",
          archived: !!todo.archived,
          archivedAt: todo.archivedAt ? new Date(todo.archivedAt) : null,
          order: todo.order || 0,
        },
      });
      for (const name of parseTags(todo.tags)) {
        const tag = await tx.tag.upsert({
          where: { userId_name: { userId, name } },
          update: {},
          create: { userId, name },
        });
        await tx.todoTag.create({ data: { todoId: todo.id, tagId: tag.id } });
      }
    }

    for (const reflection of data.reflections || []) {
      if (!reflection?.id || !reflection?.date) continue;
      const sections = Array.isArray(reflection.sections)
        ? reflection.sections
        : reflection.content
          ? [{ id: "legacy-content", title: "메모", content: reflection.content, order: 0 }]
          : [];
      await tx.reflection.create({
        data: {
          id: reflection.id,
          userId,
          date: reflection.date,
          type: reflection.type || "DAILY",
          content: normalizeOptional(reflection.content),
          sectionsJson: JSON.stringify(sections),
        },
      });
    }

    for (const goal of data.goals || []) {
      if (!goal?.id || !goal?.title) continue;
      await tx.goal.create({
        data: {
          id: goal.id,
          userId,
          title: goal.title,
          description: normalizeOptional(goal.description),
          type: goal.type || "DAILY",
          targetDate: goal.targetDate || goal.dueDate || null,
          weekStartDate: goal.weekStartDate || null,
          weekEndDate: goal.weekEndDate || null,
          month: goal.month || null,
          dueDate: goal.dueDate || goal.targetDate || null,
          progress: Math.min(100, Math.max(0, Number(goal.progress) || 0)),
          completed: !!goal.completed,
        },
      });
    }

    for (const session of data.focusSessions || []) {
      if (!session?.id || !session?.startedAt || !session?.endedAt) continue;
      await tx.focusSession.create({
        data: {
          id: session.id,
          userId,
          todoId: session.todoId || null,
          todoTitle: normalizeOptional(session.todoTitle),
          mode: session.mode || "FOCUS",
          durationMinutes: Number(session.durationMinutes) || 0,
          startedAt: new Date(session.startedAt),
          endedAt: new Date(session.endedAt),
          completed: session.completed !== false,
        },
      });
    }

    if (data.timerSettings) {
      const timerSettings = normalizeTimerSettings(data.timerSettings);
      await tx.timerSettings.upsert({
        where: { userId },
        update: timerSettings,
        create: { userId, ...timerSettings },
      });
    }
  });
};
