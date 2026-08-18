"use client";

import { useMemo, useState } from "react";
import { calculateCosts, ingredientUnitCost, roundQuantity, won } from "@/lib/costs";
import { createId } from "@/lib/ids";
import type {
  AppSettings,
  Ingredient,
  StudentProject,
  SupplyCategory,
  SupplyItem,
  Topping,
} from "@/lib/types";
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

export function IngredientPanel({
  settings,
  setSettings,
  uploadImage,
}: {
  settings: AppSettings;
  setSettings: SettingsSetter;
  uploadImage: (file: File) => Promise<string>;
}) {
  function update(id: string, change: Partial<Ingredient>) {
    setSettings({
      ...settings,
      ingredients: settings.ingredients.map((item) => item.id === id ? { ...item, ...change } : item),
    });
  }
  function add() {
    const order = settings.ingredients.length + 1;
    setSettings({
      ...settings,
      ingredients: [...settings.ingredients, {
        id: createId("ingredient"),
        name: "새 시즈닝",
        displayName: "새로운 맛",
        category: "기타",
        imageUrl: "",
        defaultAmount: 0,
        minAmount: 0,
        maxAmount: 2,
        step: 0.5,
        purchasePrice: 0,
        purchaseWeight: 100,
        allergen: "",
        enabled: true,
        order,
      }],
    });
  }
  function remove(id: string) {
    if (!window.confirm("이 스프 재료를 삭제할까요? 기존 학생 기록의 값은 화면에서 숨겨집니다.")) return;
    setSettings({ ...settings, ingredients: settings.ingredients.filter((item) => item.id !== id) });
  }
  return (
    <TeacherPanelHeading eyebrow="INGREDIENTS" title="스프 재료 관리" description="이 목록이 학생 LAB·비교표·라벨·원가표에 그대로 반영됩니다." action={<button className="teacher-primary" onClick={add}>＋ 재료 추가</button>}>
      <div className="teacher-list ingredient-admin-list">
        {[...settings.ingredients].sort((a, b) => a.order - b.order).map((item, index) => (
          <article className={`admin-item ${item.enabled ? "" : "disabled-item"}`} key={item.id}>
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
              <div><span className="item-order">재료 {String(index + 1).padStart(2, "0")}</span><h3>{item.displayName || "이름 없음"}</h3><p>{item.category || "분류 없음"}</p></div>
              <div className="admin-actions">
                <button onClick={() => setSettings({ ...settings, ingredients: moveItem(settings.ingredients, item.id, -1) })} aria-label="위로 이동">↑</button>
                <button onClick={() => setSettings({ ...settings, ingredients: moveItem(settings.ingredients, item.id, 1) })} aria-label="아래로 이동">↓</button>
                <label className="switch-label"><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /><span />학생 표시</label>
                <button className="danger-text" onClick={() => remove(item.id)}>삭제</button>
              </div>
            </div>
            <div className="admin-form-grid four">
              <Field label="재료명"><input value={item.name} onChange={(event) => update(item.id, { name: event.target.value })} /></Field>
              <Field label="학생 표시명"><input value={item.displayName} onChange={(event) => update(item.id, { displayName: event.target.value })} /></Field>
              <Field label="맛 카테고리"><input value={item.category} onChange={(event) => update(item.id, { category: event.target.value })} /></Field>
              <Field label="알레르기 정보"><input value={item.allergen} onChange={(event) => update(item.id, { allergen: event.target.value })} placeholder="없음 또는 해당 항목" /></Field>
              <Field label="기본 투입량 (g)"><input type="number" step="0.1" value={item.defaultAmount} onChange={(event) => update(item.id, { defaultAmount: numeric(event.target.value) })} /></Field>
              <Field label="최소량 (g)"><input type="number" step="0.1" value={item.minAmount} onChange={(event) => update(item.id, { minAmount: numeric(event.target.value) })} /></Field>
              <Field label="최대량 (g)"><input type="number" step="0.1" value={item.maxAmount} onChange={(event) => update(item.id, { maxAmount: numeric(event.target.value) })} /></Field>
              <Field label="조절 단위 (g)"><input type="number" step="0.1" value={item.step} onChange={(event) => update(item.id, { step: Math.max(0.1, numeric(event.target.value)) })} /></Field>
              <Field label="구입가격 (원)"><input type="number" value={item.purchasePrice} onChange={(event) => update(item.id, { purchasePrice: numeric(event.target.value) })} /></Field>
              <Field label="구입중량 (g)"><input type="number" value={item.purchaseWeight} onChange={(event) => update(item.id, { purchaseWeight: numeric(event.target.value) })} /></Field>
              <div className="calculated-field"><span>자동계산</span><strong>{ingredientUnitCost(item.purchasePrice, item.purchaseWeight).toFixed(1)}원/g</strong></div>
            </div>
          </article>
        ))}
      </div>
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
    <TeacherPanelHeading eyebrow="TOPPINGS" title="건더기 재료 관리" description="수업에 사용할 건더기만 켜 두면 준비물과 원가에 자동 반영됩니다." action={<button className="teacher-primary" onClick={add}>＋ 건더기 추가</button>}>
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
              <Field label="알레르기 정보"><input value={item.allergen} onChange={(event) => update(item.id, { allergen: event.target.value })} /></Field>
              <Field label="구입가격 (원)"><input type="number" value={item.purchasePrice} onChange={(event) => update(item.id, { purchasePrice: numeric(event.target.value) })} /></Field>
              <Field label="구입중량 (g)"><input type="number" value={item.purchaseWeight} onChange={(event) => update(item.id, { purchaseWeight: numeric(event.target.value) })} /></Field>
              <div className="calculated-field"><span>자동계산</span><strong>{ingredientUnitCost(item.purchasePrice, item.purchaseWeight).toFixed(1)}원/g</strong></div>
            </div>
          </article>
        ))}
      </div>
    </TeacherPanelHeading>
  );
}

