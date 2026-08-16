CREATE TABLE `scratchpads` (
  `user_id` text PRIMARY KEY NOT NULL,
  `content` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
