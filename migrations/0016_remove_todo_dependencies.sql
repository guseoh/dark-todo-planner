UPDATE `todos`
SET `workflow_status` = 'TODO'
WHERE `completed` = 0
  AND `workflow_status` = 'BLOCKED'
  AND `id` IN (SELECT `blocked_todo_id` FROM `todo_dependencies`);
--> statement-breakpoint
DROP TABLE IF EXISTS `todo_dependencies`;
