"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadSettings, loadStudents, saveSettings } from "@/lib/client-api";
import { defaultSettings } from "@/lib/defaults";
import type { AppSettings, StudentProject, SupplyCategory } from "@/lib/types";
import {
  ChecklistPanel,
  CostPanel,
  IngredientPanel,
  LabelsPanel,
  PdfPanel,
  SupplyPanel,
  ToppingPanel,
} from "./teacher/TeacherPanels";
import { ClassPanel } from "./teacher/ClassPanel";
import { StudentRecipesPanel } from "./teacher/StudentRecipesPanel";
import { CareerProcessPanel } from "./teacher/CareerProcessPanel";

type TeacherSection =
  | "classes"
  | "recipes"
  | "overview"
  | "career"
  | "lesson"
  | "ingredients"
  | "toppings"
  | "noodle"
  | "tasting"
  | "container"
  | "consumable"
  | "tool"
  | "cost"
  | "checklist"
  | "labels"
  | "pdf";

const NAV_GROUPS: { title: string; items: { id: TeacherSection; label: string }[] }[] = [
  { title: "수업 운영", items: [
    { id: "classes", label: "수업·반 설정" },
    { id: "overview", label: "수업 개요" },
    { id: "recipes", label: "학생 레시피 보기" },
    { id: "career", label: "직업소개·공정시연" },
    { id: "lesson", label: "2차시 수업지도안" },
  ] },
  { title: "재료 관리", items: [
    { id: "ingredients", label: "스프 재료 관리" },
    { id: "toppings", label: "건더기 관리" },
    { id: "noodle", label: "사리면 설정" },
    { id: "tasting", label: "시식컵 설정" },
    { id: "container", label: "최종 용기 설정" },
    { id: "consumable", label: "기타 소모품" },
    { id: "tool", label: "수업도구" },
  ] },
  { title: "원가", items: [
    { id: "cost", label: "원가 자동계산" },
  ] },
  { title: "출력", items: [
    { id: "checklist", label: "준비물 목록" },
    { id: "labels", label: "학생용 라벨" },
    { id: "pdf", label: "교사용 PDF" },
  ] },
];

const SUPPLY_SECTION: Partial<Record<TeacherSection, SupplyCategory>> = {
  noodle: "noodle",
  tasting: "tasting",
  container: "container",
  consumable: "consumable",
  tool: "tool",
};

