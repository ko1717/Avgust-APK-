CREATE TABLE `photos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`key` text NOT NULL,
	`mime` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_photos_owner` ON `photos` (`owner`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`farm` text NOT NULL,
	`date` text NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_visits_owner_date` ON `visits` (`owner`,`date`);