CREATE TABLE `imported_documents` (
  `id` text PRIMARY KEY NOT NULL,
  `fingerprint` text NOT NULL,
  `document_type` text NOT NULL,
  `original_filename` text NOT NULL,
  `pdf_key` text NOT NULL,
  `issuer_name` text,
  `issuer_document` text,
  `competence` text,
  `due_date` text,
  `document_number` text,
  `amount_cents` integer,
  `payment_code` text,
  `details_json` text DEFAULT '{}' NOT NULL,
  `status` text DEFAULT 'REVIEW' NOT NULL,
  `general_entry_id` text REFERENCES `general_entries`(`id`) ON DELETE SET NULL,
  `created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
  `updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `imported_documents_fingerprint_unique` ON `imported_documents` (`fingerprint`);
--> statement-breakpoint
CREATE INDEX `imported_documents_status_idx` ON `imported_documents` (`status`);
