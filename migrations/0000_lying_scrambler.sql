CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text,
	`icon` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_user_order_idx` ON `categories` (`user_id`,`sort_order`,`created_at`);--> statement-breakpoint
CREATE TABLE `focus_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`todo_id` text,
	`todo_title` text,
	`mode` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`started_at` text NOT NULL,
	`ended_at` text NOT NULL,
	`completed` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `focus_sessions_user_started_idx` ON `focus_sessions` (`user_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `focus_sessions_todo_idx` ON `focus_sessions` (`todo_id`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`type` text DEFAULT 'DAILY' NOT NULL,
	`target_date` text,
	`week_start_date` text,
	`week_end_date` text,
	`month` text,
	`due_date` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_type_target_idx` ON `goals` (`user_id`,`type`,`target_date`);--> statement-breakpoint
CREATE INDEX `goals_user_week_idx` ON `goals` (`user_id`,`week_start_date`);--> statement-breakpoint
CREATE INDEX `goals_user_month_idx` ON `goals` (`user_id`,`month`);--> statement-breakpoint
CREATE TABLE `memos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text,
	`content` text NOT NULL,
	`color` text,
	`pinned` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `memos_user_pinned_updated_idx` ON `memos` (`user_id`,`pinned`,`updated_at`);--> statement-breakpoint
CREATE TABLE `music_links` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`provider` text,
	`memo` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `music_links_user_updated_idx` ON `music_links` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `reflections` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`sections_json` text DEFAULT '[]' NOT NULL,
	`content` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reflections_user_type_date_idx` ON `reflections` (`user_id`,`type`,`date`);--> statement-breakpoint
CREATE INDEX `reflections_user_updated_idx` ON `reflections` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_user_name_uidx` ON `tags` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `timer_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`focus_minutes` integer DEFAULT 25 NOT NULL,
	`short_break_minutes` integer DEFAULT 5 NOT NULL,
	`long_break_minutes` integer DEFAULT 15 NOT NULL,
	`sessions_before_long_break` integer DEFAULT 4 NOT NULL,
	`sound_enabled` integer DEFAULT true NOT NULL,
	`notification_enabled` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `timer_settings_user_id_unique` ON `timer_settings` (`user_id`);--> statement-breakpoint
CREATE TABLE `todo_tags` (
	`todo_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`todo_id`, `tag_id`),
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_tags_tag_idx` ON `todo_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`category_id` text,
	`title` text NOT NULL,
	`memo` text,
	`date` text NOT NULL,
	`start_time` text,
	`end_time` text,
	`priority` text DEFAULT 'MEDIUM' NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`repeat` text DEFAULT 'NONE' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `todos_user_archived_date_idx` ON `todos` (`user_id`,`archived`,`date`);--> statement-breakpoint
CREATE INDEX `todos_user_category_order_idx` ON `todos` (`user_id`,`category_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `todos_user_created_idx` ON `todos` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `topic_links` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`title` text,
	`url` text NOT NULL,
	`description` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topic_links_topic_created_idx` ON `topic_links` (`topic_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `topics` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`memo` text,
	`status` text DEFAULT 'IDEA' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`icon` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `topics_user_status_updated_idx` ON `topics` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`nickname` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);