ALTER TABLE `fiscal_documents` ADD `classification_confidence` text DEFAULT 'CONFIRMED' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `classification_reason` text;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `operation_nature` text;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `operation_type` text;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `fiscal_purpose` text;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `referenced_keys_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `funrural_detected` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `funrural_rate` text;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `funrural_amount_cents` integer;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `funrural_source` text;
