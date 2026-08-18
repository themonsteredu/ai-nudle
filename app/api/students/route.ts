import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { studentProjects } from "@/db/schema";
import { isTeacherRequest } from "@/lib/teacher-auth";
import { ensureDatabase } from "@/lib/db-init";
import type { StudentProject } from "@/lib/types";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    await ensureDatabase();
    const db = await getDb();
    if (id) {
      const [row] = await db
        .select()
        .from(studentProjects)
        .where(eq(studentProjects.id, id))
        .limit(1);
      if (!row) return Response.json({ project: null });
      return Response.json({ project: JSON.parse(row.dataJson) as StudentProject });
    }

    if (!isTeacherRequest(request)) {
      return Response.json({ error: "교사 인증이 필요합니다." }, { status: 401 });
    }

    const rows = await db
      .select()
      .from(studentProjects)
      .orderBy(desc(studentProjects.updatedAt));
    return Response.json({
      projects: rows.map((row) => JSON.parse(row.dataJson) as StudentProject),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록을 불러오지 못했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const payload = (await request.json()) as { project?: StudentProject };
    const project = payload.project;
    if (!project?.id || !project.studentName.trim()) {
      return Response.json({ error: "이름을 입력해 주세요." }, { status: 400 });
    }
    const updatedProject = { ...project, updatedAt: new Date().toISOString() };
    const db = await getDb();
    await db
      .insert(studentProjects)
      .values({
        id: updatedProject.id,
        studentName: updatedProject.studentName.trim(),
        teamName: updatedProject.teamName.trim(),
        dataJson: JSON.stringify(updatedProject),
        updatedAt: updatedProject.updatedAt,
      })
      .onConflictDoUpdate({
        target: studentProjects.id,
        set: {
          studentName: updatedProject.studentName.trim(),
          teamName: updatedProject.teamName.trim(),
          dataJson: JSON.stringify(updatedProject),
          updatedAt: updatedProject.updatedAt,
        },
      });
    return Response.json({ project: updatedProject });
  } catch (error) {
    const message = error instanceof Error ? error.message : "기록 저장에 실패했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
