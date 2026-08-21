CREATE TABLE `inventory_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`start_month` text NOT NULL,
	`opening_kilograms_milli` integer NOT NULL,
	`opening_value_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
