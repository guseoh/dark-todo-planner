CREATE TABLE `projects` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `status` text DEFAULT 'ACTIVE' NOT NULL,
  `color` text,
  `icon` text,
  `start_date` text,
  `target_date` text,
  `archived` integer DEFAULT false NOT NULL,
  `archived_at` text,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_user_archived_order_idx` ON `projects` (`user_id`,`archived`,`sort_order`);
--> statement-breakpoint
CREATE INDEX `projects_user_status_target_idx` ON `projects` (`user_id`,`status`,`target_date`);
--> statement-breakpoint
CREATE TABLE `milestones` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `project_id` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `target_date` text,
  `status` text DEFAULT 'TODO' NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `milestones_project_order_idx` ON `milestones` (`project_id`,`sort_order`,`target_date`);
--> statement-breakpoint
ALTER TABLE `todos` ADD `project_id` text REFERENCES projects(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `todos` ADD `milestone_id` text REFERENCES milestones(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `todos` ADD `parent_todo_id` text;
--> statement-breakpoint
ALTER TABLE `todos` ADD `due_date` text;
--> statement-breakpoint
ALTER TABLE `todos` ADD `estimate_minutes` integer;
--> statement-breakpoint
ALTER TABLE `todos` ADD `planning_state` text DEFAULT 'SCHEDULED' NOT NULL;
--> statement-breakpoint
ALTER TABLE `todos` ADD `workflow_status` text DEFAULT 'TODO' NOT NULL;
--> statement-breakpoint
CREATE INDEX `todos_user_planning_date_idx` ON `todos` (`user_id`,`planning_state`,`date`);
--> statement-breakpoint
CREATE INDEX `todos_user_project_status_idx` ON `todos` (`user_id`,`project_id`,`workflow_status`);
--> statement-breakpoint
CREATE INDEX `todos_project_milestone_idx` ON `todos` (`project_id`,`milestone_id`);
--> statement-breakpoint
CREATE INDEX `todos_parent_idx` ON `todos` (`parent_todo_id`);
--> statement-breakpoint
CREATE INDEX `todos_due_date_idx` ON `todos` (`due_date`);
