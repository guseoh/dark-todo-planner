CREATE TABLE `todo_dependencies` (
  `user_id` text NOT NULL,
  `blocking_todo_id` text NOT NULL,
  `blocked_todo_id` text NOT NULL,
  `created_at` text NOT NULL,
  PRIMARY KEY (`blocking_todo_id`, `blocked_todo_id`),
  CHECK (`blocking_todo_id` <> `blocked_todo_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`blocking_todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`blocked_todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_dependencies_user_blocked_idx` ON `todo_dependencies` (`user_id`,`blocked_todo_id`);
--> statement-breakpoint
CREATE INDEX `todo_dependencies_user_blocking_idx` ON `todo_dependencies` (`user_id`,`blocking_todo_id`);
