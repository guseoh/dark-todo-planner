import type { Context } from "hono";

export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  AUTH_USERNAME: string;
  AUTH_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  LOGIN_RATE_LIMITER: RateLimit;
  MUTATION_RATE_LIMITER: RateLimit;
};

export type Variables = { userId: string };
export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