export default function TeacherApp() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [section, setSection] = useState<TeacherSection>("classes");
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [classId, setClassId] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState("");
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [safetyChecked, setSafetyChecked] = useState<Record<number, boolean>>({});

  const setSettings = (next: AppSettings) => {
    setSettingsState(next);
    setDirty(true);
  };

  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const response = await fetch("/api/teacher/login", { cache: "no-store" });
        const payload = await response.json() as { authenticated: boolean };
        if (cancelled) return;
        setAuthenticated(payload.authenticated);
        if (payload.authenticated) await loadTeacherData();
      } catch {
        if (!cancelled) setAuthenticated(false);
      }
    }
    void check();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function loadTeacherData() {
    try {
      const loaded = await loadSettings();
      setSettingsState(loaded.settings);
      setClassId(loaded.settings.classes?.[0]?.id ?? "legacy");
    } catch {
      setSettingsState(defaultSettings);
      setNotice("기본 수업 설정으로 열었습니다. 저장소 연결 후 설정을 저장할 수 있어요.");
    }
    setDirty(false);
  }

  const refreshStudents = useCallback(async () => {
    if (!authenticated || !classId) return;
    setStudentsLoading(true);
    try { const data = await loadStudents(classId); setProjects(data.projects); setStudentsError(""); }
    catch { setStudentsError("학생 기록을 불러오지 못했습니다. 새로고침을 눌러 주세요."); }
    finally { setStudentsLoading(false); }
  }, [authenticated, classId]);
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      if (!authenticated || !classId) return;
      try { const data = await loadStudents(classId); if (!cancelled) { setProjects(data.projects); setStudentsError(""); } }
      catch { if (!cancelled) setStudentsError("학생 기록을 불러오지 못했습니다. 새로고침을 눌러 주세요."); }
    }
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [authenticated, classId]);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    const response = await fetch("/api/teacher/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const payload = await response.json() as { authenticated?: boolean; error?: string };
    if (!response.ok) {
      setLoginError(payload.error || "비밀번호를 확인해 주세요.");
      return;
    }
    setAuthenticated(true);
    setPassword("");
    await loadTeacherData();
  }

  async function logout() {
    await fetch("/api/teacher/login", { method: "DELETE" });
    setAuthenticated(false);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const result = await saveSettings(settings);
      setSettingsState(result.settings);
      setDirty(false);
      setNotice("교사 설정을 저장했습니다. 학생 화면에도 반영됩니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "설정을 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    setNotice("재료 사진을 업로드하고 있어요.");
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/upload", { method: "POST", body: form });
    const payload = await response.json() as { url?: string; error?: string };
    if (!response.ok || !payload.url) throw new Error(payload.error || "사진을 업로드하지 못했습니다.");
    setNotice("사진 업로드 완료. 상단 저장 버튼을 눌러 주세요.");
    return payload.url;
  }

  if (authenticated === null) {
    return <div className="teacher-loading"><span /> 교사용 페이지 확인 중</div>;
  }

  if (!authenticated) {
    return (
      <main className="teacher-gate">
        <Link href="/" className="back-student">← 학생 화면</Link>
        <form onSubmit={login}>
          <span className="gate-lock" aria-hidden="true" />
          <small>TEACHER ONLY</small>
          <h1>교사용 페이지</h1>
          <p>수업 설정과 출력물을 관리합니다.</p>
          <label><span>비밀번호</span><input type="password" inputMode="numeric" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus /></label>
          {loginError && <div className="login-error">{loginError}</div>}
          <button type="submit">입장하기</button>
        </form>
      </main>
    );
  }

  const supplyCategory = SUPPLY_SECTION[section];
  const visibleProjects = projects.filter((p) => classId === "legacy" ? !p.classId : p.classId === classId);
  return (
    <div className="teacher-shell">
      <aside className="teacher-sidebar">
        <Link href="/" className="teacher-brand"><span>FOOD R&amp;D</span><strong>교사용 관리센터</strong></Link>
        <nav>
          {NAV_GROUPS.map((group) => <div key={group.title}><span>{group.title}</span>{group.items.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>)}
        </nav>
        <button className="teacher-logout" onClick={logout}>잠금 후 나가기</button>
      </aside>

      <main className="teacher-main">
        <header className="teacher-topbar">
          <div><span>RAMEN R&amp;D LAB</span><label className="class-picker">수업 선택<select aria-label="수업 선택" value={classId} onChange={(e) => { setProjects([]); setClassId(e.target.value); }}>{settings.classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}<option value="legacy">반 정보 없는 이전 기록</option></select></label></div>
          <div className="save-area">{dirty && <i>저장하지 않은 변경</i>}<button onClick={saveAll} disabled={!dirty || saving}>{saving ? "저장 중" : "설정 저장"}</button></div>
        </header>

        {section === "classes" && <ClassPanel settings={settings} setSettings={setSettings} classId={classId} selectClass={(id) => { setProjects([]); setClassId(id); }} />}
        {section === "recipes" && <StudentRecipesPanel key={classId} projects={visibleProjects} settings={settings} classId={classId} refresh={refreshStudents} loading={studentsLoading} error={studentsError} />}
        {section === "overview" && (
          <OverviewPanel
            settings={settings}
            setSettings={setSettings}
            projects={visibleProjects}
            safetyChecked={safetyChecked}
            setSafetyChecked={setSafetyChecked}
          />
        )}
        {section === "career" && <CareerProcessPanel />}
        {section === "lesson" && <LessonPanel settings={settings} />}
        {section === "ingredients" && <IngredientPanel settings={settings} setSettings={setSettings} uploadImage={uploadImage} />}
        {section === "toppings" && <ToppingPanel settings={settings} setSettings={setSettings} uploadImage={uploadImage} />}
        {supplyCategory && <SupplyPanel settings={settings} setSettings={setSettings} category={supplyCategory} />}
        {section === "cost" && <CostPanel settings={settings} />}
        {section === "checklist" && <ChecklistPanel settings={settings} />}
        {section === "labels" && <LabelsPanel settings={settings} projects={visibleProjects} />}
        {section === "pdf" && <PdfPanel settings={settings} />}
      </main>
      {notice && <div className="toast teacher-toast" role="status">{notice}</div>}
    </div>
  );
}

function OverviewPanel({
  settings,
  setSettings,
  projects,
  safetyChecked,
  setSafetyChecked,
}: {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  projects: StudentProject[];
  safetyChecked: Record<number, boolean>;
  setSafetyChecked: (value: Record<number, boolean>) => void;
}) {
  const allergens = useMemo(() => Array.from(new Set([
    ...settings.ingredients.filter((item) => item.enabled && item.allergenChecked).flatMap((item) => [...(item.allergens ?? []), item.allergenOther ?? ""]),
    ...settings.toppings.filter((item) => item.enabled && item.allergenChecked).flatMap((item) => [...(item.allergens ?? []), item.allergenOther ?? ""]),
  ].map((item) => item.trim()).filter((item) => item && item !== "없음"))), [settings]);
  const labels = projects.filter((project) => project.notebook?.final || (project.bestRecipeIndex !== null && project.label.productName)).length;
  return (
    <section className="teacher-panel overview-panel">
      <header className="teacher-panel-head"><div><span>CLASS CONTROL</span><h1>수업 개요</h1><p>수업 인원과 안전 확인부터 먼저 준비하세요.</p></div></header>
      <div className="overview-strip">
        <label><span>학생 수</span><div><input type="number" min="1" max="300" value={settings.studentCount} onChange={(event) => setSettings({ ...settings, studentCount: Math.max(1, Number(event.target.value)) })} /><b>명</b></div></label>
        <label><span>라면 시식 횟수</span><div><input value={2} readOnly /><b>회</b></div></label>
        <label><span>시식용 면</span><div><input type="number" min="0.1" max="1" step="0.05" value={settings.tastingNoodleFraction} onChange={(event) => setSettings({ ...settings, tastingNoodleFraction: Number(event.target.value) })} /><b>개/회</b></div></label>
        <div><span>학생 기록</span><strong>{projects.length}</strong><small>라벨 완성 {labels}</small></div>
      </div>
      <div className="overview-columns">
        <section className="lesson-flow"><div><span>1차시</span><strong>기본 베이스로 맛 연구</strong></div><ol><li><b>01</b>식품개발연구원 이해</li><li><b>02</b>라면 제조공정</li><li><b>03</b>스프·건더기 역할</li><li><b>04</b>기본 베이스 국물 연습</li><li><b>05</b>라면사리 시식 1회</li></ol></section>
        <section className="lesson-flow orange"><div><span>2차시</span><strong>시판 스프를 나만의 맛으로</strong></div><ol><li><b>06</b>시판 스프 국물 연습</li><li><b>07</b>라면사리 시식 1회</li><li><b>08</b>내 레시피 선택</li><li><b>09</b>최종 스프·라벨</li><li><b>10</b>실제 제품 포장</li></ol></section>
      </div>
      <section className="safety-board">
        <header><div><span>SAFETY FIRST</span><h2>알레르기·안전 확인</h2></div><p>포장 확인된 알레르기: <strong>{allergens.join(", ") || "확인된 항목 없음 · 재료 관리에서 포장을 확인해 주세요"}</strong></p></header>
        <div>{settings.safetyChecks.map((item, index) => <label key={`${item}-${index}`} className={safetyChecked[index] ? "checked" : ""}><input type="checkbox" checked={Boolean(safetyChecked[index])} onChange={(event) => setSafetyChecked({ ...safetyChecked, [index]: event.target.checked })} /><span>{item}</span></label>)}</div>
      </section>
    </section>
  );
}

function LessonPanel({ settings }: { settings: AppSettings }) {
  const lesson1 = [
    ["도입", "식품개발연구원 역할과 오늘의 목표", "10분"],
    ["공정", "교사 발표로 살펴보는 제조공정", "10분"],
    ["LAB", "스프·건더기 역할 확인과 계량 안전", "10분"],
    ["국물 연습", "기본 베이스에 재료 추가 → 맛 기록", "20분"],
    ["라면 시식", "고른 레시피로 라면사리 시식 1회", "20분"],
  ];
  const lesson2 = [
    ["국물 연습", "시판 스프에 추가 재료 → 맛 기록", "15분"],
    ["라면 시식", "고른 레시피로 라면사리 시식 1회", "15분"],
    ["기록", "내 레시피와 맛 느낌 돌아보기", "10분"],
    ["선정", "마음에 드는 레시피 선택과 최종 계량", "20분"],
    ["제품", "라벨 제작·출력·실제 포장", "20분"],
  ];
  return (
    <section className="teacher-panel">
      <header className="teacher-panel-head"><div><span>LESSON PLAN</span><h1>2차시 수업지도안</h1><p>{settings.studentCount}명 기준 · 시간은 학교 수업에 맞게 조정</p></div><button className="teacher-primary" onClick={() => window.print()}>인쇄 / PDF</button></header>
      <div className="lesson-plan print-target">
        {[{ title: "1차시", subtitle: "연구원이 되어 첫 시제품 만들기", rows: lesson1 }, { title: "2차시", subtitle: "최종 제품을 결정하고 포장하기", rows: lesson2 }].map((lesson) => <section key={lesson.title}><header><span>{lesson.title}</span><h2>{lesson.subtitle}</h2></header><table><tbody>{lesson.rows.map((row, index) => <tr key={row[0]}><td>{String(index + 1).padStart(2, "0")}</td><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></section>)}
        <div className="lesson-note"><strong>수업 핵심</strong><p>웹앱은 맛을 채점하지 않습니다. 학생이 실제로 먹고 판단한 결과를 다음 배합에 반영하게 합니다.</p></div>
      </div>
    </section>
  );
}
