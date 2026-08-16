ALTER TABLE `focus_sessions` ADD COLUMN `planner_date` text DEFAULT '' NOT NULL;
--> statement-breakpoint
UPDATE `focus_sessions` SET `planner_date` = substr(`started_at`, 1, 10) WHERE `planner_date` = '';
--> statement-breakpoint
CREATE INDEX `focus_sessions_user_planner_date_idx` ON `focus_sessions` (`user_id`,`planner_date`);
--> statement-breakpoint
CREATE INDEX `focus_sessions_todo_v2_idx` ON `focus_sessions` (`todo_id`);
--> statement-breakpoint
CREATE TABLE `time_blocks` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `todo_id` text,
  `title` text NOT NULL,
  `date` text NOT NULL,
  `start_time` text NOT NULL,
  `end_time` text NOT NULL,
  `planned_minutes` integer NOT NULL,
  `completed` integer DEFAULT false NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `time_blocks_user_date_start_idx` ON `time_blocks` (`user_id`,`date`,`start_time`);
--> statement-breakpoint
CREATE INDEX `time_blocks_todo_idx` ON `time_blocks` (`todo_id`);