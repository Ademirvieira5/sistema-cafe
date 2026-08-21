DELETE FROM `audit_logs`
WHERE (`entity_type` = 'Deal' AND `entity_id` = '46dcc010-a713-41d4-846a-1feb1da9b74b')
   OR (`entity_type` = 'Installment' AND `entity_id` IN (
     SELECT `id` FROM `installments` WHERE `deal_id` = '46dcc010-a713-41d4-846a-1feb1da9b74b'
   ));--> statement-breakpoint

DELETE FROM `deal_brokers`
WHERE `deal_id` = '46dcc010-a713-41d4-846a-1feb1da9b74b';--> statement-breakpoint

DELETE FROM `installments`
WHERE `deal_id` = '46dcc010-a713-41d4-846a-1feb1da9b74b';--> statement-breakpoint

DELETE FROM `deals`
WHERE `id` = '46dcc010-a713-41d4-846a-1feb1da9b74b'
  AND `sequence` = 10
  AND `business_type` = 'PURCHASE'
  AND `status` = 'CANCELLED'
  AND `total_amount_cents` = 11500000;
