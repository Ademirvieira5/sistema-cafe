DELETE FROM `settlements`
WHERE `bank_transaction_id` IN (
  'a8d9b399-f240-4889-abcb-90c91768c939',
  'a0c1e96b-19e8-422c-8a62-ca6db9d73319'
);--> statement-breakpoint

DELETE FROM `broker_commission_payments`
WHERE `bank_transaction_id` IN (
  'a8d9b399-f240-4889-abcb-90c91768c939',
  'a0c1e96b-19e8-422c-8a62-ca6db9d73319'
);--> statement-breakpoint

DELETE FROM `audit_logs`
WHERE `entity_type` = 'BankTransaction'
  AND `entity_id` IN (
    'a8d9b399-f240-4889-abcb-90c91768c939',
    'a0c1e96b-19e8-422c-8a62-ca6db9d73319'
  );--> statement-breakpoint

DELETE FROM `bank_transactions`
WHERE `id` IN (
    'a8d9b399-f240-4889-abcb-90c91768c939',
    'a0c1e96b-19e8-422c-8a62-ca6db9d73319'
  )
  AND `status` = 'CANCELLED'
  AND `amount_cents` = 50000000
  AND `counterparty` = 'COFFEA'
  AND `description` = 'Venda café coffea';
