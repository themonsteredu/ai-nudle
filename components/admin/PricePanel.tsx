"use client";
import { ingredientUnitCost } from "@/lib/costs";
import { categoryLabel } from "@/lib/ingredient-categories";
import type { AppSettings, Ingredient, Topping } from "@/lib/types";
const numeric = (value: string) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
/** Purchase price and weight of soups, additives and toppings. Adding or deleting items stays on the 교사 화면. */
export function PricePanel({ settings, setSettings }: { settings: AppSettings; setSettings: (s: AppSettings) => void }) {
  const ingredients = [...settings.ingredients].sort((a, b) => a.order - b.order);
  const toppings = [...settings.toppings].sort((a, b) => a.order - b.order);
  const setIngredient = (id: string, change: Partial<Ingredient>) => setSettings({ ...settings, ingredients: settings.ingredients.map((x) => x.id === id ? { ...x, ...change } : x) });
  const setTopping = (id: string, change: Partial<Topping>) => setSettings({ ...settings, toppings: settings.toppings.map((x) => x.id === id ? { ...x, ...change } : x) });
  const table = (title: string, rows: (Ingredient | Topping)[], update: (id: string, change: { purchasePrice?: number; purchaseWeight?: number }) => void) => <section className="adm-price-block">
    <h2>{title} <small>{rows.length}개</small></h2>
    {rows.length ? <div className="supply-table-wrap"><table className="admin-table adm-price-table"><thead><tr><th>이름</th><th>종류</th><th>구입가격 (원)</th><th>구입중량 (g)</th><th>g당 단가</th></tr></thead>
      <tbody>{rows.map((item) => <tr key={item.id} className={item.enabled ? "" : "adm-off"}>
        <td><strong>{item.displayName || item.name}</strong>{!item.enabled && <small> · 숨김</small>}</td>
        <td>{"category" in item ? categoryLabel(item.category) : "건더기"}</td>
        <td><input type="number" min="0" inputMode="numeric" aria-label={`${item.displayName} 구입가격`} value={item.purchasePrice} onChange={(e) => update(item.id, { purchasePrice: numeric(e.target.value) })} /></td>
        <td><input type="number" min="0" inputMode="decimal" aria-label={`${item.displayName} 구입중량`} value={item.purchaseWeight} onChange={(e) => update(item.id, { purchaseWeight: numeric(e.target.value) })} /></td>
        <td><strong>{ingredientUnitCost(item.purchasePrice, item.purchaseWeight).toFixed(1)}원/g</strong></td>
      </tr>)}</tbody></table></div> : <p className="empty-record">아직 없어요.</p>}
  </section>;
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>PRICES</span><h1>재료 단가</h1><p>스프·첨가물·건더기의 구입가격과 구입중량을 적으면 원가에 자동 반영돼요. 재료 추가·삭제는 교사 화면 &apos;스프·첨가물 관리&apos;와 &apos;건더기 관리&apos;에서 해요.</p></div></header>
    {table("스프·첨가물", ingredients, setIngredient)}
    {table("건더기", toppings, setTopping)}
  </section>;
}
