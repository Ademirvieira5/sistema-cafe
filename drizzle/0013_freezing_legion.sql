ALTER TABLE `people` ADD `classification` text DEFAULT 'COMPANY' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `country` text DEFAULT 'BRASIL' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `funrural_status` text DEFAULT 'REVIEW' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `source` text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `legacy_source_key` text;--> statement-breakpoint
ALTER TABLE `people` ADD `last_invoice_at` text;--> statement-breakpoint
ALTER TABLE `people` ADD `last_imported_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `people_legacy_source_key_unique` ON `people` (`legacy_source_key`);