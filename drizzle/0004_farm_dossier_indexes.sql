CREATE INDEX `idx_visits_farm_date` ON `visits` (`farm_id`,`date`);
--> statement-breakpoint
CREATE INDEX `idx_photos_farm` ON `photos` (`farm_id`);
