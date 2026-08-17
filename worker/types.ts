import type { Context } from "hono";

export type WorkersAiBinding = {
  run: (model: string, input: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    max_tokens?: number;
    temperature?: number;
    response_format?: {
      type: "json_schema";
      json_schema: Record<string, unknown>;
    };
  }) => Promise<unknown>;
};

export type Bindings = {
  DB: D1Database;
  ASSETS: Fetcher;
  AI?: WorkersAiBinding;
  AI_LEARNING_MODEL?: string;
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
