import { ALLERGENS, recipeAllergens } from "@/lib/notebook";
import type { AllergenInfo, AppSettings, RecipeRecord } from "@/lib/types";
export function AllergenEditor({ value, onChange }: { value: AllergenInfo; onChange: (change: AllergenInfo) => void }) {
  const checked = value.allergens ?? [];
  return <fieldset className="allergen-editor"><legend>포장지의 알레르기 표시</legend><p>실제 포장을 보고 체크해 주세요. 미리 채우지 않습니다.</p>
    <div className="allergen-options">{ALLERGENS.map((item) => <label key={item}><input type="checkbox" checked={checked.includes(item)} onChange={(e) => onChange({ allergens: e.target.checked ? [...checked, item] : checked.filter((x) => x !== item) })} />{item}</label>)}</div>
    <label className="admin-field"><span>기타 (예: 멸치)</span><input value={value.allergenOther ?? ""} onChange={(e) => onChange({ allergenOther: e.target.value })} maxLength={150} /></label>
    <label className="admin-field"><span>같은 시설에서 제조 · 포장 문구 메모</span><input value={value.facilityNote ?? ""} onChange={(e) => onChange({ facilityNote: e.target.value })} maxLength={300} /></label>
    <label className="allergen-checked"><input type="checkbox" checked={value.allergenChecked === true} onChange={(e) => onChange({ allergenChecked: e.target.checked })} />실제 포장 확인 완료</label>
    <strong>{value.allergenChecked ? "확인 완료" : "확인 전"}</strong>
  </fieldset>;
}
export function AllergenNotice({ record, settings, noodles = false }: { record: RecipeRecord; settings: AppSettings; noodles?: boolean }) {
  const { values, unchecked, notes } = recipeAllergens(record, settings, noodles);
  return <aside className="recipe-allergens" aria-label="알레르기 정보"><strong>맛보기 전에 확인해요</strong>
    {values.length > 0 && <p>이 라면에는 {values.join(", ")}이(가) 들어 있어요.</p>}
    {unchecked ? <p className="unverified">아직 확인하지 않은 재료가 있어요. 선생님께 먼저 물어보세요.</p> : <p>{values.length ? "" : "포장에서 확인한 알레르기 항목이 없습니다. "}친구 컵을 맛보기 전에 선생님께 확인하세요.</p>}
    {notes.map((note) => <p key={note} className="facility-note">제조시설 안내: {note}</p>)}
  </aside>;
}
