"use client";
import { useState } from "react";
import { formatGrams, recipeAllergens } from "@/lib/notebook";
import type { AppSettings, StudentProject } from "@/lib/types";
export function Pepper({ filled }: { filled: boolean }) {
  return <svg viewBox="0 0 32 36" width="22" height="25" aria-hidden="true"><path d="M20 10C19 5 23 3 26 3" fill="none" stroke="#496b45" strokeWidth="3" /><path d="M20 10C31 13 24 29 5 31C13 26 7 10 20 10Z" fill={filled ? "#cd4829" : "none"} stroke="#a17b60" strokeWidth="1.7" /></svg>;
}
export function StickerPair({ project, settings, printName = "", shape }: { project: StudentProject; settings: AppSettings; printName?: string; shape: "circle" | "square" }) {
  const final = project.notebook?.final;
  if (!final) return null;
  const r = final.record;
  const allergy = recipeAllergens(r, settings, true);
  const recipe = r.items.filter((x) => x.amount > 0).map((x) => `${x.name} ${formatGrams(x.amount)}`).join(" · ");
  const allergyText = [allergy.values.length ? `함유: ${allergy.values.join(", ")}` : "포장에 확인된 항목 없음", allergy.unchecked ? "아직 확인하지 않은 재료가 있어요. 선생님께 확인하세요." : "맛보기 전 선생님께 확인하세요.", ...allergy.notes.map((x) => `제조시설: ${x}`)].join(" ");
  // Long ingredient/allergen text gets extra reverse labels, never clipped or omitted.
  const chunks = (text: string, size: number) => Array.from({ length: Math.max(1, Math.ceil(Array.from(text).length / size)) }, (_, i) => Array.from(text).slice(i * size, (i + 1) * size).join(""));
  const ingredients = chunks(recipe, 80);
  const allergies = chunks(allergyText, 90);
  const pages = Math.max(ingredients.length, allergies.length);
  return <><article className={`product-sticker sticker-front ${shape}`}><span className="sticker-eyebrow">나의 라면 연구소</span><h2 style={{ fontSize: final.productName.length > 16 ? "14pt" : "18pt" }}>{final.productName || "나만의 라면"}</h2><p>{final.tasteLine || r.note}</p><div className="drawing-space"><span>여기에 내 라면을 그려요</span></div><div className="pepper-level" aria-label={`맵기 ${final.spicyLevel}단계`}>{[1,2,3].map((x) => <Pepper key={x} filled={x <= final.spicyLevel} />)}<span>{final.spicyLevel}단계</span></div><div className="sticker-keywords">{final.keywords.join(" · ")}</div><small>앞면 · 수업용</small></article>
    {Array.from({ length: pages }, (_, index) => <article key={index} className={`product-sticker sticker-back ${shape}`}><h3>{final.productName || "나만의 라면"}</h3>{ingredients[index] && <section><b>재료와 배합{index > 0 ? " (계속)" : ""}</b><p>{ingredients[index]}</p></section>}<section><b>조리법</b><p>물 {r.waterMl}ml · 면 {r.noodleFraction}개<br />선생님과 조리하고 {r.cookMinutes}분 기다려요.</p></section>{allergies[index] && <section className="sticker-allergens"><b>알레르기 정보{index > 0 ? " (계속)" : ""}</b><p>{allergies[index]}</p></section>}<footer><p>개발 연구원: {printName.trim() || (project.researcherNumber ? `${project.researcherNumber}번 연구원` : "________________")}</p><p>개발일: {new Date(final.savedAt).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}</p><small>뒷면{pages > 1 ? ` ${index+1}/${pages} · 모두 붙여 주세요` : " · 수업용"}</small></footer></article>)}
  </>;
}
export function StickerPrintPanel({ projects, settings }: { projects: StudentProject[]; settings: AppSettings }) {
  const [shape, setShape] = useState<"circle" | "square">("circle");
  const [names, setNames] = useState<Record<string,string>>({});
  const eligible = projects.filter((x) => x.notebook?.final);
  return <section className="sticker-print-panel"><div className="sticker-toolbar"><label>모양<select value={shape} onChange={(e) => setShape(e.target.value as typeof shape)}><option value="circle">원형 · 지름 9cm</option><option value="square">사각 · 9 × 9cm</option></select></label><button className="teacher-primary" disabled={!eligible.length} onClick={() => window.print()}>반 전체 스티커 인쇄</button></div><p>앞·뒷면이 순서대로 나옵니다. A4 · 실제 크기 100% · 머리글/바닥글 끄기로 인쇄해 주세요. 긴 내용은 뒷면을 나누어 빠짐없이 출력합니다.</p><details><summary>스티커에 이름 넣기 (선택)</summary><p>입력한 이름은 인쇄에만 쓰며 서버에 저장하지 않습니다.</p>{eligible.map((p,i) => <label className="admin-field" key={p.id}><span>{p.researcherNumber ?? i+1}번 연구원 · {p.notebook?.final?.productName}</span><input value={names[p.id] ?? ""} maxLength={30} onChange={(e) => setNames({ ...names, [p.id]: e.target.value })} /></label>)}</details>{!eligible.length && <p>이 반에 저장한 최종 레시피가 아직 없습니다.</p>}<div className="sticker-sheet print-target">{eligible.map((p) => <StickerPair key={p.id} project={p} settings={settings} shape={shape} printName={names[p.id]} />)}</div></section>;
}
