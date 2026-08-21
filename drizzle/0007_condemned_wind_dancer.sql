ALTER TABLE `bank_transactions` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `bank_transactions_operation_unique` ON `bank_transactions` (`operation_key`,`bank_account_id`,`direction`);--> statement-breakpoint
ALTER TABLE `broker_commission_payments` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `broker_payment_operation_key_unique` ON `broker_commission_payments` (`operation_key`);--> statement-breakpoint
ALTER TABLE `deals` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `deals_operation_key_unique` ON `deals` (`operation_key`);--> statement-breakpoint
ALTER TABLE `general_entries` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `general_entries_operation_key_unique` ON `general_entries` (`operation_key`);--> statement-breakpoint
ALTER TABLE `settlements` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_operation_key_unique` ON `settlements` (`operation_key`);
--> statement-breakpoint
CREATE TRIGGER `settlement_installment_balance_guard`
BEFORE INSERT ON `settlements`
WHEN NEW.`origin_type` = 'INSTALLMENT' AND (
  SELECT `paid_amount_cents` + NEW.`amount_cents` > `amount_cents`
  FROM `installments` WHERE `id` = NEW.`origin_id`
)
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_EXCEEDS_BALANCE');
END;
--> statement-breakpoint
CREATE TRIGGER `settlement_general_balance_guard`
BEFORE INSERT ON `settlements`
WHEN NEW.`origin_type` = 'GENERAL_ENTRY' AND (
  SELECT `paid_amount_cents` + NEW.`amount_cents` > `amount_cents`
  FROM `general_entries` WHERE `id` = NEW.`origin_id`
)
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_EXCEEDS_BALANCE');
END;
--> statement-breakpoint
CREATE TRIGGER `broker_commission_balance_guard`
BEFORE INSERT ON `broker_commission_payments`
WHEN NEW.`amount_cents` + COALESCE((
  SELECT SUM(cp.`amount_cents`)
  FROM `broker_commission_payments` cp
  JOIN `bank_transactions` bt ON bt.`id` = cp.`bank_transaction_id`
  WHERE cp.`broker_id` = NEW.`broker_id` AND bt.`active` = 1 AND bt.`status` <> 'CANCELLED'
), 0) > COALESCE((
  SELECT SUM(d.`commission_amount_cents`)
  FROM `deals` d
  WHERE d.`broker_id` = NEW.`broker_id` AND d.`status` = 'OPEN'
), 0)
BEGIN
  SELECT RAISE(ABORT, 'COMMISSION_EXCEEDS_BALANCE');
END;
