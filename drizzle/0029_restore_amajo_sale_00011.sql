INSERT INTO `audit_logs` (
  `id`,
  `entity_type`,
  `entity_id`,
  `action`,
  `before_data`,
  `after_data`,
  `created_at`
)
SELECT
  'repair-amajo-sale-00011-20260820',
  'Deal',
  `deals`.`id`,
  'DATA_REPAIR_AMAJO_00011',
  json_object(
    'kilogramsMilli', `deals`.`kilograms_milli`,
    'contractedKilogramsMilli', `deals`.`contracted_kilograms_milli`,
    'receivedKilogramsMilli', `deals`.`received_kilograms_milli`,
    'pricePerSackCents', `deals`.`price_per_sack_cents`,
    'grossAmountCents', `deals`.`gross_amount_cents`,
    'totalAmountCents', `deals`.`total_amount_cents`,
    'commissionAmountCents', `deals`.`commission_amount_cents`
  ),
  json_object(
    'kilogramsMilli', 6000000,
    'contractedKilogramsMilli', 6000000,
    'receivedKilogramsMilli', NULL,
    'pricePerSackCents', 115000,
    'grossAmountCents', 11500000,
    'totalAmountCents', 11500000
  ),
  CURRENT_TIMESTAMP
FROM `deals`
INNER JOIN `people` ON `people`.`id` = `deals`.`party_id`
WHERE `deals`.`sequence` = 11
  AND `deals`.`business_type` = 'SALE'
  AND `deals`.`status` = 'OPEN'
  AND (
    UPPER(`people`.`legal_name`) LIKE '%AMAJO%'
    OR UPPER(COALESCE(`people`.`trade_name`, '')) LIKE '%AMAJO%'
  )
  AND NOT EXISTS (
    SELECT 1 FROM `audit_logs`
    WHERE `audit_logs`.`id` = 'repair-amajo-sale-00011-20260820'
  );--> statement-breakpoint

UPDATE `deal_brokers`
SET
  `commission_amount_cents` = ROUND(11500000 * CAST(REPLACE(`commission_value`, ',', '.') AS REAL) / 100),
  `updated_at` = CURRENT_TIMESTAMP
WHERE `commission_mode` = 'PERCENT'
  AND `deal_id` IN (
    SELECT `deals`.`id`
    FROM `deals`
    INNER JOIN `people` ON `people`.`id` = `deals`.`party_id`
    WHERE `deals`.`sequence` = 11
      AND `deals`.`business_type` = 'SALE'
      AND `deals`.`status` = 'OPEN'
      AND (
        UPPER(`people`.`legal_name`) LIKE '%AMAJO%'
        OR UPPER(COALESCE(`people`.`trade_name`, '')) LIKE '%AMAJO%'
      )
  );--> statement-breakpoint

UPDATE `installments`
SET
  `amount_cents` = MAX(`paid_amount_cents`, 11500000),
  `updated_at` = CURRENT_TIMESTAMP
WHERE `deal_id` IN (
    SELECT `deals`.`id`
    FROM `deals`
    INNER JOIN `people` ON `people`.`id` = `deals`.`party_id`
    WHERE `deals`.`sequence` = 11
      AND `deals`.`business_type` = 'SALE'
      AND `deals`.`status` = 'OPEN'
      AND (
        UPPER(`people`.`legal_name`) LIKE '%AMAJO%'
        OR UPPER(COALESCE(`people`.`trade_name`, '')) LIKE '%AMAJO%'
      )
  )
  AND (
    SELECT COUNT(*) FROM `installments` AS `deal_installments`
    WHERE `deal_installments`.`deal_id` = `installments`.`deal_id`
  ) = 1;--> statement-breakpoint

UPDATE `deals`
SET
  `kilograms_milli` = 6000000,
  `contracted_kilograms_milli` = 6000000,
  `received_kilograms_milli` = NULL,
  `price_per_sack_cents` = 115000,
  `gross_amount_cents` = 11500000,
  `adjustment_amount_cents` = 0,
  `total_amount_cents` = 11500000,
  `commission_amount_cents` = COALESCE(
    (SELECT SUM(`deal_brokers`.`commission_amount_cents`)
     FROM `deal_brokers`
     WHERE `deal_brokers`.`deal_id` = `deals`.`id`),
    CASE
      WHEN `commission_mode` = 'PERCENT'
        THEN ROUND(11500000 * CAST(REPLACE(COALESCE(`commission_value`, '0'), ',', '.') AS REAL) / 100)
      ELSE `commission_amount_cents`
    END
  ),
  `updated_at` = CURRENT_TIMESTAMP
WHERE `sequence` = 11
  AND `business_type` = 'SALE'
  AND `status` = 'OPEN'
  AND `party_id` IN (
    SELECT `id` FROM `people`
    WHERE UPPER(`legal_name`) LIKE '%AMAJO%'
       OR UPPER(COALESCE(`trade_name`, '')) LIKE '%AMAJO%'
  );
