import type { MiddlewareHandler } from "hono";
import { BackupFormatError } from "./backupFormat";
import { validateFullRestoreBackup } from "./backupRestoreValidation";
import type { Bindings, Variables } from "./types";

type AppEnv = { Bindings: Bindings; Variables: Variables };

/**
 * Run BEFORE any import middleware may suspend settings or delete rows.
 * Old local-storage migrations use another endpoint and remain compatible.
 */
export const requireSafeFullBackupImport: MiddlewareHandler<AppEnv> = async (c, next) => {
  let payload: unknown;
  try {
    payload = await c.req.raw.clone().json();
    validateFullRestoreBackup(payload);
  } catch (error) {
    if (error instanceof BackupFormatError) return c.json({ message: error.message }, 400);
    return c.json({ message: "전체 JSON 백업 형식이 유효하지 않습니다." }, 400);
  }

  // These historic tables are not yet round-tripped by the JSON endpoint.
  // Replacing todos would cascade-delete reminders and sever learning links.
  const userId = c.get("userId");
  const [reminder, learning] = await Promise.all([
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM todo_reminders WHERE user_id = ?").bind(userId).first<{ count: number }>(),
    c.env.DB.prepare("SELECT COUNT(*) AS count FROM learning_items WHERE user_id = ? AND todo_id IS NOT NULL").bind(userId).first<{ count: number }>(),
  ]);
  if (Number(reminder?.count || 0) > 0 || Number(learning?.count || 0) > 0) {
    return c.json({ message: "현재 DB에 JSON 복원으로 유지할 수 없는 개별 알림 또는 학습 항목-Todo 연결이 있습니다. SQL/D1 백업 복구 절차를 사용하세요." }, 409);
  }
  await next();
};
