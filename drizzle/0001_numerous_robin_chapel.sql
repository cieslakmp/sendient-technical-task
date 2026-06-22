PRAGMA foreign_keys=OFF;
--> statement-breakpoint

-- Recreate students without joined_at (SQLite cannot DROP COLUMN directly in this version)
CREATE TABLE `new_students` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`year_group` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
INSERT INTO `new_students` SELECT `id`, `name`, `year_group`, `created_at`, `deleted_at` FROM `students`;
--> statement-breakpoint
DROP TABLE `students`;
--> statement-breakpoint
ALTER TABLE `new_students` RENAME TO `students`;
--> statement-breakpoint

-- Recreate progress_records with RESTRICT instead of CASCADE on foreign keys
CREATE TABLE `new_progress_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`student_id` integer NOT NULL,
	`topic_id` integer NOT NULL,
	`score` real NOT NULL,
	`notes` text,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `new_progress_records` SELECT `id`, `student_id`, `topic_id`, `score`, `notes`, `recorded_at`, `created_at`, `deleted_at` FROM `progress_records`;
--> statement-breakpoint
DROP TABLE `progress_records`;
--> statement-breakpoint
ALTER TABLE `new_progress_records` RENAME TO `progress_records`;
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_per_student_topic_day` ON `progress_records` (`student_id`,`topic_id`,`recorded_at`);
--> statement-breakpoint

PRAGMA foreign_keys=ON;
