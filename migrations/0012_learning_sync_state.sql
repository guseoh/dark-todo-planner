CREATE TABLE `learning_sync_state` (
  `user_id` text PRIMARY KEY NOT NULL,
  `last_attempt_at` text,
  `last_success_at` text,
  `code_reading_count` integer DEFAULT 0 NOT NULL,
  `tech_blog_count` integer DEFAULT 0 NOT NULL,
  `code_reading_error` text,
  `tech_blog_error` text,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
