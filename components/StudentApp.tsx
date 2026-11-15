"use client";
import { useState } from "react";
import Link from "next/link";
import { blankRecord, copyToTasting, emptyNotebook, formatGrams } from "@/lib/notebook";
import type { AppSettings, LessonClass, RecipeMethod, RecipeRecord } from "@/lib/types";
import { useNotebookSession } from "./student/useNotebookSession";
import { RecipeEditor, RecipeReadout } from "./student/RecipeNotebook";
import { FinalRecipe } from "./student/FinalRecipe";
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
  const [section, setSection] = useState<"record" | "label" | "vote">("record");
  const [pickingGroup, setPickingGroup] = useState(false);
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
  const setNotebook = (n: typeof notebook) => update({ ...project, notebook: n });
  // One recipe page per student: it is saved as the 라면 시식 record, which is what the group best submission reads.
  const changeRecord = (record: RecipeRecord) => setNotebook({ ...notebook, [method]: { ...data, tasting: record } });
  const nav: ["record" | "label" | "vote", string][] = [["record", "레시피 기록"], ["label", "모둠 베스트 제출"]];
  if (round) nav.unshift(["vote", "블라인드 투표"]);
  const copy = (record: RecipeRecord) => {
    if (data.tasting && !window.confirm("지금 적은 레시피는 이전 기록으로 보관하고, 이 레시피를 가져올까요?")) return;
    setNotebook(copyToTasting(notebook, method, record));
  };
  return <div className="student-shell notebook-shell"><aside className="student-sidebar"><button className="brand" onClick={() => setSection("record")}><span className="brand-kicker">FOOD R&amp;D LAB</span><strong>라면 연구소</strong></button><nav className="student-nav">{nav.map(([id,label]) => <button key={id} className={`${section === id ? "active" : ""}${id === "vote" && round?.status === "voting" ? " gb-nav-vote" : ""}`} onClick={() => setSection(id)}>{label}</button>)}</nav><div className="notebook-session"><strong>{groupLabel(group)}{project.researcherNumber ? ` · ${project.researcherNumber}번 연구원` : ""}</strong><p>{lesson.name}</p><button onClick={leave}>수업 나가기</button></div></aside>
    <main className="student-main"><header className="student-topbar"><div className="gb-topbar-title"><strong>{lesson.name}</strong><button type="button" className="gb-mygroup gb-mygroup-button" title="모둠 바꾸기" onClick={() => groupLocked ? window.alert(lockMessage) : setPickingGroup(true)}>{groupLabel(group)} · 바꾸기</button></div><span className="save-status" role="status">{status}</span></header><section className="content-stage notebook-content">
      {round?.status === "voting" && section !== "vote" && <button className="gb-vote-banner" onClick={() => setSection("vote")}><span>블라인드 투표 중</span><strong>{myVote ? `내 선택: 레시피 ${myVote}` : "가장 맛있었던 레시피를 골라 주세요"}</strong><em>{myVote ? "바꾸러 가기" : "투표하러 가기"}</em></button>}
      {section === "record" && <><div className="page-heading"><div><span className="eyebrow">MY RECIPE</span><h1>내 레시피 기록</h1></div></div>
      <p className="lesson-settings">선생님 설정 · 물 {lesson.waterMl}ml · 라면사리 {lesson.noodleFraction}개 · 기다리는 시간 {lesson.cookMinutes}분</p>
      {/* Keep the editor mounted when the draft becomes a saved recipe on the first keystroke. */}
      <SingleRecord key={project.id} record={data.tasting} lesson={lesson} settings={settings} onChange={changeRecord} />
      <div className="record-actions"><button className="filled" onClick={() => setSection("label")}>다 적었으면 모둠 베스트 제출하러 가기</button></div>
      {data.practices.length > 0 && <details className="practice-history"><summary>이전 연습 기록 보기 ({data.practices.length})</summary>{data.practices.map((r,i) => <div key={r.id}><RecipeReadout record={r} settings={settings} title={`연습 ${i+1}`} /><div className="record-actions"><button onClick={() => copy(r)}>이 레시피 가져오기</button></div></div>)}</details>}
      {data.tastingHistory.length > 0 && <details className="practice-history"><summary>이전 라면 기록 보기 ({data.tastingHistory.length})</summary>{data.tastingHistory.map((r,i) => <RecipeReadout key={`${r.id}-${i}`} record={r} settings={settings} noodles title={`이전 기록 ${i+1}`} />)}</details>}
      </>}
      {section === "label" && <FinalRecipe key={project.id} project={project} settings={settings} group={group} round={round} patch={session.patch} refresh={session.refreshSettings} onGoRecord={() => setSection("record")} />}
      {section === "vote" && <BlindVote key={project.id} project={project} round={round} refresh={session.refreshSettings} patch={session.patch} onBack={() => setSection("record")} />}
    </section></main></div>;
}
/** The one recipe page. A new record is only saved once the student types something. */
function SingleRecord({ record, lesson, settings, onChange }: { record?: RecipeRecord; lesson: LessonClass; settings: AppSettings; onChange: (r: RecipeRecord) => void }) {
  const [draft] = useState(() => blankRecord(lesson));
  return <RecipeEditor record={record ?? draft} onChange={onChange} settings={settings} method="base" tasting title="내 라면 레시피" />;
}
