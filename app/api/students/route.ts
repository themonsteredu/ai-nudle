import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { studentProjects } from "@/db/schema";
import { isTeacherRequest } from "@/lib/teacher-auth";
import { readSettings } from "@/lib/settings-store";
import { sanitizeProject, validNotebook } from "@/lib/project-validation";
import type { StudentProject } from "@/lib/types";
type StoredProject = StudentProject & { ownerHash?: string };
async function hash(token: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))), (x) => x.toString(16).padStart(2, "0")).join("");
}
function publicProject(p: StoredProject) { const { ownerHash: _, ...project } = p; void _; return project; }
export async function GET(request: Request) {
  try {
    const settings = await readSettings();
    const url = new URL(request.url);
    const teacher = await isTeacherRequest(request);
    const classId = url.searchParams.get("classId");
    const code = request.headers.get("x-class-code")?.toUpperCase();
    const lesson = settings.classes?.find((x) => x.code === code);
    if (!teacher && !lesson) return Response.json({ error: "수업 코드를 확인해 주세요." }, { status: 403 });
    const db = await getDb();
    const id = url.searchParams.get("id");
    if (id) {
      const [row] = await db.select().from(studentProjects).where(eq(studentProjects.id, id)).limit(1);
      if (!row) return Response.json({ project: null });
      const project = JSON.parse(row.dataJson) as StoredProject;
      if (!teacher && (project.classId !== lesson?.id || project.ownerHash !== await hash(request.headers.get("x-student-key") ?? ""))) return Response.json({ error: "이 기기의 기록이 아닙니다." }, { status: 403 });
      return Response.json({ project: publicProject(project) });
    }
    // Filter by class in SQL before returning any record. Legacy rows remain a separate archive.
    const target = teacher ? classId : lesson!.id;
    if (!target) return Response.json({ projects: [] });
    const rows = await db.select().from(studentProjects).where(target === "legacy" ? sql`json_extract(${studentProjects.dataJson}, '$.classId') IS NULL` : eq(studentProjects.teamName, `class:${target}`)).orderBy(asc(studentProjects.id));
    let projects = rows.map((r) => JSON.parse(r.dataJson) as StoredProject).filter((p) => target === "legacy" ? !p.classId : p.classId === target).sort((a,b) => (a.createdAt ?? a.updatedAt).localeCompare(b.createdAt ?? b.updatedAt) || a.id.localeCompare(b.id));
    if (teacher) return Response.json({ projects: projects.map(publicProject) });
    projects = projects.filter((p) => p.notebook?.final?.shared);
    return Response.json({ projects: projects.map((p, i) => ({ id: `shared-${i}`, classId: p.classId, researcherNumber: p.researcherNumber, studentName: "", teamName: "", experiments: [], bestRecipeIndex: null, label: { productName: "", tasteLine: "", developerName: "" }, updatedAt: p.updatedAt, notebook: { base: { practices: [], tastingHistory: [] }, commercial: { practices: [], tastingHistory: [] }, comparisons: {}, final: p.notebook!.final } })) });
  } catch { return Response.json({ error: "기록을 불러오지 못했습니다." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 750000) return Response.json({ error: "기록 크기가 너무 큽니다." }, { status: 413 });
    const { project: raw } = JSON.parse(text) as { project: StudentProject };
    const key = request.headers.get("x-student-key") ?? "";
    if (!raw || !/^[\w-]{10,100}$/.test(raw.id) || key.length < 24 || !raw.notebook || !validNotebook(raw.notebook)) return Response.json({ error: "기록 내용을 확인해 주세요." }, { status: 400 });
    const settings = await readSettings();
    const lesson = settings.classes?.find((x) => x.id === raw.classId && x.code === request.headers.get("x-class-code")?.toUpperCase());
    if (!lesson) return Response.json({ error: "수업이 맞는지 확인해 주세요." }, { status: 403 });
    const db = await getDb();
    const [row] = await db.select().from(studentProjects).where(eq(studentProjects.id, raw.id)).limit(1);
    const old = row ? JSON.parse(row.dataJson) as StoredProject : undefined;
    const ownerHash = await hash(key);
    if (old && (old.ownerHash !== ownerHash || old.classId !== lesson.id)) return Response.json({ error: "이 기록을 변경할 수 없습니다." }, { status: 403 });
    if ((raw.revision ?? 0) !== (old?.revision ?? 0)) return Response.json({ error: "다른 창에서 저장한 기록이 있습니다. 현재 내용을 내려받은 뒤 다시 열어 주세요." }, { status: 409 });
    const now = new Date().toISOString();
    const project: StoredProject = { ...sanitizeProject(raw), ownerHash, classId: lesson.id, revision: (old?.revision ?? 0) + 1, createdAt: old?.createdAt ?? now, updatedAt: now };
    // An atomic counter allocates a stable anonymous number, including simultaneous joins.
    if (old?.researcherNumber) project.researcherNumber = old.researcherNumber;
    else {
      const { appData } = await import("@/db/schema");
      const { sql } = await import("drizzle-orm");
      const [counter] = await db.insert(appData).values({ key: `counter:${lesson.id}`, valueJson: "1" }).onConflictDoUpdate({ target: appData.key, set: { valueJson: sql`CAST(CAST(${appData.valueJson} AS INTEGER) + 1 AS TEXT)` } }).returning();
      project.researcherNumber = Number(counter.valueJson);
    }
    // Preserve ingredient/allergen snapshots on the server, never trust student-supplied safety claims.
    const catalog = [...settings.ingredients, ...settings.toppings, ...(settings.comparisonSoups ?? []).map((x,i) => ({ ...x, displayName: `스프 ${String.fromCharCode(65+i)}` }))];
    const oldRecords = old?.notebook ? [...old.notebook.base.practices, ...old.notebook.commercial.practices, ...old.notebook.base.tastingHistory, ...old.notebook.commercial.tastingHistory, old.notebook.base.tasting, old.notebook.commercial.tasting, old.notebook.final?.record].filter(Boolean) : [];
    const n = project.notebook!;
    for (const record of [...n.base.practices, ...n.commercial.practices, ...n.base.tastingHistory, ...n.commercial.tastingHistory, n.base.tasting, n.commercial.tasting, n.final?.record]) if (record) {
      record.items = record.items.map((item) => {
        const current = catalog.find((x) => x.id === item.id);
        const previous = oldRecords.flatMap((x) => x!.items).find((x) => x.id === item.id);
        const source = current ?? previous;
        return { ...item, name: previous?.name ?? (current && "displayName" in current ? current.displayName : item.name), allergens: source?.allergens ?? [], allergenChecked: source?.allergenChecked === true, allergenOther: source?.allergenOther ?? "", facilityNote: source?.facilityNote ?? "" };
      });
    }
    const values = { studentName: "", teamName: `class:${lesson.id}`, dataJson: JSON.stringify(project), updatedAt: now };
    if (row) {
      const updated = await db.update(studentProjects).set(values).where(and(eq(studentProjects.id, project.id), eq(studentProjects.dataJson, row.dataJson))).returning({ id: studentProjects.id });
      if (!updated.length) return Response.json({ error: "저장이 겹쳤습니다. 현재 내용을 내려받은 뒤 다시 열어 주세요." }, { status: 409 });
    } else {
      const inserted = await db.insert(studentProjects).values({ id: project.id, ...values }).onConflictDoNothing().returning({ id: studentProjects.id });
      if (!inserted.length) return Response.json({ error: "다른 창에서 먼저 저장했습니다. 기록을 다시 열어 주세요." }, { status: 409 });
    }
    return Response.json({ project: publicProject(project) });
  } catch { return Response.json({ error: "서버에 저장하지 못했습니다. 이 기기의 기록은 유지됩니다." }, { status: 503 }); }
}
