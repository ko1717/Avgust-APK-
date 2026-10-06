CREATE TABLE `audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `farm_id` text NOT NULL,
  `actor_id` text NOT NULL,
  `event` text NOT NULL,
  `subject_type` text NOT NULL,
  `subject_id` text NOT NULL,
  `details` text NOT NULL,
  `created` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_farm_created` ON `audit_events` (`farm_id`,`created`);