const SUPPLY_TITLES: Record<SupplyCategory, [string, string, string]> = {
  noodle: ["NOODLES", "사리면 설정", "기본값은 시식용 1개와 최종 제품용 1개, 학생 1명당 총 2개입니다."],
  tasting: ["TASTING CUPS", "시식컵 설정", "4회 테스트 수량과 실제 구입 포장 단위를 입력하세요."],
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
        <div className="print-title"><span>라면 R&amp;D 연구소</span><h1>준비물 체크리스트</h1><p>{settings.studentCount}명 · TEST {settings.testCount}회</p></div>
        <div className="checklist-columns">
          {groups.map((group) => <section key={group}><h2>{group}</h2>{summary.rows.filter((row) => row.category === group).map((row) => <label key={row.id}><input type="checkbox" /><span>{row.name}</span><strong>{roundQuantity(row.needed)}{row.unit}</strong></label>)}</section>)}
        </div>
        <section className="teacher-added-tools"><h2>현장 확인</h2>{["뜨거운 물 제공 도구", "집게", "쓰레기봉투", "키친타월", "손 소독제", "알레르기 확인표"].map((item) => <label key={item}><input type="checkbox" /><span>{item}</span></label>)}</section>
      </div>
    </TeacherPanelHeading>
  );
}

export function LabelsPanel({ settings, projects }: { settings: AppSettings; projects: StudentProject[] }) {
  const eligible = projects.filter((project) => project.bestRecipeIndex !== null && project.label.productName);
  const ingredients = settings.ingredients.filter((item) => item.enabled).sort((a, b) => a.order - b.order);
  const finalScale = 1 / (settings.tastingNoodleFraction || 0.25);
  return (
    <TeacherPanelHeading eyebrow="LABELS" title="학생 라벨 모아보기" description="완성한 학생 라벨을 A4 한 장에 여러 장씩 자동 배치합니다." action={<button className="teacher-primary" onClick={() => window.print()} disabled={!eligible.length}>A4 라벨 인쇄</button>}>
      {!eligible.length ? <div className="empty-teacher"><strong>완성된 라벨이 아직 없습니다.</strong><p>학생이 BEST RECIPE와 제품명을 저장하면 여기에 나타납니다.</p></div> : (
        <div className="a4-label-sheet print-target">{eligible.map((project) => {
          const experiment = project.experiments[project.bestRecipeIndex ?? 0];
          return <ProductLabelPreview key={project.id} project={project} ingredients={ingredients} bestExperiment={experiment} finalScale={finalScale} compact printTarget={false} />;
        })}</div>
      )}
    </TeacherPanelHeading>
  );
}

export function PdfPanel({ settings }: { settings: AppSettings }) {
  const [document, setDocument] = useState<"guide" | "checklist" | "cost" | "record">("guide");
  return (
    <TeacherPanelHeading eyebrow="PRINT PDF" title="교사용 PDF" description="현재 재료명·단가·수량을 반영한 문서를 브라우저에서 PDF로 저장합니다." action={<button className="teacher-primary" onClick={() => window.print()}>현재 문서 인쇄 / PDF</button>}>
      <div className="document-tabs">
        <button className={document === "guide" ? "active" : ""} onClick={() => setDocument("guide")}>수업지도안</button>
        <button className={document === "checklist" ? "active" : ""} onClick={() => setDocument("checklist")}>준비물 체크리스트</button>
        <button className={document === "cost" ? "active" : ""} onClick={() => setDocument("cost")}>원가계산표</button>
        <button className={document === "record" ? "active" : ""} onClick={() => setDocument("record")}>학생 실험 기록지</button>
      </div>
      <PrintDocument type={document} settings={settings} />
    </TeacherPanelHeading>
  );
}

function PrintDocument({ type, settings }: { type: "guide" | "checklist" | "cost" | "record"; settings: AppSettings }) {
  const costs = calculateCosts(settings);
  const ingredients = settings.ingredients.filter((item) => item.enabled).sort((a, b) => a.order - b.order);
  if (type === "guide") return <div className="print-document print-target"><PrintHead title="라면 R&D 수업지도안" settings={settings} /><h2>수업 목표</h2><p>학생이 식품개발연구원의 역할을 이해하고, 4회 배합·시식·수정 과정을 통해 자신이 만족하는 제품을 완성한다.</p><div className="lesson-print-grid"><section><h2>1차시</h2><ol><li>직업 이해</li><li>라면 제조공정</li><li>스프·건더기 역할</li><li>TEST R-01</li><li>TEST R-02</li></ol></section><section><h2>2차시</h2><ol><li>TEST R-03</li><li>TEST R-04</li><li>레시피 비교·선정</li><li>최종 스프·라벨</li><li>실제 제품 포장</li></ol></section></div><h2>안전 확인</h2>{settings.safetyChecks.map((item) => <p className="print-check" key={item}>□ {item}</p>)}</div>;
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
