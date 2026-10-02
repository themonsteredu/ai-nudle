"use client";
import { availableItems, formatGrams } from "@/lib/notebook";
import type { AppSettings, RecipeMethod, RecipeRecord } from "@/lib/types";
import { AllergenNotice } from "../recipe/Allergens";
export function RecipeEditor({ record, settings, method, tasting, title, onChange, onCopy }: { record: RecipeRecord; settings: AppSettings; method: RecipeMethod; tasting: boolean; title: string; onChange: (r: RecipeRecord) => void; onCopy?: () => void }) {
  const items = availableItems(settings, method, tasting);
  const lesson = settings.classes?.[0];
  const update = (change: Partial<RecipeRecord>) => onChange({ ...record, ...change, updatedAt: new Date().toISOString() });
  const removed = record.items.filter((x) => !items.some((i) => i.id === x.id));
  return <section className="recipe-editor"><header><span className="eyebrow">RECIPE NOTE</span><h2>{title}</h2><p>넣은 재료의 무게를 g으로 적어요. 쓰는 대로 저장됩니다.</p></header>
    <div className="record-water">이 기록 · 물 {record.waterMl}ml{tasting && <> · 면 {record.noodleFraction}개 · {record.cookMinutes}분</>}
      {lesson && (record.waterMl !== lesson.waterMl || record.cookMinutes !== lesson.cookMinutes || record.noodleFraction !== lesson.noodleFraction) && <button onClick={() => update({ waterMl: lesson.waterMl, cookMinutes: lesson.cookMinutes, noodleFraction: lesson.noodleFraction })}>현재 교사 설정 가져오기</button>}</div>
    <div className="gram-rows">{items.map((item) => { const selected = record.items.find((x) => x.id === item.id); return <label className="gram-row" key={item.id}><span><small>{item.category}</small><strong>{item.name}</strong><em>{item.allergenChecked ? "포장 확인 완료" : "알레르기 확인 전"}</em></span><span className="gram-input"><input aria-label={`${item.name} 양(g)`} type="number" min="0" max="1000" step="0.01" inputMode="decimal" placeholder="0" value={selected?.amount || ""} onChange={(e) => { const amount = Number(e.target.value); if (!Number.isFinite(amount) || amount < 0 || amount > 1000) return; const next = record.items.filter((x) => x.id !== item.id); if (amount > 0) next.push({ ...item, amount }); update({ items: next }); }} /><b>g</b></span></label>; })}</div>
    {removed.length > 0 && <aside className="historical-ingredients"><strong>이전에 사용한 재료</strong><p>지금은 학생 선택 목록에서 빠져 있지만, 기록은 남아 있어요.</p>{removed.map((x) => <p key={x.id}>{x.name} {formatGrams(x.amount)}</p>)}</aside>}
    {record.items.some((x) => x.category === "SPECIAL" && x.amount > 0) && <p className="special-tip">치즈·카레에도 간이 있어요. 기본 베이스를 조금 줄일지 선생님과 함께 살펴보세요.</p>}
    <label className="taste-note"><strong>맛 느낌 한 줄</strong><input maxLength={500} placeholder="예: 처음보다 마늘 향이 진해졌어요." value={record.note} onChange={(e) => update({ note: e.target.value })} /></label>
    <AllergenNotice record={record} settings={settings} noodles={tasting} />
    {onCopy && <div className="record-actions"><button className="filled" onClick={onCopy}>이 레시피를 라면 기록으로 복사</button></div>}
  </section>;
}
export function RecipeReadout({ record, settings, noodles = false, title }: { record?: RecipeRecord; settings: AppSettings; noodles?: boolean; title: string }) {
  return <article className="recipe-readout"><h3>{title}</h3>{record ? <><p className="record-water">{record.waterMl > 0 ? `물 ${record.waterMl}ml` : "이전 기록 · 물 양·시간 미저장"}{noodles && <> · 면 {record.noodleFraction}개 · {record.cookMinutes}분</>}</p><dl>{record.items.filter((x) => x.amount > 0).map((x) => <div key={x.id}><dt>{x.name}</dt><dd>{formatGrams(x.amount)}</dd></div>)}</dl>{record.items.length === 0 && <p>아직 재료를 적지 않았어요.</p>}<blockquote>{record.note || "아직 맛 느낌을 적지 않았어요."}</blockquote><AllergenNotice record={record} settings={settings} noodles={noodles} /></> : <p className="empty-record">아직 기록이 없어요.</p>}</article>;
}
