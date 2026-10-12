"use client";
import { useState } from "react";
import { createId } from "@/lib/ids";
import type { AppSettings, ComparisonSoup } from "@/lib/types";
import { AllergenEditor } from "../recipe/Allergens";
// Students and the storage server name soups by position (스프 A, B, C…), so the list tops out at Z.
const MAX_SOUPS = 26;
const letter = (index: number) => String.fromCharCode(65 + index);
export function ComparisonSoupPanel({ settings, setSettings }: { settings: AppSettings; setSettings: (s: AppSettings) => void }) {
  const soups = settings.comparisonSoups ?? [];
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState("");
  const save = (next: ComparisonSoup[]) => setSettings({ ...settings, comparisonSoups: next });
  const update = (id: string, change: Partial<ComparisonSoup>) => save(soups.map((x) => x.id === id ? { ...x, ...change } : x));
  function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || soups.length >= MAX_SOUPS) return;
    const id = createId("soup");
    save([...soups, { id, name: name.trim(), enabled: true, allergens: [], allergenChecked: false, allergenOther: "", facilityNote: "" }]);
    setName(""); setAdded(id);
  }
  function remove(soup: ComparisonSoup, index: number) {
    const shift = index < soups.length - 1 ? `\n뒤에 있는 스프의 알파벳이 한 칸씩 당겨져요. (예: 스프 ${letter(index + 1)} → 스프 ${letter(index)})` : "";
    if (!window.confirm(`스프 ${letter(index)}${soup.name ? ` '${soup.name}'` : ""}을(를) 삭제할까요?${shift}\n이미 저장한 학생 레시피는 그대로 남아요. 잠깐만 안 쓰려면 삭제 대신 '사용'을 꺼 주세요.`)) return;
    save(soups.filter((x) => x.id !== soup.id));
    if (open === soup.id) setOpen(null);
  }
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>COMMERCIAL SOUPS</span><h1>시판 스프 관리</h1><p>학생 &apos;시판 스프&apos; 탭에 나오는 스프예요. 학생에게는 스프 A, B, C…로만 보이고 실제 상품명은 교사 화면에만 보여요. 바꾼 뒤 위의 &apos;설정 저장&apos;을 눌러 주세요.</p></div></header>
    <form className="ing-add" onSubmit={add}>
      <strong>새 시판 스프 추가</strong>
      <label><span>실제 상품명</span><input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="예: 진라면 매운맛 스프" /></label>
      <button className="teacher-primary" disabled={!name.trim() || soups.length >= MAX_SOUPS}>＋ 스프 {letter(soups.length)}로 추가</button>
    </form>
    {soups.length >= MAX_SOUPS && <p className="ing-added">스프는 Z까지 {MAX_SOUPS}개까지 넣을 수 있어요.</p>}
    {added && soups.some((x) => x.id === added) && <p className="ing-added" role="status">추가했어요. 위의 &apos;설정 저장&apos;을 눌러 주세요. 알레르기는 &apos;알레르기 확인&apos;에서 포장을 보고 체크해 주세요.</p>}
    <section className="ing-section"><header><h2>시판 스프 <small>{soups.length}개 · 사용 {soups.filter((x) => x.enabled).length}개</small></h2><p>알파벳은 목록 순서대로 붙어요.</p></header>
      {soups.map((soup, i) => { const expanded = open === soup.id; return <article key={soup.id} className={`ing-row soup-row${soup.enabled ? "" : " off"}${added === soup.id ? " new" : ""}`}>
        <div className="ing-main">
          <span className="soup-letter" aria-hidden="true">{letter(i)}</span>
          <label className="ing-name"><span>스프 {letter(i)} · 실제 상품명 (교사만 보여요)</span><input value={soup.name} maxLength={100} onChange={(e) => update(soup.id, { name: e.target.value })} placeholder="상품명을 적어 주세요" /></label>
          <div className="ing-actions">
            <label className="switch-label"><input type="checkbox" checked={soup.enabled} onChange={(e) => update(soup.id, { enabled: e.target.checked })} /><span />사용</label>
            <button className="ing-more" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : soup.id)}>{expanded ? "접기" : "알레르기 확인"}</button>
            <button className="danger-text ing-delete" onClick={() => remove(soup, i)}>삭제</button>
          </div>
        </div>
        <p className="ing-status">{soup.allergenChecked ? "알레르기 포장 확인 완료" : "알레르기 포장 확인 전"}{soup.enabled ? "" : " · 학생 화면에서 숨김"}</p>
        {expanded && <div className="ing-detail"><AllergenEditor value={soup} onChange={(change) => update(soup.id, change)} /></div>}
      </article>; })}
      {!soups.length && <p className="empty-record">아직 시판 스프가 없어요. 위에서 추가해 주세요.</p>}
    </section>
  </section>;
}
