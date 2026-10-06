CREATE TABLE `farm_contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`receive_reports` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_farm` ON `farm_contacts` (`farm_id`);
