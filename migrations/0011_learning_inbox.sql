CREATE TABLE `learning_items` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `learning_date` text NOT NULL,
  `type` text NOT NULL CHECK (`type` IN ('DAILY_PROBLEM', 'TECH_BLOG')),
  `title` text NOT NULL,
  `summary` text,
  `source_url` text,
  `source_name` text,
  `status` text DEFAULT 'UNREAD' NOT NULL CHECK (`status` IN ('UNREAD', 'READING', 'DONE', 'SKIPPED')),
  `external_key` text NOT NULL,
  `todo_id` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_items_user_external_key_uidx` ON `learning_items` (`user_id`,`external_key`);
--> statement-breakpoint
CREATE INDEX `learning_items_user_date_type_idx` ON `learning_items` (`user_id`,`learning_date`,`type`);
--> statement-breakpoint
CREATE INDEX `learning_items_user_status_date_idx` ON `learning_items` (`user_id`,`status`,`learning_date`);
--> statement-breakpoint
CREATE INDEX `learning_items_todo_idx` ON `learning_items` (`todo_id`);
