CREATE TABLE `inventory_month_closings` (
	`month` text PRIMARY KEY NOT NULL,
	`closing_kilograms_milli` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
