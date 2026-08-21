CREATE TABLE `funrural_periods` (
	`competence` text PRIMARY KEY NOT NULL,
	`guide_amount_cents` integer,
	`imported_document_id` text,
	`notes` text,
	`confirmed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`imported_document_id`) REFERENCES `imported_documents`(`id`) ON UPDATE no action ON DELETE set null
);
