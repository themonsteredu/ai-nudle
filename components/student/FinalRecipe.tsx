"use client";
import { useState } from "react";
import { emptyNotebook, METHOD_NAMES } from "@/lib/notebook";
import { groupLabel } from "@/lib/groups";
import type { AppSettings, BlindRound, Notebook, RecipeMethod, StudentProject } from "@/lib/types";
import { RecipeReadout } from "./RecipeNotebook";
import { StickerPair } from "../recipe/Stickers";
const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Seoul" });
const inRound = (round: BlindRound | undefined, id: string) => Boolean(round?.samples.some((x) => x.projectId === id));
/** 모둠 베스트 제출: a shared final recipe is the group's submission. The newest submission of a group counts. */
export function FinalRecipe({ project, settings, group, round, patch, refresh, onGoRecord }: { project: StudentProject; settings: AppSettings; group: number; round?: BlindRound; patch: (change: (p: StudentProject) => StudentProject) => void; refresh: () => Promise<AppSettings | null>; onGoRecord: (method: RecipeMethod) => void }) {
  const saved = project.notebook?.final;
  const [method, setMethod] = useState<RecipeMethod>(saved?.method ?? "base");
  const [name, setName] = useState(saved?.productName ?? "");
  const [line, setLine] = useState(saved?.tasteLine ?? "");
  const [keywords, setKeywords] = useState<string[]>(saved?.keywords ?? []);
  const [level, setLevel] = useState(saved?.spicyLevel ?? 0);
  const [shape, setShape] = useState<"circle" | "square">("circle");
  const [printName, setPrintName] = useState("");
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const record = project.notebook?.[method].tasting;
  const submitted = Boolean(saved?.shared);
  // A recipe that went into the blind round stays as it is until the teacher resets the round, so the board never changes.
  const locked = inRound(round, project.id);
  const testing = round?.status === "voting" || round?.status === "closed";
  const needRecord = !record ? `'${METHOD_NAMES[method]}' 라면 시식 기록을 먼저 써 주세요.` : !record.items.some((x) => x.amount > 0) ? `'${METHOD_NAMES[method]}' 라면 시식 기록에 재료 양을 먼저 적어 주세요.` : "";
  const missing = needRecord || (name.trim() ? "" : "라면 이름을 지어 주세요.");
  const words = Array.from(new Set([...(project.notebook?.base.practices ?? []), ...(project.notebook?.commercial.practices ?? []), project.notebook?.base.tasting, project.notebook?.commercial.tasting].flatMap((x) => x?.note.split(/[\s,.!?·，。]+/).filter((w) => w.length > 1 && w.length <= 20) ?? []))).slice(0, 40);
  const changed = Boolean(saved && (saved.method !== method || saved.productName !== name.trim() || saved.tasteLine !== line.trim() || saved.spicyLevel !== level || saved.keywords.join("\n") !== keywords.join("\n") || (record && (record.id !== saved.record.id || record.updatedAt !== saved.record.updatedAt))));
  // Applied to the newest local record: the autosave may have moved on while the lesson was being checked.
  const setFinal = (change: (final: Notebook["final"]) => Notebook["final"]) => patch((p) => ({ ...p, notebook: { ...(p.notebook ?? emptyNotebook()), final: change(p.notebook?.final) } }));
  /** Reads the lesson again, so a recipe that has just gone into a blind round is not changed before the next poll. */
  async function stillOpen() {
    setChecking(true);
    const fresh = await Promise.race([refresh(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))]);
    setChecking(false);
    if (!inRound(fresh?.classes?.[0]?.blindRound, project.id)) return true;
    setMessage("이 레시피는 블라인드 테스트에 나갔어요. 선생님이 투표를 초기화하기 전까지 고칠 수 없어요.");
    return false;
  }
  async function save(shared: boolean) {
    if (!record || locked || checking || (shared && missing)) return;
    if (shared && !window.confirm(`우리 모둠(${groupLabel(group)}) 베스트 레시피로 제출할까요?\n같은 모둠에서 여러 명이 제출하면 가장 마지막 제출이 모둠 베스트가 돼요.`)) return;
    const final = { method, record: structuredClone(record), productName: name.trim(), tasteLine: line.trim(), keywords, spicyLevel: level, shared };
    if (!(await stillOpen())) return;
    setFinal(() => ({ ...final, savedAt: new Date().toISOString() }));
    setMessage(!shared ? "저장했어요. 아직 모둠 베스트로 제출하지는 않았어요." : testing ? "제출했어요. 이번 투표에는 들어가지 않고, 다음 블라인드 테스트부터 반영돼요." : "제출했어요! 선생님 화면에 우리 모둠 제출로 표시돼요.");
  }
  async function cancel() {
    if (!saved || locked || checking || !window.confirm("모둠 베스트 제출을 취소할까요? 기록과 스티커는 그대로 남아요.")) return;
    if (!(await stillOpen())) return;
    setFinal((final) => final && { ...final, shared: false });
    setMessage("제출을 취소했어요. 언제든 다시 제출할 수 있어요.");
  }
  return <section className="final-notebook gb-submit"><div className="page-heading"><div><span className="eyebrow">GROUP BEST</span><h1>모둠 베스트 제출</h1></div><p>모둠에서 가장 맛있는 레시피 하나를 골라 제출해요. 제출한 레시피는 블라인드 테스트에 나가요.</p></div>
    {submitted && saved ? <div className="gb-sub-status done"><span className="gb-sub-badge">제출 완료</span><div><strong>우리 모둠 베스트 레시피로 제출했어요</strong><p>{saved.productName || "이름 없는 라면"} · {time(saved.savedAt)} 제출</p></div>{!locked && <button onClick={() => void cancel()} disabled={checking}>제출 취소</button>}</div>
      : <div className="gb-sub-status"><span className="gb-sub-badge todo">미제출</span><div><strong>아직 제출하지 않았어요</strong><p>{needRecord || (saved ? "저장만 해 둔 레시피가 있어요. 제출해야 선생님 화면에 모여요." : "라면 이름을 짓고 우리 모둠 베스트로 제출해요.")}</p></div>{needRecord && <button className="gb-sub-go" onClick={() => onGoRecord(method)}>레시피 기록으로 가기</button>}</div>}
    {locked && <p className="gb-sub-lock" role="note">{testing ? "지금 블라인드 테스트에서 맛보는 레시피예요. 선생님이 투표를 초기화하기 전까지 고치거나 취소할 수 없어요." : "블라인드 테스트에 나간 레시피라 결과가 바뀌지 않도록 고정했어요. 선생님이 투표를 초기화하면 다시 고칠 수 있어요."}</p>}
    {!locked && testing && <p className="gb-sub-lock" role="note">블라인드 테스트가 진행 중이에요. 지금 제출하면 이번 투표에는 들어가지 않아요.</p>}
    <fieldset className="gb-sub-fields" disabled={locked}>
      <div className="label-fields"><label><span>제출할 라면 기록</span><select aria-label="제출할 라면 기록" value={method} onChange={(e) => setMethod(e.target.value as RecipeMethod)}>{(["base", "commercial"] as const).map((m) => <option key={m} value={m}>{METHOD_NAMES[m]}</option>)}</select></label><label><span>라면 이름</span><input maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="우리 모둠 라면에 이름을 지어 주세요" /></label><label><span>한 줄 소개</span><input maxLength={60} value={line} onChange={(e) => setLine(e.target.value)} placeholder="예: 매콤하고 고소한 국물" /></label><label><span>맵기 단계</span><select aria-label="맵기 단계" value={level} onChange={(e) => setLevel(Number(e.target.value))}>{[0,1,2,3].map((n) => <option key={n} value={n}>{n}단계</option>)}</select></label></div>
      <div className="taste-keywords"><strong>기록에서 맛 키워드 고르기 (최대 3개, 선택)</strong><div>{words.map((w) => <button className={keywords.includes(w) ? "active" : ""} key={w} onClick={() => setKeywords(keywords.includes(w) ? keywords.filter((x) => x !== w) : keywords.length < 3 ? [...keywords, w] : keywords)}>{w}</button>)}</div>{!words.length && <p>맛 느낌을 적으면 여기에서 고를 수 있어요.</p>}</div>
    </fieldset>
    <RecipeReadout record={record} settings={settings} noodles title={METHOD_NAMES[method]} />
    {!locked && missing && (submitted || !needRecord) && <p className="gb-sub-note strong">제출하려면 {missing}</p>}
    {submitted && changed && !locked && !missing && <p className="gb-sub-note strong">바뀐 내용이 있어요. &lsquo;다시 제출하기&rsquo;를 눌러야 반영돼요.</p>}
    <div className="record-actions gb-sub-actions"><button className={submitted && !changed ? undefined : "gb-sub-submit"} onClick={() => void save(true)} disabled={Boolean(missing) || locked || checking}>{submitted ? "다시 제출하기" : "모둠 베스트 레시피 제출"}</button>{!submitted && <button onClick={() => void save(false)} disabled={!record || locked || checking}>제출하지 않고 저장만</button>}</div>
    <p className="gb-sub-note">같은 모둠에서 여러 명이 제출하면 가장 마지막에 제출한 레시피가 모둠 베스트가 돼요. 모둠 친구들과 한 명만 제출하기로 정해요.</p><p role="status">{message}</p>
    {saved && <><div className="sticker-toolbar"><label>모양<select aria-label="스티커 모양" value={shape} onChange={(e) => setShape(e.target.value as typeof shape)}><option value="circle">원형 · 지름 9cm</option><option value="square">사각 · 9 × 9cm</option></select></label><label>인쇄할 이름 (선택)<input value={printName} maxLength={30} onChange={(e) => setPrintName(e.target.value)} placeholder="서버에는 저장하지 않아요" /></label><button onClick={() => window.print()}>앞·뒷면 인쇄</button></div><p>저장한 레시피로 스티커를 만들어요. 인쇄는 A4 · 실제 크기 100% · 머리글/바닥글 끄기. 이름을 비우면 연구원 번호로 나옵니다.</p><div className="sticker-sheet print-target"><StickerPair project={project} settings={settings} shape={shape} printName={printName} /></div></>}
  </section>;
}
