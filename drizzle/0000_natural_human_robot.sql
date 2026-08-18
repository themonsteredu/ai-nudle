CREATE TABLE `app_data` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`key` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `student_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`student_name` text NOT NULL,
	`team_name` text DEFAULT '' NOT NULL,
	`data_json` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
