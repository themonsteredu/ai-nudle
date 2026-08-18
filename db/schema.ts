import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

export const appData = sqliteTable("app_data", {
  key: text("key").primaryKey(),
  valueJson: text("value_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const studentProjects = sqliteTable("student_projects", {
  id: text("id").primaryKey(),
  studentName: text("student_name").notNull(),
  teamName: text("team_name").notNull().default(""),
  dataJson: text("data_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const mediaAssets = sqliteTable("media_assets", {
  key: text("key").primaryKey(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
