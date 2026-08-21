CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before_data` text,
	`after_data` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bank_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_code` text,
	`bank_name` text NOT NULL,
	`agency` text,
	`account_number` text NOT NULL,
	`account_digit` text,
	`type` text NOT NULL,
	`description` text,
	`opening_balance_cents` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `brokers` (
	`id` text PRIMARY KEY NOT NULL,
	`person_type` text NOT NULL,
	`name` text NOT NULL,
	`trade_name` text,
	`cpf_cnpj` text,
	`rg_ie` text,
	`email` text,
	`phone` text,
	`pix_key` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `brokers_cpf_cnpj_unique` ON `brokers` (`cpf_cnpj`);--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`sequence` integer NOT NULL,
	`business_type` text NOT NULL,
	`date` text NOT NULL,
	`party_id` text NOT NULL,
	`kilograms_milli` integer NOT NULL,
	`price_per_sack_cents` integer NOT NULL,
	`gross_amount_cents` integer NOT NULL,
	`adjustment_amount_cents` integer DEFAULT 0 NOT NULL,
	`total_amount_cents` integer NOT NULL,
	`broker_id` text,
	`commission_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`party_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`broker_id`) REFERENCES `brokers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deals_sequence_unique` ON `deals` (`sequence`);--> statement-breakpoint
CREATE TABLE `financial_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `financial_categories_code_unique` ON `financial_categories` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `category_name_type_unique` ON `financial_categories` (`name`,`type`);--> statement-breakpoint
CREATE TABLE `general_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`direction` text NOT NULL,
	`description` text NOT NULL,
	`category_id` text NOT NULL,
	`person_id` text,
	`due_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_amount_cents` integer DEFAULT 0 NOT NULL,
	`fixed_monthly` integer DEFAULT false NOT NULL,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `financial_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` text PRIMARY KEY NOT NULL,
	`deal_id` text NOT NULL,
	`number` integer NOT NULL,
	`due_date` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_amount_cents` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`deal_id`) REFERENCES `deals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `installment_deal_number_unique` ON `installments` (`deal_id`,`number`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` text PRIMARY KEY NOT NULL,
	`person_type` text NOT NULL,
	`legal_name` text NOT NULL,
	`trade_name` text,
	`cpf_cnpj` text,
	`rg_ie` text,
	`email` text,
	`phone` text,
	`zip_code` text,
	`street` text,
	`number` text,
	`complement` text,
	`district` text,
	`city` text,
	`state` text,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_cpf_cnpj_unique` ON `people` (`cpf_cnpj`);--> statement-breakpoint
CREATE TABLE `person_roles` (
	`person_id` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`person_id`, `role`),
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
