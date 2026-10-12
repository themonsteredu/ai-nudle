"use client";

import { useMemo, useState } from "react";
import { calculateCosts, ingredientUnitCost, roundQuantity, won } from "@/lib/costs";
import { createId } from "@/lib/ids";
import { ADDITIVE_PRESETS, BASE_CATEGORY, categoryLabel } from "@/lib/ingredient-categories";
import type {
  AppSettings,
  Ingredient,
  StudentProject,
  SupplyCategory,
  SupplyItem,
  Topping,
} from "@/lib/types";
import { AllergenEditor } from "../recipe/Allergens";
import { StickerPrintPanel } from "../recipe/Stickers";
import { ProductLabelPreview } from "../student/RecipeLabel";

type SettingsSetter = (settings: AppSettings) => void;

const numeric = (value: string) => Number.isFinite(Number(value)) ? Number(value) : 0;

function moveItem<T extends { id: string; order: number }>(items: T[], id: string, direction: -1 | 1) {
  const ordered = [...items].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= ordered.length) return items;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
}

const CUSTOM_CATEGORY = "__custom__";
const isBase = (item: Ingredient) => item.category === BASE_CATEGORY;
/** What students see for an ingredient (availableItems uses displayName || name). */
const shownName = (item: Ingredient) => (item.displayName || item.name || "").trim();
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Students get one list sorted by `order` (availableItems), so 기본 스프 must come before every 첨가물 there too.
 * Keeps each section's own order and renumbers 1..n.
 */
function baseFirst(items: Ingredient[]) {
  return [...items]
    .sort((a, b) => Number(isBase(b)) - Number(isBase(a)) || a.order - b.order)
    .map((item, index) => item.order === index + 1 ? item : { ...item, order: index + 1 });
}

