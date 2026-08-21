INSERT INTO `audit_logs` (`id`, `entity_type`, `entity_id`, `action`, `before_data`, `after_data`, `created_at`)
SELECT lower(hex(randomblob(16))), 'BankAccount', `id`, 'CORRECT_OPENING_BALANCE', '{"openingBalance":"312480484.00"}', '{"openingBalance":"3124804.84"}', CURRENT_TIMESTAMP
FROM `bank_accounts`
WHERE `bank_code` = '748'
  AND `bank_name` = 'SICREDI'
  AND `agency` = '3022'
  AND `account_number` = '93492'
  AND `opening_balance_cents` = 31248048400;--> statement-breakpoint
UPDATE `bank_accounts`
SET `opening_balance_cents` = 312480484,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `bank_code` = '748'
  AND `bank_name` = 'SICREDI'
  AND `agency` = '3022'
  AND `account_number` = '93492'
  AND `opening_balance_cents` = 31248048400;
