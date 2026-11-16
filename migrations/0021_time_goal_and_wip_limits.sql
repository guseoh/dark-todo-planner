ALTER TABLE `planner_settings` ADD COLUMN `daily_goal_minutes` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `planner_settings` ADD COLUMN `wip_limits_json` text DEFAULT '{}' NOT NULL;
