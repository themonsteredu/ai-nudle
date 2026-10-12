"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ApiError, ensureTeacherSession, loadSettings, saveSettings } from "@/lib/client-api";
import { copyCostFields } from "@/lib/admin-fields";
import { defaultSettings } from "@/lib/defaults";
import type { AppSettings, SupplyCategory } from "@/lib/types";
import { CostPanel, CostPrintPanel, SupplyPanel } from "./teacher/TeacherPanels";
import { PricePanel } from "./admin/PricePanel";

// Screen lock only: it keeps the cost screens apart from the 교사 화면. The storage server does not know it.
const ADMIN_PIN = "1003";
const UNLOCK_KEY = "ramen-admin-unlocked";

type AdminSection = "cost" | "prices" | "print" | SupplyCategory;
const NAV_GROUPS: { title: string; items: { id: AdminSection; label: string }[] }[] = [
  { title: "원가", items: [
    { id: "cost", label: "원가 자동계산" },
    { id: "prices", label: "재료 단가" },
    { id: "print", label: "원가계산표 인쇄" },
  ] },
  { title: "구입 준비물", items: [
    { id: "noodle", label: "사리면" },
    { id: "tasting", label: "시식컵" },
    { id: "container", label: "최종 용기" },
    { id: "consumable", label: "기타 소모품" },
    { id: "tool", label: "수업도구" },
  ] },
];
const SUPPLY_SECTIONS: SupplyCategory[] = ["noodle", "tasting", "container", "consumable", "tool"];

function readUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
}
const noSubscription = () => () => {};
// Browser errors such as "Failed to fetch" are English; the storage server's own messages are Korean.
const errorText = (error: unknown, fallback: string) => error instanceof ApiError && error.message ? error.message : fallback;

export default function AdminApp() {
  // The unlock lives in this browser tab only; the server render shows the loading state.
  const storedUnlock = useSyncExternalStore(noSubscription, readUnlocked, () => null);
  const [override, setUnlocked] = useState<boolean | null>(null);
  const unlocked = override ?? storedUnlock;
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [section, setSection] = useState<AdminSection>("cost");
  const [settings, setSettingsState] = useState<AppSettings>(defaultSettings);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const editCount = useRef(0);

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    async function open() {
      try {
        await ensureTeacherSession();
        const loaded = await loadSettings();
        if (cancelled) return;
        setSettingsState(loaded.settings);
        setDirty(false);
        setReady(true);
      } catch (error) {
        if (!cancelled) setLoadError(errorText(error, "저장 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요."));
      }
    }
    void open();
    return () => { cancelled = true; };
  }, [unlocked, retry]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  // Remembers the unlock for reloads of this tab. Locking, or leaving the admin screen inside the app
  // (a link or the browser's back button), clears it, so the 교사 화면's admin link asks for the PIN again.
  // A reload runs no cleanup, so it stays unlocked.
  useEffect(() => {
    if (!unlocked) return;
    try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* the lock simply asks again next time */ }
    return () => { try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* nothing to clear */ } };
  }, [unlocked]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setSettings = (next: AppSettings) => {
    editCount.current++;
    setSettingsState(next);
    setDirty(true);
  };

  function unlock(event: React.FormEvent) {
    event.preventDefault();
    if (pin !== ADMIN_PIN) { setPinError("비밀번호가 맞지 않아요."); setPin(""); return; }
    setPinError(""); setPin(""); setUnlocked(true);
  }

  function lock() {
    if (dirty && !window.confirm("저장하지 않은 변경이 있어요. 저장하지 않고 잠글까요?")) return;
    setUnlocked(false); setReady(false); setDirty(false); setSettingsState(defaultSettings);
  }

  /** '← 교사 화면으로' asks before dropping unsaved prices; the lock itself happens when this screen closes. */
  function confirmLeave(event: React.MouseEvent) {
    if (dirty && !window.confirm("저장하지 않은 변경이 있어요. 저장하지 않고 교사 화면으로 갈까요?\n저장하려면 '취소'를 누른 뒤 위의 '설정 저장'을 눌러 주세요.")) event.preventDefault();
  }

  /** Saves only the cost fields on top of the newest server settings, so class and ingredient edits made on the 교사 화면 stay. */
  async function save() {
    setSaving(true);
    const editsBefore = editCount.current;
    try {
      await ensureTeacherSession(); // the server's teacher session ends after 8 hours
      const remote = (await loadSettings()).settings;
      const result = await saveSettings(copyCostFields(remote, settings));
      if (editCount.current === editsBefore) { setSettingsState(result.settings); setDirty(false); }
      setNotice("원가 설정을 저장했어요.");
    } catch (error) {
      setNotice(errorText(error, "저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."));
    } finally {
      setSaving(false);
    }
  }

  if (unlocked === null) return <div className="teacher-loading"><span /> 관리자 화면 확인 중</div>;

  if (!unlocked) {
    return (
      <main className="teacher-gate">
        <Link href="/teacher" className="back-student">← 교사 화면</Link>
        <form onSubmit={unlock}>
          <span className="gate-lock" aria-hidden="true" />
          <small>ADMIN ONLY</small>
          <h1>관리자 화면</h1>
          <p>원가·구입 준비물을 관리합니다.</p>
          <label><span>관리자 비밀번호</span><input type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={pin} onChange={(event) => setPin(event.target.value)} autoFocus /></label>
          {pinError && <div className="login-error" role="alert">{pinError}</div>}
          <button type="submit" disabled={!pin}>입장하기</button>
        </form>
      </main>
    );
  }

  if (!ready) {
    return loadError
      ? <main className="teacher-gate"><Link href="/teacher" className="back-student">← 교사 화면</Link><form onSubmit={(event) => { event.preventDefault(); setLoadError(""); setRetry((n) => n + 1); }}><small>ADMIN</small><h1>관리자 화면</h1><div className="login-error" role="alert">{loadError}</div><button type="submit">다시 연결하기</button></form></main>
      : <div className="teacher-loading"><span /> 원가 설정을 불러오는 중</div>;
  }

  const supply = SUPPLY_SECTIONS.find((x) => x === section);
  return (
    <div className="teacher-shell admin-shell">
      <aside className="teacher-sidebar">
        <div className="teacher-brand"><span>FOOD R&amp;D · ADMIN</span><strong>관리자 화면</strong></div>
        <nav>
          {NAV_GROUPS.map((group) => <div key={group.title}><span>{group.title}</span>{group.items.map((item) => <button key={item.id} className={section === item.id ? "active" : ""} onClick={() => setSection(item.id)}>{item.label}</button>)}</div>)}
        </nav>
        <Link href="/teacher" className="admin-to-teacher" onClick={confirmLeave}>← 교사 화면으로</Link>
        <button className="teacher-logout" onClick={lock}>잠그고 나가기</button>
      </aside>

      <main className="teacher-main">
        <header className="teacher-topbar">
          <div><span>RAMEN R&amp;D LAB · 관리자</span><strong className="admin-topbar-title">원가·구입 관리</strong></div>
          <div className="save-area">{dirty && <i>저장하지 않은 변경</i>}<button onClick={save} disabled={!dirty || saving}>{saving ? "저장 중" : "설정 저장"}</button></div>
        </header>
        {section === "cost" && <CostPanel settings={settings} />}
        {section === "prices" && <PricePanel settings={settings} setSettings={setSettings} />}
        {section === "print" && <CostPrintPanel settings={settings} />}
        {supply && <SupplyPanel settings={settings} setSettings={setSettings} category={supply} />}
      </main>
      {notice && <div className="toast teacher-toast" role="status">{notice}</div>}
    </div>
  );
}
