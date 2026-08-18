"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  createStudentProject,
  defaultSettings,
  normalizeProject,
} from "@/lib/defaults";
import { loadSettings, loadStudent, saveStudent } from "@/lib/client-api";
import { createId } from "@/lib/ids";
import type { AppSettings, StudentProject } from "@/lib/types";
import { TasteView, CompareView } from "./student/TasteCompare";
import { BestRecipeView, LabelView } from "./student/RecipeLabel";
import { FactoryExperience } from "./student/FactoryExperience";

export type StudentSection =
  | "home"
  | "process"
  | "lab"
  | "tests"
  | "compare"
  | "best"
  | "label";

const MENU: { id: StudentSection; label: string; mark: string }[] = [
  { id: "home", label: "홈", mark: "01" },
  { id: "process", label: "라면 제조 공정", mark: "02" },
  { id: "lab", label: "스프 배합 LAB", mark: "03" },
  { id: "tests", label: "테스트 실험", mark: "04" },
  { id: "compare", label: "레시피 비교", mark: "05" },
  { id: "best", label: "나의 레시피", mark: "06" },
  { id: "label", label: "제품 라벨 만들기", mark: "07" },
];

const STUDENT_ID_KEY = "ramen-rd-student-id";

export const grams = (value: number) => `${Number(value.toFixed(2))}g`;
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number(value.toFixed(3))));