/** Swaps an item with its neighbour inside the same section (기본 스프 or 첨가물). */
function moveWithin(items: Ingredient[], id: string, direction: -1 | 1) {
  const ordered = baseFirst(items);
  const index = ordered.findIndex((x) => x.id === id);
  const target = index + direction;
  if (index < 0 || !ordered[target] || isBase(ordered[target]) !== isBase(ordered[index])) return items;
  [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  return ordered.map((x, i) => ({ ...x, order: i + 1 }));
}

/** Asks for a new 종류 name when '직접 입력…' is picked. */
function pickCategory(value: string, apply: (category: string) => void) {
  if (value !== CUSTOM_CATEGORY) return apply(value);
  const typed = window.prompt("새 종류 이름을 적어 주세요. (예: 감칠맛, 신맛)")?.trim().slice(0, 20);
  if (typed) apply(typed === categoryLabel(BASE_CATEGORY) ? BASE_CATEGORY : typed);
}

export function IngredientPanel({
  settings,
  setSettings,
  uploadImage,
}: {
  settings: AppSettings;
  setSettings: SettingsSetter;
  uploadImage: (file: File) => Promise<string>;
}) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("향");
  const [addError, setAddError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState("");
  const [recheck, setRecheck] = useState<string[]>([]);
  const categories = Array.from(new Set([...ADDITIVE_PRESETS, ...settings.ingredients.map((x) => x.category).filter((x) => x && x !== BASE_CATEGORY)]));
  const setIngredients = (ingredients: Ingredient[]) => setSettings({ ...settings, ingredients: baseFirst(ingredients) });
  function update(id: string, change: Partial<Ingredient>) {
    const item = settings.ingredients.find((x) => x.id === id);
    // A different product needs its package checked again.
    if (item?.allergenChecked && change.name !== undefined && change.name !== item.name) {
      change = { ...change, allergenChecked: false };
      setRecheck((ids) => ids.includes(id) ? ids : [...ids, id]);
    }
    setIngredients(settings.ingredients.map((x) => x.id === id ? { ...x, ...change } : x));
  }
  function add(event: React.FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const existing = settings.ingredients.find((x) => sameName(shownName(x), name));
    if (existing) {
      setAddError(`'${shownName(existing)}'은(는) 이미 ${isBase(existing) ? "기본 스프" : "첨가물"} 목록에 있어요${existing.enabled ? "" : " (학생 화면에서 숨김 · '학생 표시'를 켜면 돼요)"}. 다른 이름을 적어 주세요.`);
      return;
    }
    const id = createId("ingredient");
    const order = Math.max(0, ...settings.ingredients.map((x) => x.order)) + 1;
    setIngredients([...settings.ingredients, {
      id, name, displayName: name, category: newCategory, imageUrl: "",
      defaultAmount: 0, minAmount: 0, maxAmount: 20, step: 0.1, purchasePrice: 0, purchaseWeight: 100,
      allergen: "", allergens: [], allergenChecked: false, allergenOther: "", facilityNote: "", enabled: true, order,
    }]);
    setNewName("");
    setAddError("");
    setAdded(id);
  }
  function remove(item: Ingredient) {
    if (!window.confirm(`'${shownName(item)}'을(를) 삭제할까요?\n모든 반의 학생 선택 목록에서 빠지고, 이미 저장한 학생 레시피는 그대로 남아요.\n잠깐만 안 쓰려면 삭제 대신 '학생 표시'를 꺼 주세요.`)) return;
    setIngredients(settings.ingredients.filter((x) => x.id !== item.id));
    if (open === item.id) setOpen(null);
  }
  const ordered = baseFirst(settings.ingredients);
  const addedItem = ordered.find((x) => x.id === added);
  const sections = [
    { title: "기본 스프", note: "학생 '기본 베이스' 탭에서만 보여요. (쇠고기·멸치·사골 분말 등)", items: ordered.filter(isBase) },
    { title: "첨가물", note: "'기본 베이스'와 '시판 스프' 두 탭 모두에서 보여요.", items: ordered.filter((x) => !isBase(x)) },
  ];
  const kindOptions = (current: string) => <>
    <option value={BASE_CATEGORY}>{categoryLabel(BASE_CATEGORY)}</option>
    {[...categories, ...(current === BASE_CATEGORY || categories.includes(current) ? [] : [current])].map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
    <option value={CUSTOM_CATEGORY}>직접 입력…</option>
  </>;
  const row = (item: Ingredient, index: number, count: number) => {
    const expanded = open === item.id;
    const label = shownName(item);
    // While 학생에게 보이는 이름 follows 재료명, typing changes both; a blank box never clears 재료명.
    const rename = (displayName: string) => update(item.id, item.name === item.displayName && displayName.trim() ? { name: displayName, displayName } : { displayName });
    const duplicate = Boolean(label) && ordered.some((x) => x.id !== item.id && sameName(shownName(x), label));
    return <article key={item.id} id={`ing-${item.id}`} className={`ing-row${item.enabled ? "" : " off"}${added === item.id ? " new" : ""}`}>
      <div className="ing-main">
        <div className="ing-move"><button onClick={() => setIngredients(moveWithin(settings.ingredients, item.id, -1))} disabled={index === 0} aria-label={`${label} 위로`}>↑</button><button onClick={() => setIngredients(moveWithin(settings.ingredients, item.id, 1))} disabled={index === count - 1} aria-label={`${label} 아래로`}>↓</button></div>
        <label className="ing-name"><span>학생에게 보이는 이름</span><input value={item.displayName} maxLength={40} aria-invalid={!label || duplicate} onChange={(event) => rename(event.target.value)} placeholder={item.name.trim() || "이름을 적어 주세요"} /></label>
        <label className="ing-kind"><span>종류</span><select value={item.category} onChange={(event) => pickCategory(event.target.value, (category) => update(item.id, { category }))}>{kindOptions(item.category)}</select></label>
        <div className="ing-actions">
          <label className="switch-label"><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /><span />학생 표시</label>
          <button className="ing-more" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : item.id)}>{expanded ? "접기" : "자세히"}</button>
          <button className="danger-text ing-delete" onClick={() => remove(item)}>삭제</button>
        </div>
      </div>
      {!label && <p className="ing-warn">이름이 비어 있어요. 이름을 적어야 저장할 수 있어요.</p>}
      {duplicate && <p className="ing-warn">같은 이름이 또 있어요. 학생이 구분할 수 있게 이름을 바꿔 주세요.</p>}
      {label && !item.displayName.trim() && <p className="ing-warn soft">비워 두면 학생에게 &apos;{label}&apos;(으)로 보여요.</p>}
      <p className="ing-status">{item.allergenChecked ? "알레르기 포장 확인 완료" : recheck.includes(item.id) ? "재료명이 바뀌어 알레르기 포장 확인을 다시 해 주세요 ('자세히')" : "알레르기 포장 확인 전"}{item.enabled ? "" : " · 학생 화면에서 숨김"}</p>
      {expanded && <div className="ing-detail">
        <div className="admin-item-head">
          <label className="image-upload">
            {item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>사진<br />없음</span>}
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const url = await uploadImage(file);
              update(item.id, { imageUrl: url });
            }} />
          </label>
          <div><span className="item-order">사진 (선택)</span><p>눌러서 재료 사진을 올릴 수 있어요.</p></div>
        </div>
        <div className="admin-form-grid four">
          <Field label="재료명 (구입 상품명)"><input value={item.name} maxLength={60} onChange={(event) => update(item.id, { name: event.target.value })} /></Field>
          <Field label="기본 투입량 (g)"><input type="number" step="0.1" value={item.defaultAmount} onChange={(event) => update(item.id, { defaultAmount: numeric(event.target.value) })} /></Field>
          <Field label="최소량 (g)"><input type="number" step="0.1" value={item.minAmount} onChange={(event) => update(item.id, { minAmount: numeric(event.target.value) })} /></Field>
          <Field label="최대량 (g)"><input type="number" step="0.1" value={item.maxAmount} onChange={(event) => update(item.id, { maxAmount: numeric(event.target.value) })} /></Field>
          <Field label="조절 단위 (g)"><input type="number" step="0.1" value={item.step} onChange={(event) => update(item.id, { step: Math.max(0.1, numeric(event.target.value)) })} /></Field>
        </div>
        <AllergenEditor value={item} onChange={(change) => update(item.id, change)} />
      </div>}
    </article>;
  };
  return (
    <TeacherPanelHeading eyebrow="SOUP · ADDITIVES" title="스프·첨가물 관리" description="학생 레시피 기록에 나오는 재료예요. 모든 반에 함께 적용돼요. 추가·삭제한 뒤 위의 '설정 저장'을 눌러야 학생 화면에 반영돼요.">
      <form className="ing-add" onSubmit={add}>
        <strong>새 재료 추가</strong>
        <label><span>이름</span><input value={newName} maxLength={40} onChange={(event) => { setNewName(event.target.value); setAddError(""); }} placeholder="예: 다시마분말, 간장분말" /></label>
        <label><span>종류</span><select value={newCategory} onChange={(event) => pickCategory(event.target.value, setNewCategory)}>{kindOptions(newCategory)}</select></label>
        <button className="teacher-primary" disabled={!newName.trim()}>＋ 추가</button>
      </form>
      {addError && <p className="ing-added ing-error" role="alert">{addError}</p>}
      {addedItem && <p className="ing-added" role="status">추가했어요. &apos;{shownName(addedItem)}&apos;은(는) 아래 {isBase(addedItem) ? "기본 스프" : "첨가물"} 목록에 있어요. 위의 &apos;설정 저장&apos;을 눌러 주세요. 알레르기는 &apos;자세히&apos;에서 포장을 보고 체크해 주세요. <button type="button" className="ing-jump" onClick={() => document.getElementById(`ing-${addedItem.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>추가한 재료 보기 ↓</button></p>}
      {sections.map((section) => <section className="ing-section" key={section.title}>
        <header><h2>{section.title} <small>{section.items.length}개</small></h2><p>{section.note}</p></header>
        {section.items.length ? section.items.map((item, index) => row(item, index, section.items.length)) : <p className="empty-record">아직 없어요. 위에서 추가해 주세요.</p>}
      </section>)}
    </TeacherPanelHeading>
  );
}

export function ToppingPanel({
  settings,
  setSettings,
  uploadImage,
}: {
  settings: AppSettings;
  setSettings: SettingsSetter;
  uploadImage: (file: File) => Promise<string>;
}) {
  function update(id: string, change: Partial<Topping>) {
    setSettings({ ...settings, toppings: settings.toppings.map((item) => item.id === id ? { ...item, ...change } : item) });
  }
  function add() {
    setSettings({ ...settings, toppings: [...settings.toppings, {
      id: createId("topping"), name: "새 건더기", displayName: "새 건더기", imageUrl: "",
      amountPerStudent: 1, purchasePrice: 0, purchaseWeight: 100, allergen: "",
      enabled: true, order: settings.toppings.length + 1,
    }] });
  }
  return (
    <TeacherPanelHeading eyebrow="TOPPINGS" title="건더기 재료 관리" description="수업에 사용할 건더기만 켜 두면 준비물 목록에 자동 반영됩니다. 구입가격은 관리자 화면 '재료 단가'에서 적어요." action={<button className="teacher-primary" onClick={add}>＋ 건더기 추가</button>}>
      <div className="teacher-list ingredient-admin-list">
        {[...settings.toppings].sort((a, b) => a.order - b.order).map((item, index) => (
          <article className={`admin-item ${item.enabled ? "" : "disabled-item"}`} key={item.id}>
            <div className="admin-item-head">
              <label className="image-upload">{item.imageUrl ? <img src={item.imageUrl} alt="" /> : <span>사진<br />없음</span>}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => { const file = event.target.files?.[0]; if (file) update(item.id, { imageUrl: await uploadImage(file) }); }} /></label>
              <div><span className="item-order">건더기 {String(index + 1).padStart(2, "0")}</span><h3>{item.displayName}</h3><p>1인 {item.amountPerStudent}g</p></div>
              <div className="admin-actions">
                <button onClick={() => setSettings({ ...settings, toppings: moveItem(settings.toppings, item.id, -1) })}>↑</button><button onClick={() => setSettings({ ...settings, toppings: moveItem(settings.toppings, item.id, 1) })}>↓</button>
                <label className="switch-label"><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /><span />사용</label>
                <button className="danger-text" onClick={() => { if (window.confirm("이 건더기를 삭제할까요?")) setSettings({ ...settings, toppings: settings.toppings.filter((value) => value.id !== item.id) }); }}>삭제</button>
              </div>
            </div>
            <div className="admin-form-grid four">
              <Field label="건더기명"><input value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} /></Field>
              <Field label="학생 표시명"><input value={item.displayName} onChange={(event) => update(item.id, { displayName: event.target.value })} /></Field>
              <Field label="1인 사용량 (g)"><input type="number" step="0.1" value={item.amountPerStudent} onChange={(event) => update(item.id, { amountPerStudent: numeric(event.target.value) })} /></Field>

            </div>
            <AllergenEditor value={item} onChange={(change) => update(item.id, change)} />
          </article>
        ))}
      </div>
    </TeacherPanelHeading>
  );
}

const SUPPLY_TITLES: Record<SupplyCategory, [string, string, string]> = {
  noodle: ["NOODLES", "사리면 설정", "기본값은 시식용 1개와 최종 제품용 1개, 학생 1명당 총 2개입니다."],
  tasting: ["TASTING CUPS", "시식컵 설정", "국물 연습과 두 번의 라면 시식에 맞게 준비 수량을 입력하세요."],
  container: ["FINAL CONTAINER", "최종 용기 설정", "학생이 집으로 가져갈 무지 라면용기 수량을 관리합니다."],
  consumable: ["CONSUMABLES", "기타 소모품", "소분팩·라벨지처럼 학생 수에 따라 늘어나는 항목입니다."],
  tool: ["TOOLS", "수업도구", "계량스푼처럼 고정 수량으로 준비하는 도구도 등록할 수 있습니다."],
};

export function SupplyPanel({ settings, setSettings, category }: { settings: AppSettings; setSettings: SettingsSetter; category: SupplyCategory }) {
  const [eyebrow, title, description] = SUPPLY_TITLES[category];
  const items = settings.supplies.filter((item) => item.category === category).sort((a, b) => a.order - b.order);
  function update(id: string, change: Partial<SupplyItem>) {
    setSettings({ ...settings, supplies: settings.supplies.map((item) => item.id === id ? { ...item, ...change } : item) });
  }
  function add() {
    setSettings({ ...settings, supplies: [...settings.supplies, {
      id: createId("supply"), name: "새 준비물", category, vendorNote: "", purchasePrice: 0,
      purchaseQuantity: 1, unit: "개", quantityPerStudent: 1, fixedQuantity: 0,
      enabled: true, order: settings.supplies.length + 1,
    }] });
  }
  return (
    <TeacherPanelHeading eyebrow={eyebrow} title={title} description={description} action={<button className="teacher-primary" onClick={add}>＋ 항목 추가</button>}>
      <div className="supply-table-wrap">
        <table className="admin-table">
          <thead><tr><th>사용</th><th>상품명</th><th>구입처 메모</th><th>구입가격</th><th>구입수량</th><th>단위</th><th>1인 수량</th><th>고정 수량</th><th>단위원가</th><th /></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}>
            <td><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /></td>
            <td><input value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} /></td>
            <td><input value={item.vendorNote} onChange={(event) => update(item.id, { vendorNote: event.target.value })} placeholder="선택" /></td>
            <td><input type="number" value={item.purchasePrice} onChange={(event) => update(item.id, { purchasePrice: numeric(event.target.value) })} /></td>
            <td><input type="number" value={item.purchaseQuantity} onChange={(event) => update(item.id, { purchaseQuantity: numeric(event.target.value) })} /></td>
            <td><input value={item.unit} onChange={(event) => update(item.id, { unit: event.target.value })} /></td>
            <td><input type="number" step="0.1" value={item.quantityPerStudent} onChange={(event) => update(item.id, { quantityPerStudent: numeric(event.target.value) })} /></td>
            <td><input type="number" step="0.1" value={item.fixedQuantity} onChange={(event) => update(item.id, { fixedQuantity: numeric(event.target.value) })} /></td>
            <td><strong>{won(ingredientUnitCost(item.purchasePrice, item.purchaseQuantity))}</strong></td>
            <td><button className="danger-text" onClick={() => { if (window.confirm("이 준비물을 삭제할까요?")) setSettings({ ...settings, supplies: settings.supplies.filter((value) => value.id !== item.id) }); }}>삭제</button></td>
          </tr>)}</tbody>
        </table>
      </div>
    </TeacherPanelHeading>
  );
}

export function CostPanel({ settings }: { settings: AppSettings }) {
  const [count, setCount] = useState(settings.studentCount);
  const summary = useMemo(() => calculateCosts(settings, count), [settings, count]);
  return (
    <TeacherPanelHeading eyebrow="COST" title="원가 자동계산" description="처음 결제할 준비비용과 이번 수업에서 실제 소비되는 원가를 나눠 봅니다.">
      <CountPicker count={count} setCount={setCount} />
      <div className="cost-hero">
        <div><span>1인 예상 재료비</span><strong>{won(summary.perStudentCost)}</strong></div>
        <div><span>실제 사용 원가</span><strong>{won(summary.usedCost)}</strong><small>수업에서 소비되는 양</small></div>
        <div className="accent"><span>총 준비비용</span><strong>{won(summary.purchaseCost)}</strong><small>포장 단위 최초 결제액</small></div>
      </div>
      <CostTable settings={settings} count={count} />
    </TeacherPanelHeading>
  );
}

export function ChecklistPanel({ settings }: { settings: AppSettings }) {
  const summary = calculateCosts(settings);
  const groups = ["식재료", "용기·소모품", "수업도구"] as const;
  return (
    <TeacherPanelHeading eyebrow="PREPARATION" title="준비물 자동 목록" description={`${settings.studentCount}명 기준으로 현재 사용 중인 항목만 표시합니다.`} action={<button className="teacher-primary" onClick={() => window.print()}>인쇄 / PDF</button>}>
      <div className="checklist-sheet print-target">
        <div className="print-title"><span>라면 R&amp;D 연구소</span><h1>준비물 체크리스트</h1><p>{settings.studentCount}명 · 라면 시식 2회 · 국물 연습 자유</p></div>
        <div className="checklist-columns">
          {groups.map((group) => <section key={group}><h2>{group}</h2>{summary.rows.filter((row) => row.category === group).map((row) => <label key={row.id}><input type="checkbox" /><span>{row.name}</span><strong>{roundQuantity(row.needed)}{row.unit}</strong></label>)}</section>)}
        </div>
        <section className="teacher-added-tools"><h2>현장 확인</h2>{["뜨거운 물 제공 도구", "집게", "쓰레기봉투", "키친타월", "손 소독제", "알레르기 확인표"].map((item) => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</section>
      </div>
    </TeacherPanelHeading>
  );
}

export function LabelsPanel({ settings, projects }: { settings: AppSettings; projects: StudentProject[] }) {
  const eligible = projects.filter((project) => !project.notebook && project.bestRecipeIndex !== null && project.label.productName);
  const ingredients = [...settings.ingredients].sort((a, b) => a.order - b.order);
  const finalScale = 1 / (settings.tastingNoodleFraction || 0.25);
  return (
    <TeacherPanelHeading eyebrow="LABELS" title="학생 라벨 모아보기" description="완성한 학생 라벨을 A4 한 장에 여러 장씩 자동 배치합니다." >
      {!eligible.length && <StickerPrintPanel projects={projects} settings={settings} />}
      {eligible.length > 0 && <button className="teacher-primary" onClick={() => window.print()}>이전 라벨 인쇄</button>}
      {eligible.length > 0 && (
        <div className="a4-label-sheet print-target">{eligible.map((project) => {
          const experiment = project.experiments[project.bestRecipeIndex ?? 0];
          return experiment ? <ProductLabelPreview key={project.id} project={project} ingredients={ingredients} bestExperiment={experiment} finalScale={finalScale} compact printTarget={false} /> : null;
        })}</div>
      )}
    </TeacherPanelHeading>
  );
}

export function PdfPanel({ settings }: { settings: AppSettings }) {
  const [document, setDocument] = useState<"guide" | "checklist" | "record">("guide");
  return (
    <TeacherPanelHeading eyebrow="PRINT PDF" title="교사용 PDF" description="현재 재료명·수량을 반영한 문서를 브라우저에서 PDF로 저장합니다. 원가계산표는 관리자 화면에서 인쇄해요." action={<button className="teacher-primary" onClick={() => window.print()}>현재 문서 인쇄 / PDF</button>}>
      <div className="document-tabs">
        <button className={document === "guide" ? "active" : ""} onClick={() => setDocument("guide")}>수업지도안</button>
        <button className={document === "checklist" ? "active" : ""} onClick={() => setDocument("checklist")}>준비물 체크리스트</button>
        <button className={document === "record" ? "active" : ""} onClick={() => setDocument("record")}>학생 실험 기록지</button>
      </div>
      <PrintDocument type={document} settings={settings} />
    </TeacherPanelHeading>
  );
}

/** 관리자 화면: prints the cost sheet on its own (the 교사 화면 PDF no longer has it). */
export function CostPrintPanel({ settings }: { settings: AppSettings }) {
  return (
    <TeacherPanelHeading eyebrow="PRINT" title="원가계산표 인쇄" description="현재 재료 단가·수량을 반영한 원가계산표를 PDF로 저장하거나 인쇄해요." action={<button className="teacher-primary" onClick={() => window.print()}>인쇄 / PDF</button>}>
      <PrintDocument type="cost" settings={settings} />
    </TeacherPanelHeading>
  );
}

function PrintDocument({ type, settings }: { type: "guide" | "checklist" | "cost" | "record"; settings: AppSettings }) {
  const costs = calculateCosts(settings);
  const ingredients = settings.ingredients.filter((item) => item.enabled).sort((a, b) => a.order - b.order);
  if (type === "guide") return <div className="print-document print-target"><PrintHead title="라면 R&D 수업지도안" settings={settings} /><h2>수업 목표</h2><p>학생이 식품개발연구원의 역할을 이해하고, 국물 배합 연습과 두 번의 라면 시식을 통해 자신이 만족하는 제품을 완성한다.</p><div className="lesson-print-grid"><section><h2>1차시</h2><ol><li>직업 이해</li><li>라면 제조공정</li><li>스프·건더기 역할</li><li>기본 베이스 국물 연습</li><li>라면사리 시식 1회</li></ol></section><section><h2>2차시</h2><ol><li>시판 스프 국물 연습</li><li>라면사리 시식 1회</li><li>마음에 드는 레시피 선택</li><li>최종 스프·라벨</li><li>실제 제품 포장</li></ol></section></div><h2>안전 확인</h2>{settings.safetyChecks.map((item) => <p className="print-check" key={item}>□ {item}</p>)}</div>;
  if (type === "checklist") return <div className="print-document print-target"><PrintHead title="준비물 체크리스트" settings={settings} />{(["식재료", "용기·소모품", "수업도구"] as const).map((group) => <section key={group}><h2>{group}</h2>{costs.rows.filter((row) => row.category === group).map((row) => <p className="print-check" key={row.id}>□ {row.name} <strong>{roundQuantity(row.needed)}{row.unit}</strong></p>)}</section>)}</div>;
  if (type === "cost") return <div className="print-document print-target"><PrintHead title="원가계산표" settings={settings} /><div className="print-cost-summary"><span>1인 {won(costs.perStudentCost)}</span><span>사용원가 {won(costs.usedCost)}</span><span>준비비용 {won(costs.purchaseCost)}</span></div><CostTable settings={settings} count={settings.studentCount} printable /></div>;
  return <div className="print-document print-target"><PrintHead title="학생용 실험 기록지" settings={settings} /><p>연구원명 ____________________　개발팀 ____________________</p><table className="print-record-table"><thead><tr><th>재료</th>{Array.from({ length: settings.testCount }, (_, index) => <th key={index}>R-{String(index + 1).padStart(2, "0")}</th>)}</tr></thead><tbody>{ingredients.map((item) => <tr key={item.id}><th>{item.displayName}</th>{Array.from({ length: settings.testCount }, (_, index) => <td key={index}>　　　 g</td>)}</tr>)}<tr><th>시식 메모</th>{Array.from({ length: settings.testCount }, (_, index) => <td key={index} className="memo-cell" />)}</tr></tbody></table><h2>BEST RECIPE</h2><p>선택: R-　　　제품명: ______________________________</p></div>;
}

function PrintHead({ title, settings }: { title: string; settings: AppSettings }) {
  return <header className="print-title"><span>FOOD R&amp;D LAB</span><h1>{title}</h1><p>{settings.className} · {settings.studentCount}명 · {new Date().toLocaleDateString("ko-KR")}</p></header>;
}

function CostTable({ settings, count, printable = false }: { settings: AppSettings; count: number; printable?: boolean }) {
  const summary = calculateCosts(settings, count);
  return <div className={`cost-table-wrap ${printable ? "printable" : ""}`}><table className="cost-table"><thead><tr><th>구분</th><th>항목</th><th>필요량</th><th>단위원가</th><th>사용원가</th><th>구입 묶음</th><th>준비비용</th></tr></thead><tbody>{summary.rows.map((row) => <tr key={`${row.category}-${row.id}`}><td>{row.category}</td><th>{row.name}</th><td>{roundQuantity(row.needed)}{row.unit}</td><td>{won(row.unitCost)}</td><td>{won(row.usedCost)}</td><td>{row.packCount}묶음</td><td>{won(row.purchaseCost)}</td></tr>)}</tbody></table></div>;
}

function CountPicker({ count, setCount }: { count: number; setCount: (count: number) => void }) {
  return <div className="count-picker"><span>학생 수</span>{[10, 20, 25, 30].map((value) => <button key={value} className={count === value ? "active" : ""} onClick={() => setCount(value)}>{value}명</button>)}<label>직접 입력 <input type="number" min="1" max="300" value={count} onChange={(event) => setCount(Math.max(1, numeric(event.target.value)))} />명</label></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="admin-field"><span>{label}</span>{children}</label>;
}

function TeacherPanelHeading({ eyebrow, title, description, action, children }: { eyebrow: string; title: string; description: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</header>{children}</section>;
}
