"use client";
import { useMemo, useState } from "react";
import type { AppSettings, BlindSample, BlindStatus, LessonClass, StudentProject } from "@/lib/types";
import { createBlindRound, groupCountOf, groupLabel, groupOf, groupSubmissions, isSubmitted, tallyVotes } from "@/lib/groups";
import { formatGrams, METHOD_NAMES } from "@/lib/notebook";
import { AllergenNotice } from "../recipe/Allergens";
import { Fullscreen } from "../recipe/Fullscreen";

/** A lesson change, or a function of the newest saved lesson (null = nothing to change any more). */
export type LessonPatch = Partial<LessonClass> | ((lesson: LessonClass) => Partial<LessonClass> | null);

const STEPS = ["모둠 베스트 제출", "블라인드 시식·투표", "투표 마감·결과", "모둠 공개"];
const STATUS_TEXT: Record<BlindStatus, string> = { voting: "투표 중", closed: "투표 마감", revealed: "모둠 공개" };

export function GroupBestPanel({ settings, classId, projects, commit, busy, refresh, loading, error }: { settings: AppSettings; classId: string; projects: StudentProject[]; commit: (patch: LessonPatch, message: string) => Promise<boolean>; busy: boolean; refresh: () => void; loading: boolean; error: string }) {
  const lesson = settings.classes?.find((x) => x.id === classId);
  const round = lesson?.blindRound;
  const [excludeOwn, setExcludeOwn] = useState(true);
  const [excludeLate, setExcludeLate] = useState(false);
  const [previewRound, setPreviewRound] = useState("");
  // Remembers which round was being shown, so a later round never opens full screen by itself.
  const [present, setPresent] = useState<{ round: string; index: number } | null>(null);
  const { latest, counts } = useMemo(() => groupSubmissions(projects), [projects]);
  const byId = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const tally = useMemo(() => round ? tallyVotes(projects, round, excludeOwn, excludeLate) : null, [projects, round, excludeOwn, excludeLate]);

  const head = <header className="teacher-panel-head"><div><span>GROUP BEST · BLIND TEST</span><h1>모둠 베스트·블라인드 투표</h1><p>{lesson ? `${lesson.name} · 5초마다 갱신 · 모둠 번호는 '모둠 공개'를 누르기 전까지 숨겨져요.` : "반을 고르면 모둠 제출과 투표를 볼 수 있어요."}</p></div>{lesson && <button className="teacher-primary" onClick={refresh} disabled={loading}>{loading ? "불러오는 중" : "새로고침"}</button>}</header>;
  if (!lesson) return <section className="teacher-panel gb-panel">{head}<p className="gb-empty">위의 &apos;수업 선택&apos;에서 반을 골라 주세요. 반 정보 없는 이전 기록에서는 모둠 투표를 할 수 없어요.</p></section>;

  const groupCount = groupCountOf(lesson);
  const groups = Array.from({ length: Math.max(groupCount, ...counts.keys()) }, (_, i) => i + 1);
  const submitted = [...latest.values()];
  const multi = [...counts].filter(([, n]) => n > 1).map(([g]) => g).sort((a, b) => a - b);
  const ungrouped = projects.filter((p) => isSubmitted(p) && !groupOf(p)).length;
  const step = !round ? 0 : round.status === "voting" ? 1 : round.status === "closed" ? 2 : 3;
  const revealed = round?.status === "revealed";
  const showResults = Boolean(round && (round.status !== "voting" || previewRound === round.id));
  const winners = new Set(showResults ? tally?.winners : []);
  const counted = tally ? tally.rows.reduce((sum, row) => sum + tally.counted(row), 0) : 0;
  const ownTotal = tally ? tally.rows.reduce((sum, row) => sum + row.ownVotes, 0) : 0;
  const top = tally ? Math.max(0, ...tally.rows.map(tally.counted)) : 0;
  const samples = round?.samples ?? [];
  const presentIndex = !round || present?.round !== round.id || !samples.length ? null : Math.min(present.index, samples.length - 1);
  const show = (index: number) => { if (round) setPresent({ round: round.id, index }); };
  // During voting the board may show a preview, but the letter cards never carry a winner mark.
  const cardWinner = (label: string) => round?.status !== "voting" && winners.has(label);
  const emptyRecipe = (p?: StudentProject) => !p?.notebook?.final?.record.items.some((x) => x.amount > 0);
  const emptyGroups = round ? [] : groups.filter((g) => latest.has(g) && emptyRecipe(latest.get(g)));
  // Older classes also used 시판 스프. Before the start such groups are asked to submit again (like an empty recipe);
  // once a round holds one, its 스프 A/B… letters are matched to the products here, never on the cards that go on the board.
  const oldGroups = round ? [] : groups.filter((g) => latest.get(g)?.notebook?.final?.method === "commercial");
  const oldIds = new Set(samples.flatMap((x) => { const final = byId.get(x.projectId)?.notebook?.final; return final?.method === "commercial" ? final.record.items.filter((i) => i.amount > 0).map((i) => i.id) : []; }));
  const oldSoups = (settings.comparisonSoups ?? []).flatMap((soup, i) => oldIds.has(soup.id) ? [`스프 ${String.fromCharCode(65 + i)} = ${soup.name || "이름 없음"}`] : []);

  // Every change re-checks the newest saved round, so two teacher screens never undo each other.
  // A round that was revealed once can never be opened for voting again.
  const setStatus = (status: BlindStatus, message: string) => {
    const id = round?.id;
    void commit((current) => {
      const saved = current.blindRound;
      if (!saved || saved.id !== id || (status === "voting" && saved.revealedAt)) return null;
      return { blindRound: { ...saved, status, ...(status === "revealed" && !saved.revealedAt ? { revealedAt: new Date().toISOString() } : {}) } };
    }, message);
  };
  function start() {
    if (submitted.length < 2) return;
    if (!window.confirm(`제출한 ${submitted.length}개 모둠 레시피로 블라인드 테스트를 시작할까요?\n레시피는 A, B, C…로 무작위로 섞이고 학생 화면에 투표가 열려요.`)) return;
    void commit((current) => current.blindRound ? null : { blindRound: createBlindRound(submitted) }, "블라인드 테스트를 시작했어요. 학생 화면에 투표가 열려요.");
  }
  function reset() {
    if (!window.confirm("지금 투표를 지우고 새로 시작할까요?\n학생들이 고른 표는 더 이상 세지 않아요.")) return;
    const id = round?.id;
    setPresent(null);
    void commit((current) => current.blindRound?.id === id ? { blindRound: undefined } : null, "투표를 초기화했어요. 다시 시작할 수 있어요.");
  }
  const winnerText = () => {
    if (!tally || !tally.winners.length) return "아직 표가 없어요.";
    const names = tally.winners.map((label) => {
      const row = tally.rows.find((x) => x.label === label)!;
      const name = byId.get(row.projectId)?.notebook?.final?.productName;
      return revealed ? `레시피 ${label} · ${row.group ? groupLabel(row.group) : "모둠 정보 없음"}${name ? ` 「${name}」` : ""}` : `레시피 ${label}`;
    });
    return `${tally.winners.length > 1 ? "공동 1위" : "1위"} · ${names.join(", ")} (${top}표)`;
  };

  // Recipe content never sits next to a group number here; an empty recipe is flagged only before the start.
  const submissions = <section className="gb-block" aria-labelledby="gb-submit-title">
    <header><div><h2 id="gb-submit-title">모둠 제출 현황</h2><p>학생 화면 &apos;모둠 베스트 제출&apos;에서 낸 레시피예요. 레시피 내용은 블라인드 카드에서만 보여요. 모둠 수는 &apos;수업·반 설정&apos;에서 바꿔요.</p></div><strong className="gb-count">{latest.size} / {groupCount} 모둠 제출</strong></header>
    <ul className="gb-chips">{groups.map((g) => <li key={g} className={!latest.has(g) ? "" : emptyGroups.includes(g) ? "done warn" : "done"}><b>{groupLabel(g)}</b><span>{!latest.has(g) ? "미제출" : emptyGroups.includes(g) ? "제출 · 재료 없음" : "제출"}</span></li>)}</ul>
    {(multi.length > 0 || ungrouped > 0 || emptyGroups.length > 0 || oldGroups.length > 0 || round) && <ul className="gb-notes">
      {emptyGroups.length > 0 && <li>{emptyGroups.map(groupLabel).join(", ")}은 재료가 없는 레시피를 냈어요. 시작하기 전에 다시 제출해 달라고 해 주세요.</li>}
      {oldGroups.length > 0 && <li>{oldGroups.map(groupLabel).join(", ")}은 예전 시판 스프 레시피가 제출되어 있어요. 시작하기 전에 라면 시식 기록으로 다시 제출해 달라고 해 주세요.</li>}
      {oldSoups.length > 0 && <li>예전 시판 스프 레시피의 스프(교사용): {oldSoups.join(" · ")}</li>}
      {multi.length > 0 && <li>{multi.map(groupLabel).join(", ")}은 여러 기기에서 제출했어요. 가장 최근에 제출한 레시피 하나만 투표에 올라가요. (학생 기기 시각 기준)</li>}
      {ungrouped > 0 && <li>모둠을 고르지 않고 제출한 기록 {ungrouped}개는 투표에서 빠져요.</li>}
      {round && <li>투표가 시작된 뒤 새로 낸 레시피는 이번 투표에 들어가지 않아요. 넣으려면 &apos;투표 초기화&apos; 후 다시 시작해 주세요.</li>}
      {round && round.status !== "revealed" && <li>&apos;학생 레시피 보기&apos;는 재료가 블라인드 카드와 같아서, 공개 전에는 칠판에 띄우지 마세요.</li>}
    </ul>}
  </section>;

  return <section className="teacher-panel gb-panel">{head}
    <ol className="gb-steps" aria-label="진행 단계">{STEPS.map((label, i) => <li key={label} className={i === step ? "now" : i < step ? "done" : ""} aria-current={i === step ? "step" : undefined}><b>{i + 1}</b>{label}</li>)}</ol>
    {error && <p className="gb-error" role="status">{error}</p>}
    {!round && submissions}

    <section className="gb-block gb-control" aria-labelledby="gb-control-title">
      <header><div><h2 id="gb-control-title">블라인드 테스트</h2>{round ? <span className={`gb-status ${round.status}`}>{STATUS_TEXT[round.status]}</span> : <p>제출한 모둠 레시피를 무작위로 섞어 A, B, C…로 보여 줘요. 학생 화면에도 모둠 번호는 나오지 않아요.</p>}</div></header>
      {!round && <div className="gb-stage"><p className="gb-lead">{submitted.length >= 2 ? `${submitted.length}개 모둠 레시피로 시작할 수 있어요.` : `2개 모둠 이상 제출하면 시작할 수 있어요. (지금 ${submitted.length}개)`}</p><div className="gb-actions"><button className="teacher-primary" onClick={start} disabled={busy || submitted.length < 2}>블라인드 테스트 시작</button></div></div>}
      {round && <div className="gb-stage">
        <div><strong className="gb-hero">{tally?.voters ?? 0}<small>명 투표</small></strong><p className="gb-lead">{round.status === "voting" ? `레시피 ${samples.length}개 · 학생 화면에서 투표 중이에요.` : round.status === "closed" ? round.revealedAt ? "모둠을 다시 가렸어요. 이미 공개한 투표라 다시 열 수는 없어요." : "투표가 마감됐어요. 결과를 확인하고 모둠을 공개해 주세요." : "모둠을 공개했어요. 학생 화면에는 '선생님 화면에서 결과 확인' 안내가 떠요."}</p>{tally && tally.late > 0 && <p className="gb-late">투표가 시작된 뒤 들어온 기록의 표 {tally.late}표를 {excludeLate ? "빼고" : "포함해서"} 셌어요.</p>}</div>
        <div className="gb-actions">
          {round.status === "voting" && <><button className="gb-toggle" aria-pressed={previewRound === round.id} onClick={() => setPreviewRound(previewRound === round.id ? "" : round.id)}><i />결과 미리 보기</button><button className="teacher-primary" disabled={busy} onClick={() => { if (window.confirm("투표를 마감할까요?\n마감하면 학생이 표를 바꿀 수 없어요.")) setStatus("closed", "투표를 마감했어요."); }}>투표 마감</button></>}
          {round.status === "closed" && <>{!round.revealedAt && <button className="gb-ghost" disabled={busy} onClick={() => setStatus("voting", "투표를 다시 열었어요.")}>투표 다시 열기</button>}<button className="teacher-primary" disabled={busy} onClick={() => { if (window.confirm("어느 모둠의 레시피인지 공개할까요?")) setStatus("revealed", "모둠을 공개했어요."); }}>모둠 공개</button></>}
          {round.status === "revealed" && <button className="gb-ghost" disabled={busy} onClick={() => setStatus("closed", "모둠 이름을 다시 가렸어요.")}>모둠 다시 가리기</button>}
        </div>
      </div>}
      {round && <footer className="gb-foot"><p>다시 하고 싶다면 투표를 지우고 처음부터 시작할 수 있어요.</p><button className="gb-ghost gb-danger" onClick={reset} disabled={busy}>투표 초기화 · 새로 시작</button></footer>}
    </section>

    {round && tally && showResults && <section className="gb-block gb-results" aria-labelledby="gb-result-title">
      <header><div><h2 id="gb-result-title">{round.status === "voting" ? "결과 미리 보기" : "투표 결과"}</h2><p>{round.status === "voting" ? "학생 화면에는 없지만, 칠판에 띄운 화면이라면 학생들도 볼 수 있어요. " : ""}반영한 표 {counted}표 · 자기 모둠 표 {ownTotal}표 {excludeOwn ? "제외" : "포함"}{tally.late > 0 ? ` · 투표 시작 뒤 들어온 기록 ${tally.late}표 ${excludeLate ? "제외" : "포함"}` : ""}</p></div>
        <button className="gb-toggle" aria-pressed={excludeOwn} onClick={() => setExcludeOwn(!excludeOwn)}><i />자기 모둠 표 빼고 세기</button>{tally.late > 0 && <button className="gb-toggle" aria-pressed={excludeLate} title="같은 기기에서 '다른 학생 시작'으로 여러 번 투표했을 수 있을 때 사용해요" onClick={() => setExcludeLate(!excludeLate)}><i />시작 뒤 들어온 기록 표 빼기</button>}</header>
      <p className="gb-winner">{winnerText()}</p>
      <ol className="gb-bars">{tally.rows.map((row) => { const n = tally.counted(row); const pct = counted ? Math.round(n / counted * 100) : 0; const win = winners.has(row.label); return <li key={row.label} className={win ? "win" : ""} title={`레시피 ${row.label} · ${n}표 · ${pct}%`}>
        <span className="gb-bar-name">레시피 {row.label}{revealed && <small>{row.group ? groupLabel(row.group) : "모둠 정보 없음"}</small>}</span>
        <span className="gb-bar-track"><i style={{ width: `${top ? n / top * 100 : 0}%` }} /></span>
        <span className="gb-bar-value"><b>{n}표</b> · {pct}%{win && <em>1위</em>}</span>
      </li>; })}</ol>
    </section>}

    {round && <section className="gb-block" aria-labelledby="gb-card-title">
      <header><div><h2 id="gb-card-title">블라인드 레시피 카드</h2><p>{revealed ? "모둠과 라면 이름을 공개했어요." : "조리에 필요한 정보만 보여요. 라면 이름·소개·모둠은 공개 전까지 숨겨요."}</p></div><button className="teacher-primary" onClick={() => show(0)} disabled={!samples.length}>크게 보기 (전체 화면)</button></header>
      <div className="gb-cards">{samples.map((sample, i) => <SampleCard key={sample.label} sample={sample} project={byId.get(sample.projectId)} loaded={projects.length > 0} settings={settings} revealed={revealed} winner={cardWinner(sample.label)} onOpen={() => show(i)} />)}</div>
    </section>}

    {round && submissions}

    {round && presentIndex !== null && <Fullscreen title={`${lesson.name} · 블라인드 레시피 ${samples[presentIndex].label}`} close={() => setPresent(null)} previous={() => show(Math.max(0, presentIndex - 1))} next={() => show(Math.min(samples.length - 1, presentIndex + 1))}>
      <div className="recipe-presentation gb-present"><SampleCard sample={samples[presentIndex]} project={byId.get(samples[presentIndex].projectId)} loaded={projects.length > 0} settings={settings} revealed={revealed} winner={cardWinner(samples[presentIndex].label)} />
        <footer className="presentation-navigation"><button disabled={presentIndex === 0} onClick={() => show(presentIndex - 1)}>이전 레시피</button><span>{presentIndex + 1} / {samples.length}</span><button disabled={presentIndex === samples.length - 1} onClick={() => show(presentIndex + 1)}>다음 레시피</button></footer></div>
    </Fullscreen>}
  </section>;
}

