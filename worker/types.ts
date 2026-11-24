export type Bindings = {
  DB: D1Database;
  AUTH_USERNAME: string;
  AUTH_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  DISCORD_WEBHOOK_URL?: string;
  /** Optional: server-only GitHub GraphQL token. Public calendar works without it. */
  GITHUB_ACTIVITY_TOKEN?: string;
  /** Read-only repository token, independent of activity access. Set as a Worker secret. */
  GITHUB_REPOSITORY_TOKEN?: string;
  /** Comma-separated owner/repo allowlist. No wildcards. */
  GITHUB_REPOSITORY_ALLOWLIST?: string;
  LOGIN_RATE_LIMITER: RateLimit;
  MUTATION_RATE_LIMITER: RateLimit;
};

export type Variables = {
  userId: string;
};
