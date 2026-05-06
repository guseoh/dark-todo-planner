import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./db";

const COOKIE_NAME = "dtp_session";
const SESSION_SECRET = process.env.SESSION_SECRET || "dev-only-change-this-secret";

type SessionPayload = {
  userId: string;
};

export type AuthenticatedRequest = Request & {
  userId: string;
};

export const signSession = (userId: string) =>
  jwt.sign({ userId } satisfies SessionPayload, SESSION_SECRET, { expiresIn: "14d" });

export const setSessionCookie = (res: Response, token: string) => {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 14 * 24 * 60 * 60 * 1000,
    path: "/",
  });
};

export const clearSessionCookie = (res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ message: "로그인이 필요합니다." });

  try {
    const payload = jwt.verify(token, SESSION_SECRET) as SessionPayload;
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
    if (!user) return res.status(401).json({ message: "유효하지 않은 세션입니다." });
    (req as AuthenticatedRequest).userId = user.id;
    return next();
  } catch {
    return res.status(401).json({ message: "세션이 만료되었거나 유효하지 않습니다." });
  }
};

export const toSafeUser = (user: { id: string; email: string; nickname: string | null; createdAt: Date; updatedAt: Date }) => ({
  id: user.id,
  email: user.email,
  nickname: user.nickname,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