export default function StudentApp() {
  const [section, setSection] = useState<StudentSection>("home");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [project, setProject] = useState<StudentProject>(() =>
    createStudentProject(defaultSettings, "loading"),
  );
  const [currentTest, setCurrentTest] = useState(0);
  const [started, setStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [allergenOpen, setAllergenOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const { settings: loaded } = await loadSettings();
        if (cancelled) return;
        setSettings(loaded);
        let id = window.localStorage.getItem(STUDENT_ID_KEY);
        if (!id) {
          id = createId("student");
          window.localStorage.setItem(STUDENT_ID_KEY, id);
        }
        const { project: saved } = await loadStudent(id);
        if (cancelled) return;
        const next = saved
          ? normalizeProject(saved, loaded)
          : createStudentProject(loaded, id);
        setProject(next);
        setStarted(Boolean(next.studentName));
      } catch {
        const id = createId("student");
        window.localStorage.setItem(STUDENT_ID_KEY, id);
        setProject(createStudentProject(defaultSettings, id));
        setNotice("연결을 확인하는 동안 화면의 내용을 유지합니다.");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(async () => {
      try {
        const { settings: latest } = await loadSettings();
        setSettings((current) => {
          if (current.version === latest.version && current.updatedAt === latest.updatedAt) return current;
          setProject((existing) => normalizeProject(existing, latest));
          return latest;
        });
      } catch { /* keep current lesson state */ }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [ready]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [section]);

  const ingredients = useMemo(
    () => settings.ingredients.filter((item) => item.enabled).sort((a, b) => a.order - b.order),
    [settings.ingredients],
  );
  const savedCount = project.experiments.filter((item) => item.saved).length;
  const finalScale = 1 / (settings.tastingNoodleFraction || 0.25);
  const bestExperiment = project.bestRecipeIndex === null
    ? null
    : project.experiments[project.bestRecipeIndex] ?? null;

  async function persist(next: StudentProject, message: string) {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    setProject(updated);
    try {
      const result = await saveStudent(updated);
      setProject(result.project);
      setNotice(message);
    } catch {
      setNotice("저장 연결을 확인해 주세요. 화면의 내용은 유지됩니다.");
    }
  }

  function startResearch() {
    if (!project.studentName.trim()) {
      setNotice("연구원 이름을 입력해 주세요.");
      return;
    }
    const next = {
      ...project,
      studentName: project.studentName.trim(),
      label: {
        ...project.label,
        developerName: project.label.developerName || project.studentName.trim(),
      },
    };
    setStarted(true);
    void persist(next, "연구원 등록 완료");
    setSection("process");
  }

  function changeAmount(ingredientId: string, direction: -1 | 1) {
    const ingredient = settings.ingredients.find((item) => item.id === ingredientId);
    if (!ingredient) return;
    setProject((current) => {
      const experiments = [...current.experiments];
      const experiment = { ...experiments[currentTest] };
      const recipe = { ...experiment.recipe };
      recipe[ingredientId] = clamp(
        (recipe[ingredientId] ?? ingredient.defaultAmount) + ingredient.step * direction,
        ingredient.minAmount,
        ingredient.maxAmount,
      );
      experiments[currentTest] = { ...experiment, recipe, saved: false };
      return { ...current, experiments };
    });
  }

  function saveExperiment() {
    if (!started) {
      setSection("home");
      setNotice("먼저 연구원 이름을 등록해 주세요.");
      return;
    }
    const experiments = [...project.experiments];
    experiments[currentTest] = { ...experiments[currentTest], saved: true };
    void persist(
      { ...project, experiments },
      `TEST R-${String(currentTest + 1).padStart(2, "0")} 배합 저장 완료`,
    );
  }

  function saveTasteRecord(index: number) {
    const experiments = [...project.experiments];
    experiments[index] = { ...experiments[index], saved: true };
    void persist({ ...project, experiments }, "시식 기록을 저장했어요.");
  }

  return (
    <div className="student-shell">
      <aside className="student-sidebar" aria-label="학생 메뉴">
        <button className="brand" onClick={() => setSection("home")}>
          <span className="brand-kicker">FOOD R&amp;D</span>
          <strong>라면 연구소</strong>
        </button>
        <nav className="student-nav">
          {MENU.map((item) => (
            <button
              key={item.id}
              className={section === item.id ? "active" : ""}
              onClick={() => setSection(item.id)}
            >
              <span>{item.mark}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-progress">
          <span>실험 기록</span><strong>{savedCount} / {settings.testCount}</strong>
          <div><i style={{ width: `${(savedCount / settings.testCount) * 100}%` }} /></div>
        </div>
        <Link className="teacher-link" href="/teacher">
          <span className="lock-mark" aria-hidden="true" /> 교사용 페이지
        </Link>
      </aside>

      <main className={`student-main section-${section}`}>
        {!ready ? <div className="loading-screen"><span /> 연구소 준비 중</div> : (
          <>
            {section !== "home" && (
              <header className="student-topbar">
                <div><span className="eyebrow">식품개발연구원 체험</span><strong>{project.studentName || "연구원 등록 전"}</strong></div>
                <button className="allergen-button" onClick={() => setAllergenOpen(true)}>알레르기 확인</button>
              </header>
            )}
            {section === "home" && (
              <HomeCover project={project} setProject={setProject} started={started} onStart={startResearch} />
            )}
            {section === "process" && <FactoryExperience onComplete={() => setSection("lab")} />}
            {section === "lab" && project.experiments[currentTest] && (
              <LabView
                settings={settings}
                project={project}
                currentTest={currentTest}
                setCurrentTest={setCurrentTest}
                ingredients={ingredients}
                changeAmount={changeAmount}
                saveExperiment={saveExperiment}
                onTaste={() => setSection("tests")}
              />
            )}
            {section === "tests" && (
              <TasteView
                project={project}
                setProject={setProject}
                currentTest={currentTest}
                setCurrentTest={setCurrentTest}
                ingredients={ingredients}
                saveTasteRecord={saveTasteRecord}
                onReturnLab={() => setSection("lab")}
                onCompare={() => setSection("compare")}
              />
            )}
            {section === "compare" && <CompareView project={project} ingredients={ingredients} onBest={() => setSection("best")} />}
            {section === "best" && (
              <BestRecipeView
                project={project}
                ingredients={ingredients}
                finalScale={finalScale}
                selectBest={(index) => void persist({ ...project, bestRecipeIndex: index }, `R-${String(index + 1).padStart(2, "0")}을 BEST RECIPE로 선택했어요.`)}
                onLabel={() => setSection("label")}
              />
            )}
            {section === "label" && (
              <LabelView
                project={project}
                setProject={setProject}
                ingredients={ingredients}
                bestExperiment={bestExperiment}
                finalScale={finalScale}
                persist={persist}
              />
            )}
          </>
        )}
      </main>

      {notice && <div className="toast" role="status">{notice}</div>}
      {allergenOpen && (
        <div className="modal-backdrop" onMouseDown={() => setAllergenOpen(false)}>
          <section className="simple-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setAllergenOpen(false)} aria-label="닫기">×</button>
            <span className="eyebrow">현재 사용 재료</span><h2>알레르기 정보</h2>
            <div className="allergen-list">
              {ingredients.map((item) => <div key={item.id}><strong>{item.displayName}</strong><span>{item.allergen || "정보 없음"}</span></div>)}
            </div>
            <p className="safety-note">시식 전 반드시 교사에게 개인 알레르기를 알려 주세요.</p>
          </section>
        </div>
      )}
    </div>
  );
}

function HomeCover({ project, setProject, started, onStart }: {
  project: StudentProject;
  setProject: (project: StudentProject) => void;
  started: boolean;
  onStart: () => void;
}) {
  const [formOpen, setFormOpen] = useState(!started);
  return (
    <section className="cover-screen">
      <div className="cover-copy">
        <span className="cover-kicker">식품개발연구원 체험 프로젝트</span>
        <h1>라면 공정 체험</h1>
        <p>라면이 만들어지는 과정을 알아보고<br />나만의 신제품 라면을 개발해요!</p>
      </div>
      <div className="hero-image-wrap">
        <img src="/ramen-hero.webp" alt="따뜻한 국물과 면이 담긴 라면 한 그릇" />
        <span className="hero-stamp">R&amp;D<br />LAB</span>
      </div>
      {!formOpen ? (
        <button className="primary-cta" onClick={() => setFormOpen(true)}>{started ? "이어서 시작하기" : "시작하기"} <span>▶</span></button>
      ) : (
        <div className="researcher-form">
          <label><span>연구원 이름</span><input value={project.studentName} onChange={(event) => setProject({ ...project, studentName: event.target.value })} placeholder="이름을 입력하세요" maxLength={20} autoFocus /></label>
          <label><span>개발팀명 <small>선택</small></span><input value={project.teamName} onChange={(event) => setProject({ ...project, teamName: event.target.value })} placeholder="예: 매운맛 연구팀" maxLength={24} /></label>
          <button className="primary-cta compact" onClick={onStart}>연구 시작 <span>→</span></button>
        </div>
      )}
    </section>
  );
}

function LabView({ settings, project, currentTest, setCurrentTest, ingredients, changeAmount, saveExperiment, onTaste }: {
  settings: AppSettings;
  project: StudentProject;
  currentTest: number;
  setCurrentTest: (value: number) => void;
  ingredients: AppSettings["ingredients"];
  changeAmount: (id: string, direction: -1 | 1) => void;
  saveExperiment: () => void;
  onTaste: () => void;
}) {
  const experiment = project.experiments[currentTest];
  const total = ingredients.reduce((sum, item) => sum + (experiment.recipe[item.id] ?? 0), 0);
  return (
    <section className="content-stage lab-stage">
      <div className="page-heading"><div><span className="eyebrow">FORMULA LAB</span><h1>스프 배합 LAB</h1></div><p>정답은 없어요. 직접 먹어보고 바꿔요.</p></div>
      <div className="test-tabs">{project.experiments.map((item, testIndex) => <button key={testIndex} className={currentTest === testIndex ? "active" : ""} onClick={() => setCurrentTest(testIndex)}><span>TEST</span> R-{String(testIndex + 1).padStart(2, "0")} {item.saved && <i>저장됨</i>}</button>)}</div>
      <div className="lab-board">
        <div className="ingredient-list">
          {ingredients.map((item) => {
            const amount = experiment.recipe[item.id] ?? item.defaultAmount;
            return <div className="ingredient-row" key={item.id}>
              {item.imageUrl ? <img src={item.imageUrl} alt={`${item.displayName} 재료`} /> : <span className="ingredient-placeholder" aria-hidden="true">{item.displayName.slice(0, 1)}</span>}
              <div className="ingredient-name"><small>{item.category}</small><strong>{item.displayName}</strong></div>
              <div className="amount-control"><button onClick={() => changeAmount(item.id, -1)} disabled={amount <= item.minAmount} aria-label={`${item.displayName} 줄이기`}>−</button><output>{grams(amount)}</output><button onClick={() => changeAmount(item.id, 1)} disabled={amount >= item.maxAmount} aria-label={`${item.displayName} 늘리기`}>＋</button></div>
            </div>;
          })}
          {ingredients.length === 0 && <div className="empty-state">오늘 사용할 스프 재료를 교사가 준비 중이에요.</div>}
        </div>
        <aside className="formula-summary"><span>현재 스프 총량</span><strong>{grams(total)}</strong><p>시식용 건면 {settings.tastingNoodleFraction}개 기준</p><div className="formula-meter"><i style={{ width: `${Math.min(100, total * 14)}%` }} /></div><button className="primary-cta compact" onClick={saveExperiment}>배합 저장</button>{experiment.saved && <button className="secondary-cta" onClick={onTaste}>실제 시식 후 기록 →</button>}</aside>
      </div>
    </section>
  );
}
