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
--> statement-breakpoint
CREATE TABLE `todo_activity` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `todo_id` text NOT NULL,
  `action` text NOT NULL CHECK (`action` IN ('CREATED','UPDATED')),
  `changes_json` text NOT NULL DEFAULT '{}',
  `created_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `todo_activity_user_todo_created_idx` ON `todo_activity` (`user_id`,`todo_id`,`created_at`);
--> statement-breakpoint
CREATE TRIGGER `todo_activity_after_insert`
AFTER INSERT ON `todos`
BEGIN
  INSERT INTO `todo_activity` (`id`, `user_id`, `todo_id`, `action`, `changes_json`, `created_at`)
  VALUES (lower(hex(randomblob(16))), NEW.`user_id`, NEW.`id`, 'CREATED', json_object('after', json_object('title', NEW.`title`)), NEW.`created_at`);
END;
--> statement-breakpoint
CREATE TRIGGER `todo_activity_after_update`
AFTER UPDATE ON `todos`
WHEN OLD.`title` IS NOT NEW.`title`
  OR OLD.`memo` IS NOT NEW.`memo`
  OR OLD.`reference_url` IS NOT NEW.`reference_url`
  OR OLD.`reference_label` IS NOT NEW.`reference_label`
  OR OLD.`date` IS NOT NEW.`date`
  OR OLD.`due_date` IS NOT NEW.`due_date`
  OR OLD.`start_time` IS NOT NEW.`start_time`
  OR OLD.`end_time` IS NOT NEW.`end_time`
  OR OLD.`estimate_minutes` IS NOT NEW.`estimate_minutes`
  OR OLD.`planning_state` IS NOT NEW.`planning_state`
  OR OLD.`workflow_status` IS NOT NEW.`workflow_status`
  OR OLD.`priority` IS NOT NEW.`priority`
  OR OLD.`repeat` IS NOT NEW.`repeat`
  OR OLD.`project_id` IS NOT NEW.`project_id`
  OR OLD.`milestone_id` IS NOT NEW.`milestone_id`
  OR OLD.`parent_todo_id` IS NOT NEW.`parent_todo_id`
  OR OLD.`category_id` IS NOT NEW.`category_id`
  OR OLD.`completed` IS NOT NEW.`completed`
  OR OLD.`archived` IS NOT NEW.`archived`
BEGIN
  INSERT INTO `todo_activity` (`id`, `user_id`, `todo_id`, `action`, `changes_json`, `created_at`)
  VALUES (
    lower(hex(randomblob(16))), NEW.`user_id`, NEW.`id`, 'UPDATED',
    json_object(
      'before', json_object('title', OLD.`title`, 'memo', OLD.`memo`, 'referenceUrl', OLD.`reference_url`, 'referenceLabel', OLD.`reference_label`, 'date', OLD.`date`, 'dueDate', OLD.`due_date`, 'startTime', OLD.`start_time`, 'endTime', OLD.`end_time`, 'estimateMinutes', OLD.`estimate_minutes`, 'planningState', OLD.`planning_state`, 'workflowStatus', OLD.`workflow_status`, 'priority', OLD.`priority`, 'repeat', OLD.`repeat`, 'projectId', OLD.`project_id`, 'milestoneId', OLD.`milestone_id`, 'parentTodoId', OLD.`parent_todo_id`, 'categoryId', OLD.`category_id`, 'completed', OLD.`completed`, 'archived', OLD.`archived`),
      'after', json_object('title', NEW.`title`, 'memo', NEW.`memo`, 'referenceUrl', NEW.`reference_url`, 'referenceLabel', NEW.`reference_label`, 'date', NEW.`date`, 'dueDate', NEW.`due_date`, 'startTime', NEW.`start_time`, 'endTime', NEW.`end_time`, 'estimateMinutes', NEW.`estimate_minutes`, 'planningState', NEW.`planning_state`, 'workflowStatus', NEW.`workflow_status`, 'priority', NEW.`priority`, 'repeat', NEW.`repeat`, 'projectId', NEW.`project_id`, 'milestoneId', NEW.`milestone_id`, 'parentTodoId', NEW.`parent_todo_id`, 'categoryId', NEW.`category_id`, 'completed', NEW.`completed`, 'archived', NEW.`archived`)
    ), NEW.`updated_at`
  );
END;
--> statement-breakpoint
CREATE TRIGGER `todo_reminder_cancel_when_resolved`
AFTER UPDATE OF `completed`, `archived` ON `todos`
WHEN NEW.`completed` = 1 OR NEW.`archived` = 1
BEGIN
  UPDATE `todo_reminders`
  SET `status` = 'CANCELLED', `claim_token` = NULL, `claimed_at` = NULL, `updated_at` = NEW.`updated_at`
  WHERE `todo_id` = NEW.`id` AND `status` = 'PENDING';
END;
