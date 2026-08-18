"use client";

import { useEffect, useMemo, useState } from "react";
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
import { CareerProcessPanel } from "./teacher/CareerProcessPanel";

type TeacherSection =
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
    { id: "overview", label: "수업 개요" },
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
  const [section, setSection] = useState<TeacherSection>("overview");
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
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
    } catch {
      setSettingsState(defaultSettings);
      setNotice("기본 수업 설정으로 열었습니다. 저장소 연결 후 설정을 저장할 수 있어요.");
    }
    setDirty(false);
    try {
      const studentData = await loadStudents();
      setProjects(studentData.projects);
    } catch {
      setProjects([]);
    }
  }

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
          <div><span>RAMEN R&amp;D LAB</span><strong>{settings.className}</strong></div>
          <div className="save-area">{dirty && <i>저장하지 않은 변경</i>}<button onClick={saveAll} disabled={!dirty || saving}>{saving ? "저장 중" : "설정 저장"}</button></div>
        </header>

        {section === "overview" && (
          <OverviewPanel
            settings={settings}
            setSettings={setSettings}
            projects={projects}
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
        {section === "labels" && <LabelsPanel settings={settings} projects={projects} />}
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
    ...settings.ingredients.filter((item) => item.enabled).flatMap((item) => item.allergen.split(",")),
    ...settings.toppings.filter((item) => item.enabled).flatMap((item) => item.allergen.split(",")),
  ].map((item) => item.trim()).filter((item) => item && item !== "없음"))), [settings]);
  const labels = projects.filter((project) => project.bestRecipeIndex !== null && project.label.productName).length;
  return (
    <section className="teacher-panel overview-panel">
      <header className="teacher-panel-head"><div><span>CLASS CONTROL</span><h1>수업 개요</h1><p>수업 인원과 안전 확인부터 먼저 준비하세요.</p></div></header>
      <div className="overview-strip">
        <label><span>학생 수</span><div><input type="number" min="1" max="300" value={settings.studentCount} onChange={(event) => setSettings({ ...settings, studentCount: Math.max(1, Number(event.target.value)) })} /><b>명</b></div></label>
        <label><span>TEST 횟수</span><div><input value={settings.testCount} readOnly /><b>회</b></div></label>
        <label><span>시식용 면</span><div><input type="number" min="0.1" max="1" step="0.05" value={settings.tastingNoodleFraction} onChange={(event) => setSettings({ ...settings, tastingNoodleFraction: Number(event.target.value) })} /><b>개/회</b></div></label>
        <div><span>학생 기록</span><strong>{projects.length}</strong><small>라벨 완성 {labels}</small></div>
      </div>
      <div className="overview-columns">
        <section className="lesson-flow"><div><span>1차시</span><strong>공정을 알고 첫 배합 시작</strong></div><ol><li><b>01</b>식품개발연구원 이해</li><li><b>02</b>라면 제조공정</li><li><b>03</b>스프·건더기 역할</li><li><b>04</b>TEST R-01</li><li><b>05</b>TEST R-02</li></ol></section>
        <section className="lesson-flow orange"><div><span>2차시</span><strong>비교하고 실제 제품 완성</strong></div><ol><li><b>06</b>TEST R-03</li><li><b>07</b>TEST R-04</li><li><b>08</b>레시피 비교·선정</li><li><b>09</b>최종 스프·라벨</li><li><b>10</b>실제 제품 포장</li></ol></section>
      </div>
      <section className="safety-board">
        <header><div><span>SAFETY FIRST</span><h2>알레르기·안전 확인</h2></div><p>현재 알레르기 표시: <strong>{allergens.join(", ") || "등록된 항목 없음"}</strong></p></header>
        <div>{settings.safetyChecks.map((item, index) => <label key={`${item}-${index}`} className={safetyChecked[index] ? "checked" : ""}><input type="checkbox" checked={Boolean(safetyChecked[index])} onChange={(event) => setSafetyChecked({ ...safetyChecked, [index]: event.target.checked })} /><span>{item}</span></label>)}</div>
      </section>
    </section>
  );
}

function LessonPanel({ settings }: { settings: AppSettings }) {
  const lesson1 = [
    ["도입", "식품개발연구원 역할과 오늘의 목표", "10분"],
    ["공정", "원료 배합부터 품질검사까지 단계 체험", "20분"],
    ["LAB", "스프·건더기 역할 확인과 계량 안전", "10분"],
    ["R-01", "첫 배합 → 실제 시식 → 한 줄 기록", "20분"],
    ["R-02", "수정 배합 → 실제 시식 → 기록", "20분"],
  ];
  const lesson2 = [
    ["R-03", "이전 기록을 보고 세 번째 배합", "15분"],
    ["R-04", "최종 후보 배합과 시식", "15분"],
    ["비교", "4개 레시피를 나란히 비교", "10분"],
    ["선정", "BEST RECIPE 결정과 최종 스프 계량", "20분"],
    ["제품", "라벨 제작·출력·실제 포장", "20분"],
  ];
  return (
    <section className="teacher-panel">
      <header className="teacher-panel-head"><div><span>LESSON PLAN</span><h1>2차시 수업지도안</h1><p>{settings.studentCount}명 기준 · 차시당 80분 예시</p></div><button className="teacher-primary" onClick={() => window.print()}>인쇄 / PDF</button></header>
      <div className="lesson-plan print-target">
        {[{ title: "1차시", subtitle: "연구원이 되어 첫 시제품 만들기", rows: lesson1 }, { title: "2차시", subtitle: "최종 제품을 결정하고 포장하기", rows: lesson2 }].map((lesson) => <section key={lesson.title}><header><span>{lesson.title}</span><h2>{lesson.subtitle}</h2></header><table><tbody>{lesson.rows.map((row, index) => <tr key={row[0]}><td>{String(index + 1).padStart(2, "0")}</td><th>{row[0]}</th><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></section>)}
        <div className="lesson-note"><strong>수업 핵심</strong><p>웹앱은 맛을 채점하지 않습니다. 학생이 실제로 먹고 판단한 결과를 다음 배합에 반영하게 합니다.</p></div>
      </div>
    </section>
  );
}
