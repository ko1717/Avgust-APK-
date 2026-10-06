CREATE TABLE `report_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `farm_id` text NOT NULL REFERENCES `farms`(`id`),
  `visit_id` text NOT NULL REFERENCES `visits`(`id`),
  `version_number` integer NOT NULL,
  `status` text NOT NULL,
  `source_visit_revision` integer NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  `submitted_by` text,
  `submitted_at` text,
  `approved_by` text,
  `approved_at` text,
  `published_by` text,
  `published_at` text,
  `snapshot_json` text,
  `revision` integer NOT NULL DEFAULT 1,
  `updated_at` text NOT NULL,
  CONSTRAINT `report_versions_visit_version_unique` UNIQUE(`visit_id`,`version_number`),
  CONSTRAINT `report_versions_status_check` CHECK(`status` IN ('draft','in_review','approved','published')),
  CONSTRAINT `report_versions_number_check` CHECK(`version_number` > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_report_versions_farm_created` ON `report_versions` (`farm_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_report_versions_visit_status` ON `report_versions` (`visit_id`,`status`);
