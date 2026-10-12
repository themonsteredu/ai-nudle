"use client";
import { useState } from "react";
import { createId } from "@/lib/ids";
import type { AppSettings, ComparisonSoup } from "@/lib/types";
import { AllergenEditor } from "../recipe/Allergens";
// Students and the storage server name soups by position (스프 A, B, C…), so the list tops out at Z.
// A soup therefore never leaves the middle of the list: that would shift every later letter away from saved records.
const MAX_SOUPS = 26;
const letter = (index: number) => String.fromCharCode(65 + index);
export function ComparisonSoupPanel({ settings, setSettings }: { settings: AppSettings; setSettings: (s: AppSettings) => void }) {
  const soups = settings.comparisonSoups ?? [];
  const [name, setName] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [added, setAdded] = useState("");
  const [recheck, setRecheck] = useState<string[]>([]);
  const save = (next: ComparisonSoup[]) => setSettings({ ...settings, comparisonSoups: next });
  const update = (id: string, change: Partial<ComparisonSoup>) => save(soups.map((x) => x.id === id ? { ...x, ...change } : x));
  // An unused slot with no product (the default 스프 C) was never shown to students, so a new soup fills it first.
  const emptySlot = soups.findIndex((x) => !x.enabled && !x.name.trim());
  const target = emptySlot >= 0 ? emptySlot : soups.length;
  const full = target >= MAX_SOUPS;
  function add(event: React.FormEvent) {
    event.preventDefault();
    const product = name.trim();
    if (!product || full) return;
    const soup: ComparisonSoup = { id: createId("soup"), name: product, enabled: true, allergens: [], allergenChecked: false, allergenOther: "", facilityNote: "" };
    save(emptySlot >= 0 ? soups.map((x, i) => i === emptySlot ? soup : x) : [...soups, soup]);
    setName(""); setAdded(soup.id);
  }
  function rename(soup: ComparisonSoup, value: string) {
    // A different product needs its package checked again.
    if (soup.allergenChecked && value !== soup.name) {
      update(soup.id, { name: value, allergenChecked: false });
      setRecheck((ids) => ids.includes(soup.id) ? ids : [...ids, soup.id]);
    } else update(soup.id, { name: value });
  }
  function remove(soup: ComparisonSoup, index: number) {
    const tag = `스프 ${letter(index)}${soup.name.trim() ? ` '${soup.name.trim()}'` : ""}`;
    if (index < soups.length - 1) {
      const why = `중간에 있는 스프를 지우면 뒤 스프의 알파벳이 한 칸씩 바뀌어서, 학생들이 이미 저장한 기록의 '스프 ${letter(index + 1)}'와 실제 스프가 어긋나요.`;
      if (!soup.enabled) { window.alert(`${tag}은(는) 이미 꺼져 있어서 학생 화면에 보이지 않아요.\n${why}\n그래서 이 자리는 목록에 남겨 둬요.`); return; }
      if (window.confirm(`${tag}은(는) 삭제하는 대신 '사용'을 끌게요.\n${why}\n끄면 모든 반의 학생 화면에서 사라지고, 알파벳 ${letter(index)}는 이 스프 자리로 남아요.`)) update(soup.id, { enabled: false });
      return;
    }
    if (!window.confirm(`${tag}을(를) 삭제할까요? 모든 반에 함께 적용돼요.\n이미 이 스프로 기록한 학생이 있다면, 다음에 추가하는 스프가 같은 '스프 ${letter(index)}' 이름을 쓰게 돼요. 그럴 때는 삭제 대신 '사용'을 꺼 주세요.`)) return;
    save(soups.slice(0, -1));
    if (open === soup.id) setOpen(null);
  }
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>COMMERCIAL SOUPS</span><h1>시판 스프 관리</h1><p>학생 &apos;시판 스프&apos; 탭에 나오는 스프예요. 모든 반에 함께 적용돼요. 학생에게는 스프 A, B, C…로만 보이고 실제 상품명은 교사 화면에만 보여요. 바꾼 뒤 위의 &apos;설정 저장&apos;을 눌러 주세요.</p></div></header>
    <form className="ing-add" onSubmit={add}>
      <strong>새 시판 스프 추가</strong>
      <label><span>실제 상품명</span><input value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="예: 진라면 매운맛 스프" /></label>
      <button className="teacher-primary" disabled={!name.trim() || full}>{full ? `${MAX_SOUPS}개까지 넣을 수 있어요` : `＋ 스프 ${letter(target)}로 추가`}</button>
    </form>
    {full && <p className="ing-added">스프는 Z까지 {MAX_SOUPS}개까지 넣을 수 있어요.</p>}
    {added && soups.some((x) => x.id === added) && <p className="ing-added" role="status">추가했어요. 위의 &apos;설정 저장&apos;을 눌러 주세요. 알레르기는 &apos;알레르기 확인&apos;에서 포장을 보고 체크해 주세요.</p>}
    <section className="ing-section"><header><h2>시판 스프 <small>{soups.length}개 · 사용 {soups.filter((x) => x.enabled).length}개</small></h2><p>알파벳은 목록 순서대로 붙어요. 학생 기록과 어긋나지 않게, 맨 뒤가 아닌 스프는 삭제 대신 &apos;사용&apos;을 꺼요.</p></header>
      {soups.map((soup, i) => { const expanded = open === soup.id; return <article key={soup.id} className={`ing-row soup-row${soup.enabled ? "" : " off"}${added === soup.id ? " new" : ""}`}>
        <div className="ing-main">
          <span className="soup-letter" aria-hidden="true">{letter(i)}</span>
          <label className="ing-name"><span>스프 {letter(i)} · 실제 상품명 (교사만 보여요)</span><input value={soup.name} maxLength={100} onChange={(e) => rename(soup, e.target.value)} placeholder="상품명을 적어 주세요" /></label>
          <div className="ing-actions">
            <label className="switch-label"><input type="checkbox" checked={soup.enabled} onChange={(e) => update(soup.id, { enabled: e.target.checked })} /><span />사용</label>
            <button className="ing-more" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : soup.id)}>{expanded ? "접기" : "알레르기 확인"}</button>
            <button className="danger-text ing-delete" onClick={() => remove(soup, i)}>삭제</button>
          </div>
        </div>
        <p className="ing-status">{soup.allergenChecked ? "알레르기 포장 확인 완료" : recheck.includes(soup.id) ? "상품명이 바뀌어 알레르기 포장 확인을 다시 해 주세요" : "알레르기 포장 확인 전"}{soup.enabled ? "" : " · 학생 화면에서 숨김"}</p>
        {expanded && <div className="ing-detail"><AllergenEditor value={soup} onChange={(change) => update(soup.id, change)} /></div>}
      </article>; })}
      {!soups.length && <p className="empty-record">아직 시판 스프가 없어요. 위에서 추가해 주세요.</p>}
    </section>
  </section>;
}
