"use client";
import { useState } from "react";
import Link from "next/link";
import { blankRecord, copyToTasting, emptyNotebook, METHOD_NAMES, formatGrams } from "@/lib/notebook";
import type { RecipeMethod, RecipeRecord, StudentProject } from "@/lib/types";
import { useNotebookSession } from "./student/useNotebookSession";
import { RecipeEditor, RecipeReadout } from "./student/RecipeNotebook";
import { FinalRecipe } from "./student/FinalRecipe";
import { ClassGallery } from "./student/ClassGallery";
export const grams = formatGrams;
export type StudentSection = "home" | "process" | "lab" | "tests" | "compare" | "best" | "label";
export default function StudentApp() {
  const session = useNotebookSession();
  const { project, settings, status, busy, join, update } = session;
  const [code, setCode] = useState("");
  const [method, setMethod] = useState<RecipeMethod>("base");
  const [section, setSection] = useState<"record" | "label" | "share">("record");
  const [selected, setSelected] = useState<Record<RecipeMethod, string>>({ base: "", commercial: "" });
  if (!project) return <main className="cover-screen notebook-cover"><div className="cover-copy"><span className="cover-kicker">FOOD R&amp;D LAB</span><h1>라면 연구소</h1><p>내가 넣은 재료와 맛을 남겨요.</p><form className="join-class" onSubmit={(e) => { e.preventDefault(); void join(String(new FormData(e.currentTarget).get("classCode") ?? "")); }}><label>수업 코드<input name="classCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={12} autoComplete="off" placeholder="선생님이 알려 주신 코드" required /></label><button className="primary-cta compact" disabled={busy}>{busy ? "여는 중" : "기록 시작하기"}</button></form><p className="save-status" role="status">{status}</p><Link className="teacher-link" href="/teacher">교사 화면</Link></div><div className="hero-image-wrap"><img src="/ramen-hero.webp" alt="라면 연구를 위한 재료와 라면" /></div></main>;
  const notebook = project.notebook ?? emptyNotebook();
  const lesson = settings.classes![0];
  const data = notebook[method];
  const activeRecord = selected[method] === "tasting" ? data.tasting : data.practices.find((r) => r.id === selected[method]);
  const setNotebook = (n: typeof notebook) => update({ ...project, notebook: n });
  const newPractice = () => {
    const record = blankRecord(lesson);
    setNotebook({ ...notebook, [method]: { ...data, practices: [...data.practices, record] } });
    setSelected({ ...selected, [method]: record.id });
  };
  function changeRecord(record: RecipeRecord) {
    setNotebook({ ...notebook, [method]: selected[method] === "tasting" ? { ...data, tasting: record } : { ...data, practices: data.practices.map((r) => r.id === record.id ? record : r) } });
  }
  const copy = (record: RecipeRecord) => {
    if (data.tasting && !window.confirm("지금 라면 기록은 이전 기록으로 보관하고, 이 레시피를 가져올까요?")) return;
    setNotebook(copyToTasting(notebook, method, record)); setSelected({ ...selected, [method]: "tasting" });
  };
  return <div className="student-shell notebook-shell"><aside className="student-sidebar"><button className="brand" onClick={() => setSection("record")}><span className="brand-kicker">FOOD R&amp;D LAB</span><strong>라면 연구소</strong></button><nav className="student-nav">{([["record", "레시피 기록"], ["label", "완제품 스티커"], ["share", "친구 레시피"]] as const).map(([id,label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}</nav><div className="notebook-session"><strong>{project.researcherNumber ? `${project.researcherNumber}번 연구원` : "나의 기록"}</strong><p>{lesson.name}</p><button onClick={session.exportDraft}>기록 내려받기</button><button onClick={() => { if (window.confirm("다른 학생이 사용하나요? 지금 기록은 보관하고 새 기록을 엽니다.")) void join(session.code, true); }}>다른 학생 시작</button><button onClick={session.leave}>수업 나가기</button></div><Link className="teacher-link" href="/teacher">교사 화면</Link></aside>
    <main className="student-main"><header className="student-topbar"><strong>{lesson.name}</strong><span className="save-status" role="status">{status}</span></header><section className="content-stage notebook-content">
      {section === "record" && <><div className="page-heading"><div><span className="eyebrow">MY RECIPE</span><h1>내 레시피와 맛 기록</h1></div></div><div className="test-tabs" role="tablist" aria-label="연구 방법">{(["base", "commercial"] as const).map((m) => <button key={m} role="tab" aria-selected={method === m} className={method === m ? "active" : ""} onClick={() => setMethod(m)}>{METHOD_NAMES[m]}</button>)}</div>
      <p className="lesson-settings">선생님 설정 · 물 {lesson.waterMl}ml · 라면사리 {lesson.noodleFraction}개 · 기다리는 시간 {lesson.cookMinutes}분</p>
      {method === "commercial" && <details className="comparison-notes"><summary>시판 스프 맛 메모 (선택)</summary><p>같은 양의 물에 맛본 느낌을 남겨도 좋아요.</p>{settings.comparisonSoups?.map((soup,i) => soup.enabled && <label className="admin-field" key={soup.id}><span>스프 {String.fromCharCode(65+i)}</span><input placeholder="맛 느낌 한 줄" maxLength={500} value={notebook.comparisons[soup.id] ?? ""} onChange={(e) => setNotebook({ ...notebook, comparisons: { ...notebook.comparisons, [soup.id]: e.target.value } })} /></label>)}</details>}
      <div className="notebook-record-nav"><div><h2>국물 연습 기록</h2><p>필요할 때 새 기록을 추가해요.</p></div><button className="teacher-primary" onClick={newPractice}>국물 연습 추가</button></div>
      <div className="record-pills">{data.practices.map((record,i) => <button key={record.id} className={selected[method] === record.id ? "active" : ""} onClick={() => setSelected({ ...selected, [method]: record.id })}>연습 {i+1}</button>)}{!data.practices.length && <p>아직 국물 연습 기록이 없어요.</p>}</div>
      <div className="tasting-entry"><div><h2>라면 시식 기록</h2><p>이 방식으로 라면사리를 넣어 한 번 맛봐요.</p></div><button onClick={() => { if (!data.tasting) setNotebook({ ...notebook, [method]: { ...data, tasting: blankRecord(lesson) } }); setSelected({ ...selected, [method]: "tasting" }); }}>{data.tasting ? "라면 기록 열기" : "라면 기록 쓰기"}</button></div>
      {activeRecord && <RecipeEditor key={`${method}-${activeRecord.id}`} record={activeRecord} onChange={changeRecord} settings={settings} method={method} tasting={selected[method] === "tasting"} title={selected[method] === "tasting" ? "라면 시식" : `국물 연습 ${data.practices.findIndex((r) => r.id === activeRecord.id)+1}`} onCopy={selected[method] !== "tasting" ? () => copy(activeRecord) : undefined} />}
      {data.tastingHistory.length > 0 && <details className="practice-history"><summary>이전 라면 기록 보기 ({data.tastingHistory.length})</summary>{data.tastingHistory.map((r,i) => <RecipeReadout key={`${r.id}-${i}`} record={r} settings={settings} noodles title={`이전 기록 ${i+1}`} />)}</details>}
      </>}
      {section === "label" && <FinalRecipe key={project.id} project={project} settings={settings} update={(p: StudentProject) => update(p)} />}
      {section === "share" && <ClassGallery key={project.classId} settings={settings} code={session.code} />}
    </section></main></div>;
}
