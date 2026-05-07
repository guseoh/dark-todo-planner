import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db";

const DEFAULT_USER_EMAIL = "single-user@dark-todo-planner.local";

export type AuthenticatedRequest = Request & {
  userId: string;
};

export const ensureDefaultUser = async () => {
  const existingUser = await prisma.user.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (existingUser) return existingUser;

  return prisma.user.create({
    data: {
      email: DEFAULT_USER_EMAIL,
      passwordHash: "single-user-mode",
      nickname: "개인 사용자",
    },
    select: { id: true },
  });
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await ensureDefaultUser();
    (req as AuthenticatedRequest).userId = user.id;
    return next();
  } catch (error) {
    return next(error);
  }
};
