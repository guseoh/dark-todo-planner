import { z } from "zod";

const booleanStringSchema = z
  .string()
  .optional()
  .transform((value, context) => {
    if (value === undefined || value === "") return undefined;
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    context.addIssue({ code: z.ZodIssueCode.custom, message: "boolean 환경 변수는 true 또는 false여야 합니다." });
    return z.NEVER;
  });

const portSchema = z
  .string()
  .optional()
  .default("3000")
  .transform((value, context) => {
    const port = Number(value);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "PORT는 1-65535 사이의 정수여야 합니다." });
      return z.NEVER;
    }
    return port;
  });

const createSizeLimitSchema = (defaultValue: string) =>
  z
    .string()
    .optional()
    .default(defaultValue)
    .refine((value) => /^\d+(?:b|kb|mb)$/i.test(value), "크기 제한은 512kb 또는 4mb 같은 형식이어야 합니다.");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional().default("development"),
  HOST: z.string().trim().optional().default("127.0.0.1"),
  PORT: portSchema,
  DATABASE_URL: z.string().trim().optional().default("file:../data/dev.db"),
  CLIENT_URL: z.string().optional(),
  CLIENT_ORIGIN: z.string().optional(),
  APP_AUTH_ENABLED: booleanStringSchema,
  APP_AUTH_USERNAME: z.string().optional(),
  APP_AUTH_PASSWORD: z.string().optional(),
  ALLOW_INSECURE_PUBLIC_ACCESS: booleanStringSchema,
  JSON_BODY_LIMIT: createSizeLimitSchema("2mb"),
  BACKUP_JSON_BODY_LIMIT: createSizeLimitSchema("4mb"),
});

const splitOrigins = (value?: string) =>
  (value || "")
    .split(",")
    .map((origin) => {
      const trimmed = origin.trim().replace(/\/$/, "");
      if (!trimmed) return null;
      try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));

const isExternalHost = (host: string) => ["0.0.0.0", "::", ""].includes(host);

export type ServerConfig = ReturnType<typeof loadServerConfig>;

export const loadServerConfig = (env: NodeJS.ProcessEnv = process.env) => {
  const parsed = envSchema.parse(env);
  if (!parsed.DATABASE_URL.startsWith("file:")) {
    throw new Error("DATABASE_URL은 현재 SQLite file: URL만 지원합니다.");
  }

  const clientOrigins = new Set(
    splitOrigins(parsed.CLIENT_URL || parsed.CLIENT_ORIGIN || "http://localhost:5173,http://127.0.0.1:5173"),
  );

  const authEnabled = parsed.APP_AUTH_ENABLED ?? false;
  const allowInsecurePublicAccess = parsed.ALLOW_INSECURE_PUBLIC_ACCESS ?? false;
  if (authEnabled && (!parsed.APP_AUTH_USERNAME || !parsed.APP_AUTH_PASSWORD)) {
    throw new Error("APP_AUTH_ENABLED=true이면 APP_AUTH_USERNAME과 APP_AUTH_PASSWORD가 필요합니다.");
  }
  if (parsed.NODE_ENV === "production" && !authEnabled && !allowInsecurePublicAccess) {
    throw new Error("production에서는 APP_AUTH_ENABLED=true 또는 ALLOW_INSECURE_PUBLIC_ACCESS=true가 필요합니다.");
  }
  if (parsed.NODE_ENV === "production" && isExternalHost(parsed.HOST) && !authEnabled && !allowInsecurePublicAccess) {
    throw new Error("외부 인터페이스에 인증 없이 production 서버를 바인딩할 수 없습니다.");
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    isProduction: parsed.NODE_ENV === "production",
    host: parsed.HOST,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    clientOrigins,
    auth: {
      enabled: authEnabled,
      username: parsed.APP_AUTH_USERNAME || "",
      password: parsed.APP_AUTH_PASSWORD || "",
      allowInsecurePublicAccess,
    },
    jsonBodyLimit: parsed.JSON_BODY_LIMIT,
    backupJsonBodyLimit: parsed.BACKUP_JSON_BODY_LIMIT,
  };
};
