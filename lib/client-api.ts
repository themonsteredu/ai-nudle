import type { AppSettings, StudentProject } from "./types";
export class ApiError extends Error { constructor(message: string, public status: number) { super(message); } }
async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new ApiError(payload.error || "요청을 처리하지 못했습니다.", response.status);
  return payload;
}
export async function loadSettings(code?: string) {
  return parseResponse<{ settings: AppSettings }>(await fetch(`/api/settings${code ? `?code=${encodeURIComponent(code)}` : ""}`, { cache: "no-store" }));
}
export async function saveSettings(settings: AppSettings) {
  return parseResponse<{ settings: AppSettings }>(await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }) }));
}
export async function loadStudent(id: string, code = "", key = "") {
  return parseResponse<{ project: StudentProject | null }>(await fetch(`/api/students?id=${encodeURIComponent(id)}`, { cache: "no-store", headers: { "x-class-code": code, "x-student-key": key } }));
}
export async function saveStudent(project: StudentProject, code = "", key = "") {
  return parseResponse<{ project: StudentProject }>(await fetch("/api/students", { method: "POST", headers: { "Content-Type": "application/json", "x-class-code": code, "x-student-key": key }, body: JSON.stringify({ project }), keepalive: JSON.stringify(project).length < 55000 }));
}
export async function loadStudents(classId = "", code = "") {
  return parseResponse<{ projects: StudentProject[] }>(await fetch(`/api/students?classId=${encodeURIComponent(classId)}`, { cache: "no-store", headers: { "x-class-code": code } }));
}
