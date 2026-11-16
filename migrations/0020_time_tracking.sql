ALTER TABLE `focus_sessions` ADD COLUMN `category_id` text;
--> statement-breakpoint
ALTER TABLE `focus_sessions` ADD COLUMN `category_name` text;
--> statement-breakpoint
ALTER TABLE `focus_sessions` ADD COLUMN `project_id` text;
--> statement-breakpoint
CREATE TABLE `active_timers` (
  `user_id` text PRIMARY KEY NOT NULL,
  `todo_id` text,
  `todo_title` text NOT NULL,
  `category_id` text,
  `category_name` text,
  `project_id` text,
  `started_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE set null
);
