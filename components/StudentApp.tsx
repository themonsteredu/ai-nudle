"use client";
import { useState } from "react";
import Link from "next/link";
import { blankRecord, copyToTasting, emptyNotebook, formatGrams } from "@/lib/notebook";
import type { RecipeMethod, RecipeRecord } from "@/lib/types";
import { useNotebookSession } from "./student/useNotebookSession";
import { RecipeEditor, RecipeReadout } from "./student/RecipeNotebook";
import { FinalRecipe } from "./student/FinalRecipe";
import { ClassGallery } from "./student/ClassGallery";
import { GroupPicker } from "./student/GroupPicker";
import { BlindVote } from "./student/BlindVote";
import { groupCountOf, groupLabel, groupOf, voteOf, withGroup } from "@/lib/groups";
export const grams = formatGrams;
export type StudentSection = "home" | "process" | "lab" | "tests" | "compare" | "best" | "label";
export default function StudentApp() {
  const session = useNotebookSession();
  const { project, settings, status, busy, join, update } = session;
  const [code, setCode] = useState("");
  // Classes use the 기본 베이스 only. Older records may still hold a 시판 스프 part; it stays saved but is not shown.
  const method: RecipeMethod = "base";
  const [section, setSection] = useState<"record" | "label" | "share" | "vote">("record");
  const [pickingGroup, setPickingGroup] = useState(false);
  const [selected, setSelected] = useState<Record<RecipeMethod, string>>({ base: "", commercial: "" });
  if (!project) return <main className="cover-screen notebook-cover"><div className="cover-copy"><span className="cover-kicker">FOOD R&amp;D LAB</span><h1>라면 연구소</h1><p>내가 넣은 재료와 맛을 남겨요.</p><form className="join-class" onSubmit={(e) => { e.preventDefault(); void join(String(new FormData(e.currentTarget).get("classCode") ?? "")); }}><label>수업 코드<input name="classCode" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ""))} maxLength={12} inputMode="numeric" autoComplete="off" placeholder="선생님이 알려 주신 숫자 코드" required /></label><button className="primary-cta compact" disabled={busy}>{busy ? "여는 중" : "기록 시작하기"}</button></form><p className="save-status" role="status">{status}</p><Link className="cover-teacher-link" href="/teacher">교사 설정 화면</Link></div><div className="hero-image-wrap"><img src="/ramen-hero.webp" alt="라면 연구를 위한 재료와 라면" /></div></main>;
  const notebook = project.notebook ?? emptyNotebook();
  const lesson = settings.classes![0];
  const group = groupOf(project);
  const groupCount = groupCountOf(lesson);
  const round = lesson.blindRound;
  const myVote = voteOf(project, round);
  // A recipe that went into a blind round stays fixed, with its group, until the teacher resets the round.
  const inTest = Boolean(round?.samples.some((x) => x.projectId === project.id));
  // Own-group votes are judged by the voter's group, so nobody switches group while tasting and voting.
  const groupLocked = inTest || round?.status === "voting" || round?.status === "closed";
  const lockMessage = inTest ? "우리 모둠 레시피가 블라인드 테스트에 나가서, 선생님이 투표를 초기화하기 전까지 모둠을 바꿀 수 없어요." : "블라인드 투표 중에는 모둠을 바꿀 수 없어요. 투표가 끝나면 바꿀 수 있어요.";
  const leave = () => { setPickingGroup(false); session.leave(); };
  function pickGroup(n: number) {
    if (group && groupLocked) { window.alert(lockMessage); setPickingGroup(false); return; }
    const moving = Boolean(group && n !== group && notebook.final?.shared);
    if (moving && !window.confirm(`${groupLabel(n)}으로 바꾸면 지금 제출한 모둠 베스트 레시피는 제출 취소돼요.\n새 모둠에서 다시 제출해 주세요. 바꿀까요?`)) return;
    session.patch((p) => {
      const next = withGroup(p.notebook ?? emptyNotebook(), n);
      return { ...p, notebook: moving && next.final ? { ...next, final: { ...next.final, shared: false } } : next };
    });
    setPickingGroup(false);
  }
  // A group number above 모둠 수 is kept as it is during a round, so a sample never changes its group.
  if (!group || (group > groupCount && !groupLocked) || pickingGroup) return <GroupPicker lessonName={lesson.name} count={groupCount} current={group} onPick={pickGroup} onCancel={group && group <= groupCount ? () => setPickingGroup(false) : undefined} onLeave={leave} />;
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
  const nav: ["record" | "label" | "share" | "vote", string][] = [["record", "레시피 기록"], ["label", "모둠 베스트 제출"], ["share", "친구 레시피"]];
  if (round) nav.unshift(["vote", "블라인드 투표"]);
  const copy = (record: RecipeRecord) => {
    if (data.tasting && !window.confirm("지금 라면 기록은 이전 기록으로 보관하고, 이 레시피를 가져올까요?")) return;
    setNotebook(copyToTasting(notebook, method, record)); setSelected({ ...selected, [method]: "tasting" });
  };
  return <div className="student-shell notebook-shell"><aside className="student-sidebar"><button className="brand" onClick={() => setSection("record")}><span className="brand-kicker">FOOD R&amp;D LAB</span><strong>라면 연구소</strong></button><nav className="student-nav">{nav.map(([id,label]) => <button key={id} className={`${section === id ? "active" : ""}${id === "vote" && round?.status === "voting" ? " gb-nav-vote" : ""}`} onClick={() => setSection(id)}>{label}</button>)}</nav><div className="notebook-session"><strong>{groupLabel(group)}{project.researcherNumber ? ` · ${project.researcherNumber}번 연구원` : ""}</strong><p>{lesson.name}</p><button onClick={session.exportDraft}>기록 내려받기</button><button onClick={() => groupLocked ? window.alert(lockMessage) : setPickingGroup(true)}>모둠 바꾸기</button><button onClick={() => { if (window.confirm("다른 학생이 사용하나요? 지금 기록은 보관하고 새 기록을 엽니다.")) void join(session.code, true); }}>다른 학생 시작</button><button onClick={leave}>수업 나가기</button></div></aside>
    <main className="student-main"><header className="student-topbar"><div className="gb-topbar-title"><strong>{lesson.name}</strong><span className="gb-mygroup">{groupLabel(group)}</span></div><span className="save-status" role="status">{status}</span></header><section className="content-stage notebook-content">
      {round?.status === "voting" && section !== "vote" && <button className="gb-vote-banner" onClick={() => setSection("vote")}><span>블라인드 투표 중</span><strong>{myVote ? `내 선택: 레시피 ${myVote}` : "가장 맛있었던 레시피를 골라 주세요"}</strong><em>{myVote ? "바꾸러 가기" : "투표하러 가기"}</em></button>}
      {section === "record" && <><div className="page-heading"><div><span className="eyebrow">MY RECIPE</span><h1>내 레시피와 맛 기록</h1></div></div>
      <p className="lesson-settings">선생님 설정 · 물 {lesson.waterMl}ml · 라면사리 {lesson.noodleFraction}개 · 기다리는 시간 {lesson.cookMinutes}분</p>
      <div className="notebook-record-nav"><div><h2>국물 연습 기록</h2><p>필요할 때 새 기록을 추가해요.</p></div><button className="teacher-primary" onClick={newPractice}>국물 연습 추가</button></div>
      <div className="record-pills">{data.practices.map((record,i) => <button key={record.id} className={selected[method] === record.id ? "active" : ""} onClick={() => setSelected({ ...selected, [method]: record.id })}>연습 {i+1}</button>)}{!data.practices.length && <p>아직 국물 연습 기록이 없어요.</p>}</div>
      <div className="tasting-entry"><div><h2>라면 시식 기록</h2><p>이 방식으로 라면사리를 넣어 한 번 맛봐요.</p></div><button onClick={() => { if (!data.tasting) setNotebook({ ...notebook, [method]: { ...data, tasting: blankRecord(lesson) } }); setSelected({ ...selected, [method]: "tasting" }); }}>{data.tasting ? "라면 기록 열기" : "라면 기록 쓰기"}</button></div>
      {activeRecord && <RecipeEditor key={`${method}-${activeRecord.id}`} record={activeRecord} onChange={changeRecord} settings={settings} method={method} tasting={selected[method] === "tasting"} title={selected[method] === "tasting" ? "라면 시식" : `국물 연습 ${data.practices.findIndex((r) => r.id === activeRecord.id)+1}`} onCopy={selected[method] !== "tasting" ? () => copy(activeRecord) : undefined} />}
      {data.tastingHistory.length > 0 && <details className="practice-history"><summary>이전 라면 기록 보기 ({data.tastingHistory.length})</summary>{data.tastingHistory.map((r,i) => <RecipeReadout key={`${r.id}-${i}`} record={r} settings={settings} noodles title={`이전 기록 ${i+1}`} />)}</details>}
      </>}
      {section === "label" && <FinalRecipe key={project.id} project={project} settings={settings} group={group} round={round} patch={session.patch} refresh={session.refreshSettings} onGoRecord={() => setSection("record")} />}
      {section === "share" && <ClassGallery key={project.classId} settings={settings} code={session.code} />}
      {section === "vote" && <BlindVote key={project.id} project={project} round={round} refresh={session.refreshSettings} patch={session.patch} onBack={() => setSection("record")} />}
    </section></main></div>;
}
