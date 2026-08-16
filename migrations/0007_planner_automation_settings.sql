CREATE TABLE `planner_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL UNIQUE,
  `carry_over_enabled` integer DEFAULT false NOT NULL,
  `auto_archive_completed` integer DEFAULT false NOT NULL,
  `reminder_today_enabled` integer DEFAULT true NOT NULL,
  `reminder_overdue_enabled` integer DEFAULT false NOT NULL,
  `reminder_due_soon_enabled` integer DEFAULT false NOT NULL,
  `reminder_due_soon_days` integer DEFAULT 3 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TRIGGER `todos_auto_archive_completed_update`
AFTER UPDATE OF `completed` ON `todos`
WHEN NEW.`completed` = 1 AND OLD.`completed` = 0
  AND EXISTS (SELECT 1 FROM `planner_settings` WHERE `user_id` = NEW.`user_id` AND `auto_archive_completed` = 1)
BEGIN
  UPDATE `todos`
  SET `archived` = 1,
      `archived_at` = COALESCE(`archived_at`, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE `id` = NEW.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `todos_auto_archive_completed_insert`
AFTER INSERT ON `todos`
WHEN NEW.`completed` = 1
  AND EXISTS (SELECT 1 FROM `planner_settings` WHERE `user_id` = NEW.`user_id` AND `auto_archive_completed` = 1)
BEGIN
  UPDATE `todos`
  SET `archived` = 1,
      `archived_at` = COALESCE(`archived_at`, strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ','now')
  WHERE `id` = NEW.`id`;
END;