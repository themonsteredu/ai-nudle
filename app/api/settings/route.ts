import { appData } from "@/db/schema";
import { getDb } from "@/db";
import { readSettings } from "@/lib/settings-store";
import { isTeacherRequest } from "@/lib/teacher-auth";
import { normalizeSettings, studentSettings } from "@/lib/notebook";
import type { AppSettings } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const settings = await readSettings();
    if ((await isTeacherRequest(request)) && !new URL(request.url).searchParams.has("code")) return Response.json({ settings });
    const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase();
    const lesson = settings.classes?.find((x) => x.code === code);
    if (!lesson) return Response.json({ error: "선생님이 알려 주신 수업 코드를 확인해 주세요." }, { status: 404 });
    return Response.json({ settings: studentSettings(settings, lesson) });
  } catch {
    return Response.json({ error: "수업을 불러오지 못했습니다. 잠시 후 다시 눌러 주세요." }, { status: 503 });
  }
}
export async function PUT(request: Request) {
  if (!(await isTeacherRequest(request))) return Response.json({ error: "교사 인증이 필요합니다." }, { status: 401 });
  try {
    const { settings: raw } = await request.json() as { settings?: AppSettings };
    if (!raw || !Array.isArray(raw.ingredients) || !Array.isArray(raw.classes)) return Response.json({ error: "설정을 확인해 주세요." }, { status: 400 });
    const classes = raw.classes;
    if (new Set(classes.map((x) => x.code)).size !== classes.length || new Set(classes.map((x) => x.id)).size !== classes.length || classes.some((x) => !x.name.trim() || !/^[A-Z0-9]{6,12}$/.test(x.code) || !Number.isFinite(x.waterMl) || x.waterMl <= 0 || !Number.isFinite(x.cookMinutes) || x.cookMinutes <= 0 || !Number.isFinite(x.noodleFraction) || x.noodleFraction <= 0 || x.noodleFraction > 1)) return Response.json({ error: "반 이름, 중복 없는 수업 코드, 물 양과 조리 시간을 확인해 주세요." }, { status: 400 });
    const previous = await readSettings();
    // Class identity cannot be reused or removed: historical records must keep their classroom.
    if (previous.classes?.some((old) => !classes.some((x) => x.id === old.id && x.code === old.code))) return Response.json({ error: "기존 반과 수업 코드는 보존해 주세요. 새 수업은 반을 추가해 주세요." }, { status: 400 });
    const settings = normalizeSettings({ ...raw, version: previous.version + 1, updatedAt: new Date().toISOString() });
    const db = await getDb();
    await db.insert(appData).values({ key: "class-settings", valueJson: JSON.stringify(settings), updatedAt: settings.updatedAt }).onConflictDoUpdate({ target: appData.key, set: { valueJson: JSON.stringify(settings), updatedAt: settings.updatedAt } });
    return Response.json({ settings });
  } catch {
    return Response.json({ error: "설정을 저장하지 못했습니다. 다시 시도해 주세요." }, { status: 500 });
  }
}
