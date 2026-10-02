import { eq } from "drizzle-orm";
import { appData } from "@/db/schema";
import { getDb } from "@/db";
import { ensureDatabase } from "./db-init";
const COOKIE_NAME = "ramen_teacher_session";
export async function isTeacherRequest(request: Request) {
  const token = (request.headers.get("cookie") ?? "").split(";").map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!token || !/^[a-f0-9-]{36}$/.test(token)) return false;
  try {
    await ensureDatabase();
    const db = await getDb();
    const [row] = await db.select().from(appData).where(eq(appData.key, `teacher-session:${token}`)).limit(1);
    return Boolean(row && Number(row.valueJson) > Date.now());
  } catch { return false; }
}
export async function teacherCookie() {
  await ensureDatabase();
  const token = crypto.randomUUID();
  const db = await getDb();
  await db.insert(appData).values({ key: `teacher-session:${token}`, valueJson: String(Date.now()+28800000) });
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`;
}
export async function clearTeacherCookie(request: Request) {
  const token = (request.headers.get("cookie") ?? "").split(";").map((x) => x.trim()).find((x) => x.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length+1);
  if (token && /^[a-f0-9-]{36}$/.test(token)) { const db = await getDb(); await db.delete(appData).where(eq(appData.key, `teacher-session:${token}`)); }
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;
}
export function isTeacherPassword(value: unknown) { return typeof value === "string" && value === "3035"; }
