"use client";
import { useCallback, useEffect, useRef } from "react";
export function Fullscreen({ title, close, previous, next, children }: { title: string; close: () => void; previous?: () => void; next?: () => void; children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<{x:number;y:number} | null>(null);
  const closeRef = useRef(close); const prevRef = useRef(previous); const nextRef = useRef(next);
  useEffect(() => { closeRef.current = close; prevRef.current = previous; nextRef.current = next; });
  const dismiss = useCallback(() => {
    if (document.fullscreenElement === root.current) void document.exitFullscreen().catch(() => {});
    closeRef.current();
  }, []);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const element = root.current;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.focus();
    let entered = false;
    const fullscreenChange = () => { if (document.fullscreenElement === element) entered = true; else if (entered) closeRef.current(); };
    document.addEventListener("fullscreenchange", fullscreenChange);
    // CSS overlay remains fully usable where native fullscreen isn't supported.
    if (element?.requestFullscreen) void element.requestFullscreen().catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); dismiss(); return; }
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); prevRef.current?.(); }
      if (e.key === "ArrowRight") { e.preventDefault(); nextRef.current?.(); }
      if (e.key === "Tab" && element) {
        const list = Array.from(element.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, summary, [tabindex="0"]')).filter((x) => x.offsetParent !== null);
        if (!list.length) { e.preventDefault(); element.focus(); }
        else if (e.shiftKey && (document.activeElement === list[0] || document.activeElement === element)) { e.preventDefault(); list[list.length-1].focus(); }
        else if (!e.shiftKey && document.activeElement === list[list.length-1]) { e.preventDefault(); list[0].focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("fullscreenchange", fullscreenChange); document.body.style.overflow = oldOverflow; old?.focus(); if (document.fullscreenElement === element) void document.exitFullscreen().catch(() => {}); };
  }, [dismiss]);
  return <div className="lesson-fullscreen" ref={root} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onTouchStart={(e) => { if ((e.target as HTMLElement).closest("button,input,textarea,select,details")) return; touch.current = { x:e.touches[0].clientX, y:e.touches[0].clientY }; }} onTouchEnd={(e) => { if (!touch.current) return; const dx = e.changedTouches[0].clientX-touch.current.x; const dy=e.changedTouches[0].clientY-touch.current.y; touch.current=null; if (Math.abs(dx)>80 && Math.abs(dx)>Math.abs(dy)*1.5) { if(dx<0) next?.(); else previous?.(); } }}><div className="fullscreen-top"><strong>{title}</strong><button onClick={dismiss}>닫기 (ESC)</button></div>{children}</div>;
}
