CREATE TABLE `todo_reminders` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `todo_id` text NOT NULL,
  `remind_at` text NOT NULL,
  `channel` text DEFAULT 'DISCORD' NOT NULL CHECK (`channel` IN ('DISCORD')),
  `status` text DEFAULT 'PENDING' NOT NULL CHECK (`status` IN ('PENDING', 'SENT', 'CANCELLED')),
  `sent_at` text,
  `claim_token` text,
  `claimed_at` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_reminders_todo_uidx` ON `todo_reminders` (`todo_id`);
--> statement-breakpoint
CREATE INDEX `todo_reminders_user_status_remind_idx` ON `todo_reminders` (`user_id`,`status`,`remind_at`);
--> statement-breakpoint
CREATE TABLE `routine_templates` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `routine_templates_user_updated_idx` ON `routine_templates` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `routine_template_items` (
  `id` text PRIMARY KEY NOT NULL,
  `routine_id` text NOT NULL,
  `title` text NOT NULL,
  `priority` text DEFAULT 'MEDIUM' NOT NULL CHECK (`priority` IN ('LOW','MEDIUM','HIGH')),
  `estimate_minutes` integer,
  `project_id` text,
  `category_id` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`routine_id`) REFERENCES `routine_templates`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `routine_template_items_routine_order_idx` ON `routine_template_items` (`routine_id`,`sort_order`);
--> statement-breakpoint
CREATE TABLE `routine_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `routine_id` text NOT NULL,
  `target_date` text NOT NULL,
  `created_at` text NOT NULL,
  FOREIGN KEY (`routine_id`) REFERENCES `routine_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `routine_runs_routine_date_uidx` ON `routine_runs` (`routine_id`,`target_date`);