"use client";
import { groupLabel } from "@/lib/groups";
/** Full-screen 모둠 choice shown after joining, for a fresh device and for "모둠 바꾸기". */
export function GroupPicker({ lessonName, count, current, onPick, onCancel, onLeave }: { lessonName: string; count: number; current?: number; onPick: (group: number) => void; onCancel?: () => void; onLeave: () => void }) {
  return <main className="gb-pick-screen"><div className="gb-pick-card"><span className="cover-kicker">FOOD R&amp;D LAB</span><h1>우리 모둠은 몇 모둠인가요?</h1><p>{lessonName} · 우리 모둠 번호를 눌러 주세요.</p>
    <div className="gb-pick-grid" role="group" aria-label="모둠 고르기">{Array.from({ length: count }, (_, i) => i + 1).map((n) => <button key={n} aria-label={groupLabel(n)} aria-pressed={current === n} className={current === n ? "active" : ""} onClick={() => onPick(n)}><b>{n}</b><span>모둠</span></button>)}</div>
    <p className="gb-pick-help">같은 모둠 친구들과 같은 번호를 골라요. 잘못 골랐다면 나중에 &lsquo;모둠 바꾸기&rsquo;로 고칠 수 있어요.</p>
    <div className="gb-pick-actions">{onCancel && <button onClick={onCancel}>취소</button>}<button onClick={onLeave}>수업 나가기</button></div></div></main>;
}
