"use client";
import { useCallback, useEffect, useState } from "react";
import { loadStudents } from "@/lib/client-api";
import type { AppSettings, StudentProject } from "@/lib/types";
import { AllergenNotice } from "../recipe/Allergens";
import { formatGrams } from "@/lib/notebook";
export function ClassGallery({ settings, code }: { settings: AppSettings; code: string }) {
  const [projects, setProjects] = useState<StudentProject[]>([]);
  const [notice, setNotice] = useState("");
  const classId = settings.classes?.[0]?.id ?? "";
  const refresh = useCallback(async () => { try { const data = await loadStudents(classId, code); setProjects(data.projects); setNotice(""); } catch { setNotice("친구 기록을 불러오지 못했어요. 다시 눌러 주세요."); } }, [classId, code]);
  useEffect(() => {
    let cancelled = false;
    const run = async () => { try { const data = await loadStudents(classId, code); if (!cancelled) { setProjects(data.projects); setNotice(""); } } catch { if (!cancelled) setNotice("친구 기록을 불러오지 못했어요. 다시 눌러 주세요."); } };
    void run(); const timer = setInterval(run, 8000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [classId, code]);
  return <section><div className="page-heading"><div><span className="eyebrow">OUR RECIPES</span><h1>친구 레시피</h1></div><button className="secondary-cta" onClick={refresh}>새로고침</button></div><p>{settings.className}에서 공유한 최종 레시피만 보여요.</p><p role="status">{notice}</p><div className="class-recipes">{projects.map((p) => { const f = p.notebook!.final!; return <article key={p.id}><span>{p.researcherNumber}번 연구원</span><h2>{f.productName || "나만의 라면"}</h2><p>{f.tasteLine || f.record.note}</p><AllergenNotice record={f.record} settings={settings} noodles /><dl>{f.record.items.map((x) => <div key={x.id}><dt>{x.name}</dt><dd>{formatGrams(x.amount)}</dd></div>)}</dl><p>물 {f.record.waterMl}ml · 면 {f.record.noodleFraction}개 · {f.record.cookMinutes}분</p><blockquote>{f.record.note}</blockquote></article>; })}</div>{!projects.length && !notice && <p className="empty-record">아직 공유한 레시피가 없어요. 스티커 화면에서 공유할 수 있어요.</p>}</section>;
}
