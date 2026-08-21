UPDATE `financial_categories` SET `code`='COMPRA_CAFE' WHERE `code` IS NULL AND `name`='Compra de café' AND `type`='EXPENSE';
--> statement-breakpoint
UPDATE `financial_categories` SET `code`='VENDA_CAFE' WHERE `code` IS NULL AND `name`='Venda de café' AND `type`='INCOME';
--> statement-breakpoint
INSERT OR IGNORE INTO `financial_categories` (`id`,`code`,`name`,`type`,`description`,`active`,`created_at`,`updated_at`) VALUES
('category-coffee-purchase','COMPRA_CAFE','Compra de café','EXPENSE','Pagamentos de negócios de compra de café',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
('category-coffee-sale','VENDA_CAFE','Venda de café','INCOME','Recebimentos de negócios de venda de café',1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
--> statement-breakpoint
UPDATE `bank_transactions`
SET `financial_category_id`=(
  SELECT CASE WHEN d.`business_type`='PURCHASE'
    THEN (SELECT `id` FROM `financial_categories` WHERE `code`='COMPRA_CAFE' LIMIT 1)
    ELSE (SELECT `id` FROM `financial_categories` WHERE `code`='VENDA_CAFE' LIMIT 1)
  END
  FROM `settlements` s
  JOIN `installments` i ON i.`id`=s.`origin_id`
  JOIN `deals` d ON d.`id`=i.`deal_id`
  WHERE s.`bank_transaction_id`=`bank_transactions`.`id` AND s.`origin_type`='INSTALLMENT'
)
WHERE `id` IN (SELECT `bank_transaction_id` FROM `settlements` WHERE `origin_type`='INSTALLMENT');
--> statement-breakpoint
UPDATE `bank_transactions`
SET `financial_category_id`=(
  SELECT g.`category_id`
  FROM `settlements` s
  JOIN `general_entries` g ON g.`id`=s.`origin_id`
  WHERE s.`bank_transaction_id`=`bank_transactions`.`id` AND s.`origin_type`='GENERAL_ENTRY'
)
WHERE `id` IN (SELECT `bank_transaction_id` FROM `settlements` WHERE `origin_type`='GENERAL_ENTRY');
--> statement-breakpoint
UPDATE `bank_transactions` SET `reconciled`=1 WHERE `status`='CLEARED' AND `active`=1;
