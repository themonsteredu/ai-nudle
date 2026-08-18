import { getCloudflareEnv } from "@/lib/cloudflare-env";

let initialization: Promise<unknown> | null = null;

export async function ensureDatabase() {
  if (initialization) return initialization;
  const env = await getCloudflareEnv();
  const d1 = env.DB;
  if (!d1) throw new Error("Cloudflare D1 binding is unavailable.");
  initialization = d1.batch([
    d1.prepare(`CREATE TABLE IF NOT EXISTS app_data (
      key TEXT PRIMARY KEY NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS student_projects (
      id TEXT PRIMARY KEY NOT NULL,
      student_name TEXT NOT NULL,
      team_name TEXT DEFAULT '' NOT NULL,
      data_json TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
    d1.prepare(`CREATE TABLE IF NOT EXISTS media_assets (
      key TEXT PRIMARY KEY NOT NULL,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
    )`),
  ]);
  return initialization;
}
