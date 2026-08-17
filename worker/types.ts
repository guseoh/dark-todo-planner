import type { Context } from "hono";

export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  AUTH_USERNAME: string;
  AUTH_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  DISCORD_WEBHOOK_URL?: string;
  NOTION_TOKEN?: string;
  NOTION_CODE_READING_DATA_SOURCE_ID?: string;
  NOTION_TECH_BLOG_DATA_SOURCE_ID?: string;
  LOGIN_RATE_LIMITER: RateLimit;
  MUTATION_RATE_LIMITER: RateLimit;
};

export type Variables = { userId: string };
export type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;
