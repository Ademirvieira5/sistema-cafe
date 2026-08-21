ALTER TABLE `fiscal_documents` ADD `purpose` text DEFAULT 'DEAL' NOT NULL;
--> statement-breakpoint
ALTER TABLE `fiscal_documents` ADD `general_entry_id` text REFERENCES general_entries(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `fiscal_documents_general_entry_unique` ON `fiscal_documents` (`general_entry_id`);
