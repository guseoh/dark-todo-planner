CREATE TABLE `daily_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `date` text NOT NULL,
  `focus_text` text,
  `top_todo_ids_json` text DEFAULT '[]' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_plans_user_date_uidx` ON `daily_plans` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE `weekly_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `week_start_date` text NOT NULL,
  `wins` text,
  `blockers` text,
  `lessons` text,
  `next_focus` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_reviews_user_week_uidx` ON `weekly_reviews` (`user_id`,`week_start_date`);
--> statement-breakpoint
CREATE TABLE `saved_views` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `query_json` text DEFAULT '{}' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_views_user_name_uidx` ON `saved_views` (`user_id`,`name`);
--> statement-breakpoint
CREATE INDEX `saved_views_user_updated_idx` ON `saved_views` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `task_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `todo_json` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_templates_user_name_idx` ON `task_templates` (`user_id`,`name`);