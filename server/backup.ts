import { prisma } from "./db";

const normalizeOptional = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseTags = (tags?: unknown) =>
  Array.isArray(tags)
    ? Array.from(new Set(tags.map((tag) => String(tag).trim().replace(/^#/, "")).filter(Boolean)))
    : [];

export const importBackupForUser = async (userId: string, data: Record<string, any>) => {
  if (!data || (data.todos !== undefined && !Array.isArray(data.todos))) {
    throw new Error("todos 배열이 필요합니다.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.topicLink.deleteMany({ where: { topic: { userId } } });
    await tx.topic.deleteMany({ where: { userId } });
    await tx.musicLink.deleteMany({ where: { userId } });
    await tx.todoTag.deleteMany({ where: { todo: { userId } } });
    await tx.todo.deleteMany({ where: { userId } });
    await tx.tag.deleteMany({ where: { userId } });
    await tx.category.deleteMany({ where: { userId } });
    await tx.reflection.deleteMany({ where: { userId } });
    await tx.goal.deleteMany({ where: { userId } });
    await tx.memo.deleteMany({ where: { userId } });

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

    const topicIds = new Set<string>();
    for (const topic of data.topics || []) {
      if (!topic?.id || !topic?.title) continue;
      topicIds.add(topic.id);
      await tx.topic.create({
        data: {
          id: topic.id,
          userId,
          title: topic.title,
          memo: normalizeOptional(topic.memo),
          status: topic.status || "IDEA",
          tagsJson: JSON.stringify(parseTags(topic.tags)),
        },
      });
    }

    const topicLinkMap = new Map<string, any>();
    const collectTopicLink = (link: any) => {
      if (!link?.url || !link?.topicId) return;
      const key = link.id || `${link.topicId}:${link.url}`;
      if (!topicLinkMap.has(key)) topicLinkMap.set(key, link);
    };
    (data.topicLinks || []).forEach(collectTopicLink);
    (data.topics || []).forEach((topic: any) => {
      if (!Array.isArray(topic?.links)) return;
      topic.links.forEach((link: any) => collectTopicLink({ ...link, topicId: topic.id }));
    });
    const topicLinks = Array.from(topicLinkMap.values());
    for (const link of topicLinks) {
      if (!link?.url || !link?.topicId || !topicIds.has(link.topicId)) continue;
      await tx.topicLink.create({
        data: {
          id: link.id || undefined,
          topicId: link.topicId,
          title: normalizeOptional(link.title),
          url: String(link.url),
          description: normalizeOptional(link.description),
        },
      });
    }

    for (const link of data.musicLinks || []) {
      if (!link?.id || !link?.title || !link?.url) continue;
      await tx.musicLink.create({
        data: {
          id: link.id,
          userId,
          title: link.title,
          url: String(link.url),
          provider: link.provider || "ETC",
          memo: normalizeOptional(link.memo),
        },
      });
    }

    for (const memo of data.memos || []) {
      if (!memo?.id || !memo?.content) continue;
      await tx.memo.create({
        data: {
          id: memo.id,
          userId,
          title: normalizeOptional(memo.title),
          content: String(memo.content),
          color: normalizeOptional(memo.color),
          pinned: !!memo.pinned,
        },
      });
    }

    for (const reflection of data.reflections || []) {
      if (!reflection?.id || !reflection?.date) continue;
      const sections = Array.isArray(reflection.sections)
        ? reflection.sections
        : reflection.content
          ? [{ id: "legacy-content", title: "기존 회고", content: reflection.content, order: 0 }]
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
  });
};
