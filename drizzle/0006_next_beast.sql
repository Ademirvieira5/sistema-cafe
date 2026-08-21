ALTER TABLE `deals` ADD `contracted_kilograms_milli` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `received_kilograms_milli` integer;--> statement-breakpoint
ALTER TABLE `deals` ADD `commission_mode` text;--> statement-breakpoint
ALTER TABLE `deals` ADD `commission_value` text;--> statement-breakpoint
UPDATE `deals` SET `contracted_kilograms_milli`=`kilograms_milli` WHERE `contracted_kilograms_milli` IS NULL;--> statement-breakpoint
UPDATE `deals` SET `commission_mode`='AMOUNT', `commission_value`=printf('%.2f', `commission_amount_cents` / 100.0) WHERE `commission_mode` IS NULL;
