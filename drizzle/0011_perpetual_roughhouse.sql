CREATE TABLE `cheque_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`received_from_person_id` text,
	`received_at` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`received_from_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cheque_events` (
	`id` text PRIMARY KEY NOT NULL,
	`cheque_id` text NOT NULL,
	`event_type` text NOT NULL,
	`event_date` text NOT NULL,
	`bank_account_id` text,
	`person_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cheque_id`) REFERENCES `cheques`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cheques` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text,
	`operation_key` text NOT NULL,
	`bank_name` text NOT NULL,
	`agency` text,
	`account_number` text,
	`check_number` text NOT NULL,
	`issuer_name` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`received_at` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text NOT NULL,
	`image_key` text,
	`ocr_confidence` integer,
	`receipt_origin_type` text,
	`receipt_origin_id` text,
	`transfer_origin_type` text,
	`transfer_origin_id` text,
	`bank_transaction_id` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `cheque_batches`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cheques_operation_key_unique` ON `cheques` (`operation_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `cheques_identity_unique` ON `cheques` (`bank_name`,`agency`,`account_number`,`check_number`);
--> statement-breakpoint
CREATE TRIGGER `cheque_installment_balance_guard`
BEFORE INSERT ON `cheques`
WHEN NEW.`receipt_origin_type` = 'INSTALLMENT' AND (
  SELECT NEW.`amount_cents` > i.`amount_cents` - i.`paid_amount_cents`
  FROM `installments` i WHERE i.`id` = NEW.`receipt_origin_id`
)
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_EXCEEDS_BALANCE');
END;
--> statement-breakpoint
CREATE TRIGGER `cheque_general_balance_guard`
BEFORE INSERT ON `cheques`
WHEN NEW.`receipt_origin_type` = 'GENERAL_ENTRY' AND (
  SELECT NEW.`amount_cents` > g.`amount_cents` - g.`paid_amount_cents`
  FROM `general_entries` g WHERE g.`id` = NEW.`receipt_origin_id`
)
BEGIN
  SELECT RAISE(ABORT, 'SETTLEMENT_EXCEEDS_BALANCE');
END;
