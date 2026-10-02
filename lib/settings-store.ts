import { eq } from "drizzle-orm";
import { appData } from "@/db/schema";
import { getDb } from "@/db";
import { ensureDatabase } from "./db-init";
import { defaultSettings } from "./defaults";
import { normalizeSettings } from "./notebook";
import type { AppSettings } from "./types";
export async function readSettings() {
  await ensureDatabase();
  const db = await getDb();
  const [row] = await db.select().from(appData).where(eq(appData.key, "class-settings")).limit(1);
  return normalizeSettings(row ? JSON.parse(row.valueJson) as AppSettings : defaultSettings);
}
