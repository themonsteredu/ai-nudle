"use client";
import { useEffect, useState } from "react";
import { emptyNotebook } from "@/lib/notebook";
import { voteOf, withVote } from "@/lib/groups";
import type { AppSettings, BlindRound, StudentProject } from "@/lib/types";
const STATE_TEXT = { voting: "투표 중 · 누르면 바로 골라져요", closed: "투표가 마감됐어요", revealed: "투표가 끝났어요 · 선생님 화면에서 결과를 확인해요" } as const;
/** Blind ballot: letters only. Never show a group number or recipe name here. */
export function BlindVote({ project, round, refresh, patch, onBack }: { project: StudentProject; round?: BlindRound; refresh: () => Promise<AppSettings | null>; patch: (change: (p: StudentProject) => StudentProject) => void; onBack: () => void }) {
  const [pending, setPending] = useState("");
  const [notice, setNotice] = useState("");
  const open = round?.status === "voting";
  useEffect(() => {
    if (!open) return;
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [open, refresh]);
  const heading = <div className="page-heading"><div><span className="eyebrow">BLIND TEST</span><h1>블라인드 투표</h1></div><p>{open ? "맛본 레시피 중 가장 맛있었던 하나를 골라요. 어느 모둠 레시피인지는 비밀이에요." : round ? "결과는 선생님 화면에서 함께 봐요." : "선생님이 투표를 열면 여기에서 골라요."}</p></div>;
  if (!round) return <section className="gb-ballot">{heading}<p className="empty-record">지금은 열린 투표가 없어요.</p><button className="secondary-cta" onClick={onBack}>레시피 기록으로 돌아가기</button></section>;
  const mine = voteOf(project, round);
  const shown = pending || mine;
  async function choose(label: string) {
    if (!round || !open || pending) return;
    setPending(label); setNotice("");
    // Check the lesson again so a vote tapped right after the teacher closes it is not counted.
    const fresh = await Promise.race([refresh(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))]);
    setPending("");
    // Offline, a vote could reach the server after the close and change the results, so it is not kept.
    if (!fresh) { setNotice("연결을 확인하고 다시 눌러 주세요. 투표는 저장되지 않았어요."); return; }
    const live = fresh.classes?.[0]?.blindRound;
    if (!live || live.id !== round.id || live.status !== "voting") { setNotice(live?.id === round.id ? "아쉽지만 투표가 이미 마감됐어요." : "투표가 바뀌었어요. 화면을 다시 확인해 주세요."); return; }
    patch((p) => ({ ...p, notebook: withVote(p.notebook ?? emptyNotebook(), live, label) }));
  }
  return <section className="gb-ballot">{heading}
    <p className={`gb-ballot-state ${round.status}`}>{STATE_TEXT[round.status]}</p>
    {open && <p className="gb-ballot-hint">우리 모둠 레시피를 고르면 표가 세지지 않을 수 있어요. 다른 모둠 레시피 중에서 골라 주세요.</p>}
    <div className="gb-ballot-grid" role="group" aria-label="레시피 고르기">{round.samples.map((sample) => <button key={sample.label} aria-label={`레시피 ${sample.label}`} aria-pressed={shown === sample.label} className={shown === sample.label ? "chosen" : ""} disabled={!open || Boolean(pending)} onClick={() => void choose(sample.label)}><small>레시피</small><b>{sample.label}</b>{shown === sample.label && <em>{pending ? "저장 중" : "내 선택"}</em>}</button>)}</div>
    <p className="gb-ballot-mine" role="status">{mine ? <>내 선택: <b>{mine}</b>{open && " · 마감 전까지 바꿀 수 있어요"}</> : open ? "아직 고르지 않았어요." : "이번 투표에는 고르지 않았어요."}</p>
    {notice && <p className="gb-ballot-notice" role="alert">{notice}</p>}
  </section>;
}
