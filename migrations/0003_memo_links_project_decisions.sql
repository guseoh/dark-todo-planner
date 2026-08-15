CREATE TABLE `project_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL,
  `decision` text NOT NULL,
  `rationale` text,
  `decided_at` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `project_decisions_project_decided_idx` ON `project_decisions` (`project_id`,`decided_at`);
--> statement-breakpoint
CREATE TABLE `memo_todo_links` (
  `memo_id` text NOT NULL,
  `todo_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY(`memo_id`, `todo_id`),
  FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memo_todo_links_todo_idx` ON `memo_todo_links` (`todo_id`);
--> statement-breakpoint
CREATE TABLE `memo_project_links` (
  `memo_id` text NOT NULL,
  `project_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY(`memo_id`, `project_id`),
  FOREIGN KEY (`memo_id`) REFERENCES `memos`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memo_project_links_project_idx` ON `memo_project_links` (`project_id`);
