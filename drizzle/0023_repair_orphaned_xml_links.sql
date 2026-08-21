UPDATE `fiscal_documents`
SET `deal_id`=NULL,
    `status`='PENDING',
    `linked_at`=NULL,
    `updated_at`=CURRENT_TIMESTAMP
WHERE `purpose`='DEAL'
  AND `general_entry_id` IS NULL
  AND `status`='LINKED'
  AND (`deal_id` IS NULL OR NOT EXISTS (
    SELECT 1 FROM `deals` WHERE `deals`.`id`=`fiscal_documents`.`deal_id`
  ));
