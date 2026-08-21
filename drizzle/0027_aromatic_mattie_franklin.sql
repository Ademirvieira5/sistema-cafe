ALTER TABLE `fiscal_documents` ADD `funrural_general_entry_id` text REFERENCES general_entries(id) ON DELETE SET NULL;
