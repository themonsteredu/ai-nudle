"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { formatGrams, recipeAllergens } from "@/lib/notebook";
import { groupLabel, groupOf } from "@/lib/groups";
import type { AppSettings, BlindSample, StudentProject } from "@/lib/types";

/** Only the current round's samples appear here, in the same blind-letter order as the ballot. */
export function BlindRecipeOverview({ samples, projects, settings, revealed, onOpen }: {
  samples: BlindSample[]; projects: StudentProject[]; settings: AppSettings; revealed: boolean; onOpen: (index: number) => void;
}) {
  const [fit, setFit] = useState(true);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const byId = new Map(projects.map((project) => [project.id, project]));
  const recipes = samples.map((sample) => byId.get(sample.projectId));
  const finals = recipes.map((project) => project?.notebook?.final);
  const ingredients = new Map<string, string>();
  for (const final of finals) for (const item of final?.record.items ?? []) {
    if (item.amount > 0) ingredients.set(`${item.id}:${item.name}`, item.name);
  }
  const allergies = finals.map((final) => final ? recipeAllergens(final.record, settings, true) : undefined);

  // Measure the entire table, including long ingredient and allergy text. Nothing is clipped to fit.
  useLayoutEffect(() => {
    const stage = viewport.current;
    const table = content.current;
    if (!stage || !table) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = Math.max(stage.clientWidth, 180 + samples.length * 106);
        table.style.width = `${width}px`;
        const naturalWidth = Math.max(width, table.scrollWidth);
        const scale = fit ? Math.min(1, stage.clientWidth / naturalWidth, stage.clientHeight / Math.max(1, table.offsetHeight)) : 1;
        table.style.transform = `scale(${scale})`;
        table.style.left = fit ? `${Math.max(0, (stage.clientWidth - naturalWidth * scale) / 2)}px` : "0px";
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(table);
    measure();
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [fit, samples.length]);

  return <section className="gb-overview" aria-label="전체 블라인드 레시피 비교">
    <header className="gb-overview-toolbar"><div><h2>전체 레시피 한눈에</h2><p>{samples.length}개 레시피 · 재료와 양을 함께 비교해요. 레시피 글자를 누르면 크게 볼 수 있어요.</p></div><button type="button" className="gb-toggle" aria-pressed={fit} onClick={() => setFit(!fit)}><i />화면에 맞추기</button></header>
    <div ref={viewport} className={`gb-overview-viewport${fit ? " fit" : ""}`} tabIndex={fit ? undefined : 0}>
      <div ref={content} className="gb-overview-content"><table className="gb-overview-table">
        <caption>블라인드 레시피별 재료와 조리 조건</caption>
        <colgroup><col className="gb-overview-label-column" />{samples.map((sample) => <col key={sample.label} />)}</colgroup>
        <thead><tr><th scope="col">재료 · 조리 조건</th>{samples.map((sample, index) => <th key={sample.label} scope="col"><button type="button" className="gb-overview-letter" onClick={() => onOpen(index)} aria-label={`레시피 ${sample.label} 크게 보기`}><small>레시피</small><b>{sample.label}</b></button>{revealed && <div className="gb-overview-identity"><strong>{groupOf(recipes[index]) ? groupLabel(groupOf(recipes[index])!) : "모둠 정보 없음"}</strong><span>{finals[index]?.productName || "이름 없는 라면"}</span></div>}</th>)}</tr></thead>
        <tbody>
          {[...ingredients].map(([key, name]) => <tr key={key}><th scope="row">{name}</th>{finals.map((final, index) => {
            const amount = final?.record.items.filter((item) => `${item.id}:${item.name}` === key).reduce((sum, item) => sum + item.amount, 0) ?? 0;
            return <td key={samples[index].label} className={amount > 0 ? "gb-overview-amount" : "gb-overview-empty"}>{amount > 0 ? formatGrams(amount) : "—"}</td>;
          })}</tr>)}
          {!ingredients.size && <tr><th scope="row">재료</th>{finals.map((final, index) => <td key={samples[index].label}>{final ? "넣은 재료 없음" : "레시피 불러오는 중"}</td>)}</tr>}
          <tr className="gb-overview-cook"><th scope="row">물</th>{finals.map((final, index) => <td key={samples[index].label}>{final ? `${final.record.waterMl}ml` : "—"}</td>)}</tr>
          <tr className="gb-overview-cook"><th scope="row">라면사리</th>{finals.map((final, index) => <td key={samples[index].label}>{final ? `${final.record.noodleFraction}개` : "—"}</td>)}</tr>
          <tr className="gb-overview-cook"><th scope="row">조리 시간</th>{finals.map((final, index) => <td key={samples[index].label}>{final ? `${final.record.cookMinutes}분` : "—"}</td>)}</tr>
          <tr className="gb-overview-cook"><th scope="row">맵기</th>{finals.map((final, index) => <td key={samples[index].label}>{final ? `${final.spicyLevel}단계` : "—"}</td>)}</tr>
          <tr className="gb-overview-allergy"><th scope="row">알레르기 확인</th>{allergies.map((allergy, index) => <td key={samples[index].label}>{allergy ? <>{allergy.values.length > 0 && <span>{allergy.values.join(", ")}</span>}<strong className={allergy.unchecked ? "unverified" : ""}>{allergy.unchecked ? "미확인 재료 있음" : allergy.values.length ? "포장 확인 완료" : "확인된 항목 없음"}</strong></> : "레시피 불러오는 중"}</td>)}</tr>
          {allergies.some((allergy) => allergy?.notes.length) && <tr className="gb-overview-allergy"><th scope="row">제조시설 안내</th>{allergies.map((allergy, index) => <td key={samples[index].label}>{allergy?.notes.join(" · ") || "—"}</td>)}</tr>}
        </tbody>
      </table></div>
    </div>
    <p className="gb-overview-help">—는 넣지 않은 재료예요. 시식 전에는 선생님과 실제 포장의 알레르기 표시를 확인해요.</p>
  </section>;
}
