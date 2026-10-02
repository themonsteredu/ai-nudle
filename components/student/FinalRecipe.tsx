"use client";
import { useState } from "react";
import { METHOD_NAMES } from "@/lib/notebook";
import type { AppSettings, RecipeMethod, StudentProject } from "@/lib/types";
import { RecipeReadout } from "./RecipeNotebook";
import { StickerPair } from "../recipe/Stickers";
export function FinalRecipe({ project, settings, update }: { project: StudentProject; settings: AppSettings; update: (p: StudentProject) => void }) {
  const saved = project.notebook?.final;
  const [method, setMethod] = useState<RecipeMethod>(saved?.method ?? "base");
  const [name, setName] = useState(saved?.productName ?? "");
  const [line, setLine] = useState(saved?.tasteLine ?? "");
  const [keywords, setKeywords] = useState<string[]>(saved?.keywords ?? []);
  const [level, setLevel] = useState(saved?.spicyLevel ?? 0);
  const [shape, setShape] = useState<"circle" | "square">("circle");
  const [printName, setPrintName] = useState("");
  const [message, setMessage] = useState("");
  const record = project.notebook?.[method].tasting;
  const words = Array.from(new Set([...(project.notebook?.base.practices ?? []), ...(project.notebook?.commercial.practices ?? []), project.notebook?.base.tasting, project.notebook?.commercial.tasting].flatMap((x) => x?.note.split(/[\s,.!?·，。]+/).filter((w) => w.length > 1 && w.length <= 20) ?? []))).slice(0, 40);
  function save() {
    if (!record || !project.notebook) return;
    update({ ...project, notebook: { ...project.notebook, final: { method, record: structuredClone(record), productName: name.trim(), tasteLine: line.trim(), keywords, spicyLevel: level, savedAt: new Date().toISOString(), shared: saved?.shared ?? false } } });
    setMessage("최종 레시피를 기록했어요. 아래 스티커를 인쇄할 수 있어요.");
  }
  return <section className="final-notebook"><div className="page-heading"><div><span className="eyebrow">MY RAMEN</span><h1>완제품 스티커</h1></div><p>만들고 싶을 때만 열어도 좋아요.</p></div>
    <div className="label-fields"><label><span>스티커에 담을 라면 기록</span><select aria-label="스티커에 담을 라면 기록" value={method} onChange={(e) => setMethod(e.target.value as RecipeMethod)}>{(["base", "commercial"] as const).map((m) => <option key={m} value={m}>{METHOD_NAMES[m]}</option>)}</select></label><label><span>라면 이름</span><input maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="내 라면에 이름을 지어 주세요" /></label><label><span>한 줄 소개</span><input maxLength={60} value={line} onChange={(e) => setLine(e.target.value)} /></label><label><span>맵기 단계</span><select aria-label="맵기 단계" value={level} onChange={(e) => setLevel(Number(e.target.value))}>{[0,1,2,3].map((n) => <option key={n} value={n}>{n}단계</option>)}</select></label></div>
    <div className="taste-keywords"><strong>내 기록에서 맛 키워드 고르기 (최대 3개, 선택)</strong><div>{words.map((w) => <button className={keywords.includes(w) ? "active" : ""} key={w} onClick={() => setKeywords(keywords.includes(w) ? keywords.filter((x) => x !== w) : keywords.length < 3 ? [...keywords, w] : keywords)}>{w}</button>)}</div>{!words.length && <p>맛 느낌을 적으면 여기에서 고를 수 있어요.</p>}</div>
    <RecipeReadout record={record} settings={settings} noodles title={METHOD_NAMES[method]} />
    <div className="record-actions"><button className="filled" onClick={save} disabled={!record}>최종 레시피 저장</button></div>{!record && <p>이 탭의 라면 시식 기록을 먼저 적어 주세요. 국물 연습만으로도 기록은 저장됩니다.</p>}<p role="status">{message}</p>
    {saved && <><div className="sticker-toolbar"><label>모양<select aria-label="스티커 모양" value={shape} onChange={(e) => setShape(e.target.value as typeof shape)}><option value="circle">원형 · 지름 9cm</option><option value="square">사각 · 9 × 9cm</option></select></label><label>인쇄할 이름 (선택)<input value={printName} maxLength={30} onChange={(e) => setPrintName(e.target.value)} placeholder="서버에는 저장하지 않아요" /></label><button onClick={() => window.print()}>앞·뒷면 인쇄</button><button onClick={() => update({ ...project, notebook: { ...project.notebook!, final: { ...saved, shared: !saved.shared } } })}>{saved.shared ? "반 공유 끄기" : "우리 반에 공유하기"}</button></div><p>인쇄는 A4 · 실제 크기 100% · 머리글/바닥글 끄기. 이름을 비우면 연구원 번호로 나옵니다.</p><div className="sticker-sheet print-target"><StickerPair project={project} settings={settings} shape={shape} printName={printName} /></div></>}
  </section>;
}
