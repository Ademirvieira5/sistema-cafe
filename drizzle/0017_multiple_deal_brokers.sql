CREATE TABLE `deal_brokers` (
  `id` text PRIMARY KEY NOT NULL,
  `deal_id` text NOT NULL,
  `broker_id` text NOT NULL,
  `position` integer DEFAULT 1 NOT NULL,
  `commission_mode` text NOT NULL,
  `commission_value` text NOT NULL,
  `commission_amount_cents` integer DEFAULT 0 NOT NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deal_brokers_deal_broker_unique` ON `deal_brokers` (`deal_id`,`broker_id`);
--> statement-breakpoint
INSERT INTO `deal_brokers` (`id`,`deal_id`,`broker_id`,`position`,`commission_mode`,`commission_value`,`commission_amount_cents`,`created_at`,`updated_at`)
SELECT 'legacy_' || d.`id`,d.`id`,d.`broker_id`,1,COALESCE(d.`commission_mode`,'AMOUNT'),COALESCE(d.`commission_value`,CAST(d.`commission_amount_cents` / 100.0 AS text)),d.`commission_amount_cents`,d.`created_at`,d.`updated_at`
FROM `deals` d WHERE d.`broker_id` IS NOT NULL;
--> statement-breakpoint
DROP TRIGGER IF EXISTS `broker_commission_balance_guard`;
--> statement-breakpoint
CREATE TRIGGER `broker_commission_balance_guard`
BEFORE INSERT ON `broker_commission_payments`
WHEN NEW.`amount_cents` + COALESCE((
  SELECT SUM(cp.`amount_cents`) FROM `broker_commission_payments` cp
  JOIN `bank_transactions` bt ON bt.`id` = cp.`bank_transaction_id`
  WHERE cp.`broker_id` = NEW.`broker_id` AND bt.`active` = 1 AND bt.`status` <> 'CANCELLED'
), 0) > COALESCE((
  SELECT SUM(db.`commission_amount_cents`) FROM `deal_brokers` db
  JOIN `deals` d ON d.`id` = db.`deal_id`
  WHERE db.`broker_id` = NEW.`broker_id` AND d.`status` = 'OPEN'
), 0)
BEGIN
  SELECT RAISE(ABORT, 'COMMISSION_EXCEEDS_BALANCE');
END;
