CREATE TABLE `broker_commission_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`broker_id` text NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`payment_date` text NOT NULL,
	`method` text NOT NULL,
	`document` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `broker_payment_bank_transaction_unique` ON `broker_commission_payments` (`bank_transaction_id`);