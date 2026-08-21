ALTER TABLE `fiscal_documents` ADD `adjustment_deal_id` text REFERENCES deals(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `fiscal_documents_adjustment_deal_idx` ON `fiscal_documents` (`adjustment_deal_id`);
