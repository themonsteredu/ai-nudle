"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, loadSettings, loadStudent, saveStudent } from "@/lib/client-api";
import { newProject } from "@/lib/notebook";
import { defaultSettings } from "@/lib/defaults";
import type { AppSettings, StudentProject } from "@/lib/types";
type LocalSession = { project: StudentProject; key: string; code: string; dirty: boolean };
const localKey = (id: string) => `ramen-notebook:${id}`;
export function useNotebookSession() {
  const [project, setProject] = useState<StudentProject | null>(null);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [status, setStatus] = useState("");
  const [activeCode, setActiveCode] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef<LocalSession | null>(null);
  const saving = useRef(false);
  const blocked = useRef(false);
  const saveLocal = useCallback((session: LocalSession) => {
    try { localStorage.setItem(localKey(session.project.id), JSON.stringify(session)); }
    catch { setStatus("기기 저장 공간이 부족합니다. 기록 내려받기를 눌러 주세요."); }
  }, []);
  const flush = useCallback(async () => {
    const session = active.current;
    if (!session || !session.dirty || saving.current || blocked.current) return;
    saving.current = true;
    setStatus("저장 중");
    const sent = session.project;
    try {
      const { project: saved } = await saveStudent(sent, session.code, session.key);
      if (active.current !== session) return;
      const dirty = session.project !== sent;
      session.project = { ...session.project, revision: saved.revision, researcherNumber: saved.researcherNumber, createdAt: saved.createdAt };
      session.dirty = dirty;
      saveLocal(session);
      setProject(session.project);
      setStatus(dirty ? "기기에 저장됨 · 서버 저장 대기" : "자동 저장됨");
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.status === 403)) blocked.current = true;
      setStatus(error instanceof ApiError && blocked.current ? error.message : "기기에 저장됨 · 연결되면 다시 저장해요");
    } finally { saving.current = false; }
  }, [saveLocal]);
  useEffect(() => {
    const timer = window.setInterval(() => void flush(), 1200);
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    window.addEventListener("online", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => { clearInterval(timer); window.removeEventListener("online", flush); document.removeEventListener("visibilitychange", onHide); };
  }, [flush]);
  useEffect(() => {
    const timer = window.setInterval(async () => {
      const session = active.current;
      if (!session) return;
      try { const loaded = await loadSettings(session.code); if (active.current === session) setSettings(loaded.settings); } catch { /* Preserve loaded lesson offline. */ }
    }, 12000);
    return () => clearInterval(timer);
  }, []);
  async function join(codeInput: string, fresh = false) {
    setBusy(true); setStatus("");
    try {
      const code = codeInput.trim().toUpperCase();
      if (fresh && active.current?.dirty) {
        await flush();
        if (active.current?.dirty) throw new Error("현재 기록이 서버에 저장된 뒤 다른 학생을 시작해 주세요. 기록 내려받기로 보관할 수도 있어요.");
      }
      let loaded: { settings: AppSettings };
      try { loaded = await loadSettings(code); localStorage.setItem(`ramen-lesson:${code}`, JSON.stringify(loaded)); }
      catch (error) {
        const cached = localStorage.getItem(`ramen-lesson:${code}`);
        if (!cached || (error instanceof ApiError && error.status !== 503)) throw error;
        loaded = JSON.parse(cached);
      }
      const lesson = loaded.settings.classes?.[0];
      if (!lesson) throw new Error("선생님께 수업 코드를 확인해 주세요.");
      const activeId = fresh ? null : localStorage.getItem(`ramen-active:${lesson.id}`);
      const savedText = activeId ? localStorage.getItem(localKey(activeId)) : null;
      let session: LocalSession = savedText ? JSON.parse(savedText) : { project: newProject(lesson), key: crypto.randomUUID(), code, dirty: true };
      session.code = code;
      blocked.current = false;
      if (savedText) {
        try {
          const remote = await loadStudent(session.project.id, code, session.key);
          if (remote.project && !session.dirty) session = { ...session, project: remote.project };
          else if (remote.project && session.project.revision !== remote.project.revision) {
            blocked.current = true;
            setStatus("다른 창의 기록과 겹칩니다. 현재 기록을 내려받은 뒤 다시 열어 주세요.");
          }
        } catch (error) { if (error instanceof ApiError && error.status === 403) throw error; }
      }
      active.current = session;
      saveLocal(session);
      localStorage.setItem(`ramen-active:${lesson.id}`, session.project.id);
      setSettings(loaded.settings); setProject(session.project); setActiveCode(code);
      if (!blocked.current) setStatus(session.dirty ? "기기에 저장됨 · 서버 저장 대기" : "자동 저장됨");
    } catch (error) { setStatus(error instanceof Error ? error.message : "수업을 열지 못했습니다."); }
    finally { setBusy(false); }
  }
  function update(next: StudentProject) {
    if (!active.current) return;
    active.current.project = { ...next, updatedAt: new Date().toISOString() };
    active.current.dirty = true;
    saveLocal(active.current);
    setProject(active.current.project);
    if (!blocked.current) setStatus("기기에 저장됨 · 서버 저장 대기");
  }
  function exportDraft() {
    if (!project) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(project, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "라면-연구기록.json"; a.click(); URL.revokeObjectURL(url);
  }
  return { project, settings, status, busy, join, update, flush, exportDraft, code: activeCode, leave: () => { void flush(); active.current = null; setProject(null); setStatus(""); setActiveCode(""); } };
}
