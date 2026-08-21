CREATE TABLE `settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`origin_type` text NOT NULL,
	`origin_id` text NOT NULL,
	`bank_transaction_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`settled_at` text NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`bank_transaction_id`) REFERENCES `bank_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_bank_transaction_unique` ON `settlements` (`bank_transaction_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `settlement_origin_created_unique` ON `settlements` (`origin_type`,`origin_id`,`created_at`);