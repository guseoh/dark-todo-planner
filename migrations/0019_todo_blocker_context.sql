ALTER TABLE `todos` ADD COLUMN `block_reason` text;
--> statement-breakpoint
ALTER TABLE `todos` ADD COLUMN `unblock_condition` text;
--> statement-breakpoint
CREATE TRIGGER `todo_activity_blocker_context_update`
AFTER UPDATE ON `todos`
WHEN OLD.`block_reason` IS NOT NEW.`block_reason`
  OR OLD.`unblock_condition` IS NOT NEW.`unblock_condition`
BEGIN
  INSERT INTO `todo_activity` (`id`, `user_id`, `todo_id`, `action`, `changes_json`, `created_at`)
  VALUES (
    lower(hex(randomblob(16))), NEW.`user_id`, NEW.`id`, 'UPDATED',
    json_object(
      'before', json_object('blockReason', OLD.`block_reason`, 'unblockCondition', OLD.`unblock_condition`),
      'after', json_object('blockReason', NEW.`block_reason`, 'unblockCondition', NEW.`unblock_condition`)
    ), NEW.`updated_at`
  );
END;
