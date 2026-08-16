CREATE TABLE `todo_trash` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `original_todo_id` text NOT NULL,
  `title` text NOT NULL,
  `payload_json` text NOT NULL,
  `deleted_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_trash_user_original_uidx` ON `todo_trash` (`user_id`,`original_todo_id`);
--> statement-breakpoint
CREATE INDEX `todo_trash_user_deleted_idx` ON `todo_trash` (`user_id`,`deleted_at`);