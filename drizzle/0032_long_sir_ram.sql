CREATE INDEX `audit_logs_entity_created_idx` ON `audit_logs` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `bank_transactions_active_status_due_idx` ON `bank_transactions` (`active`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `bank_transactions_account_status_idx` ON `bank_transactions` (`bank_account_id`,`active`,`status`);--> statement-breakpoint
CREATE INDEX `broker_payments_broker_idx` ON `broker_commission_payments` (`broker_id`);--> statement-breakpoint
CREATE INDEX `cheques_active_status_due_idx` ON `cheques` (`active`,`status`,`due_date`);--> statement-breakpoint
CREATE INDEX `deal_brokers_broker_idx` ON `deal_brokers` (`broker_id`);--> statement-breakpoint
CREATE INDEX `deals_status_date_idx` ON `deals` (`status`,`date`,`sequence`);--> statement-breakpoint
CREATE INDEX `deals_party_status_idx` ON `deals` (`party_id`,`status`);--> statement-breakpoint
CREATE INDEX `fiscal_documents_deal_status_idx` ON `fiscal_documents` (`deal_id`,`status`,`purpose`);--> statement-breakpoint
CREATE INDEX `fiscal_documents_issue_funrural_idx` ON `fiscal_documents` (`issue_date`,`funrural_detected`);--> statement-breakpoint
CREATE INDEX `general_entries_active_due_idx` ON `general_entries` (`active`,`due_date`);--> statement-breakpoint
CREATE INDEX `installments_due_date_idx` ON `installments` (`due_date`);