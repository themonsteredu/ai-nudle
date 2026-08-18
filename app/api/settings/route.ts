import { eq } from "drizzle-orm";
import { appData } from "@/db/schema";
import { getDb } from "@/db";
import { defaultSettings } from "@/lib/defaults";
import { ensureDatabase } from "@/lib/db-init";
import { isTeacherRequest } from "@/lib/teacher-auth";
import type { AppSettings } from "@/lib/types";

const SETTINGS_KEY = "class-settings";

export async function GET() {
  try {
    await ensureDatabase();
    const db = await getDb();
    const [row] = await db
      .select()
      .from(appData)
      .where(eq(appData.key, SETTINGS_KEY))
      .limit(1);

    if (!row) return Response.json({ settings: defaultSettings });
    return Response.json({ settings: JSON.parse(row.valueJson) as AppSettings });
  } catch {
    return Response.json({ settings: defaultSettings, storage: "fallback" });
  }
}

export async function PUT(request: Request) {
  if (!isTeacherRequest(request)) {
    return Response.json({ error: "교사 인증이 필요합니다." }, { status: 401 });
  }

  try {
    await ensureDatabase();
    const payload = (await request.json()) as { settings?: AppSettings };
    if (!payload.settings || !Array.isArray(payload.settings.ingredients)) {
      return Response.json({ error: "설정 데이터가 올바르지 않습니다." }, { status: 400 });
    }

    const settings: AppSettings = {
      ...payload.settings,
      version: (payload.settings.version || 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    const db = await getDb();
    await db
      .insert(appData)
      .values({
        key: SETTINGS_KEY,
        valueJson: JSON.stringify(settings),
        updatedAt: settings.updatedAt,
      })
      .onConflictDoUpdate({
        target: appData.key,
        set: {
          valueJson: JSON.stringify(settings),
          updatedAt: settings.updatedAt,
        },
      });

    return Response.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "설정 저장에 실패했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