function SampleCard({ sample, project, loaded, settings, revealed, winner, onOpen }: { sample: BlindSample; project?: StudentProject; loaded: boolean; settings: AppSettings; revealed: boolean; winner: boolean; onOpen?: () => void }) {
  const final = project?.notebook?.final;
  const group = groupOf(project);
  const items = final?.record.items.filter((x) => x.amount > 0) ?? [];
  return <article className={`gb-card${winner ? " win" : ""}`} aria-label={`레시피 ${sample.label}`}>
    <header><span className="gb-letter" aria-hidden="true">{sample.label}</span><div><small>블라인드 레시피</small><h3>레시피 {sample.label}</h3></div>{winner && <em className="gb-win">1위</em>}</header>
    {revealed && <div className="gb-reveal"><b>{group ? groupLabel(group) : "모둠 정보 없음"}</b><strong>{final?.productName || "이름 없는 라면"}</strong>{final?.tasteLine && <p>{final.tasteLine}</p>}</div>}
    {final ? <div className="gb-card-body"><div>
      <p className="gb-cook">{[...(final.method === "commercial" ? [METHOD_NAMES.commercial] : []), `물 ${final.record.waterMl}ml`, `면 ${final.record.noodleFraction}개`, `조리 ${final.record.cookMinutes}분`, `맵기 ${final.spicyLevel}단계`].map((x) => <span key={x}>{x}</span>)}</p>
      {items.length ? <dl>{items.map((x) => <div key={x.id}><dt>{x.name}</dt><dd>{formatGrams(x.amount)}</dd></div>)}</dl> : <p className="gb-muted">넣은 재료가 없어요.</p>}
    </div><AllergenNotice record={final.record} settings={settings} noodles /></div>
      : <p className="gb-muted">{loaded ? "이 레시피를 찾지 못했어요. 학생 기록을 확인해 주세요." : "레시피를 불러오는 중이에요."}</p>}
    {onOpen && <button className="gb-ghost" onClick={onOpen}>크게 보기</button>}
  </article>;
}
