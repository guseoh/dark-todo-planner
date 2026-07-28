CREATE TABLE `notification_send_records` (
	`id` text PRIMARY KEY NOT NULL,
	`planner_date` text NOT NULL,
	`provider` text NOT NULL,
	`status` text NOT NULL,
	`sent_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_send_records_date_provider_uidx` ON `notification_send_records` (`planner_date`,`provider`);