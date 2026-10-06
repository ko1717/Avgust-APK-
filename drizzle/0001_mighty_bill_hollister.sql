CREATE TABLE `farms` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`zone` text NOT NULL,
	`contact` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `farm_invitations` (
	`token` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`role` text NOT NULL,
	`expires` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `farm_members` (
	`farm_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	PRIMARY KEY(`farm_id`, `user_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_members_user` ON `farm_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`farm_id` text NOT NULL,
	`owner` text NOT NULL,
	`revision` integer NOT NULL,
	`payload` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_requests_farm` ON `service_requests` (`farm_id`);--> statement-breakpoint
ALTER TABLE `photos` ADD `farm_id` text;--> statement-breakpoint
ALTER TABLE `visits` ADD `farm_id` text;