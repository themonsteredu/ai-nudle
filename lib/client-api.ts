import type { AppSettings, StudentProject } from "./types";

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  return payload;
}

export async function loadSettings() {
  const response = await fetch("/api/settings", { cache: "no-store" });
  return parseResponse<{ settings: AppSettings }>(response);
}

export async function saveSettings(settings: AppSettings) {
  const response = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  return parseResponse<{ settings: AppSettings }>(response);
}

export async function loadStudent(id: string) {
  const response = await fetch(`/api/students?id=${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  return parseResponse<{ project: StudentProject | null }>(response);
}

export async function saveStudent(project: StudentProject) {
  const response = await fetch("/api/students", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  return parseResponse<{ project: StudentProject }>(response);
}

export async function loadStudents() {
  const response = await fetch("/api/students", { cache: "no-store" });
  return parseResponse<{ projects: StudentProject[] }>(response);
}
