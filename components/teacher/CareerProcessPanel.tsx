"use client";
import { useEffect, useState } from "react";
import { FactoryMotionScene } from "@/components/process/FactoryMotionScene";
import { RAMEN_PROCESS_STEPS } from "@/lib/ramen-process";
import { CAREER_SLIDES, CAREER_SOURCES } from "@/lib/career-slides";
import { Fullscreen } from "../recipe/Fullscreen";
const TOTAL = CAREER_SLIDES.length + RAMEN_PROCESS_STEPS.length;
export function CareerProcessPanel() {
  const [index,setIndex]=useState(0);
  const [full,setFull]=useState(false);
  const [playing,setPlaying]=useState(false);
  const career=index<CAREER_SLIDES.length ? CAREER_SLIDES[index] : undefined;
  const step=RAMEN_PROCESS_STEPS[index-CAREER_SLIDES.length];
  const move=(amount:number)=>{ setIndex((i)=>Math.min(TOTAL-1,Math.max(0,i+amount)));setPlaying(false); };
  useEffect(()=>{if(!playing)return; const timer=setTimeout(()=>{if(index<TOTAL-1)setIndex(index+1);else setPlaying(false);},5200);return()=>clearTimeout(timer);},[playing,index]);
  const slide=<><div className="presenter-topline"><div><span>{career?"FOOD RESEARCHER":"NOODLE FACTORY"}</span><strong>{career?"식품개발연구원":"기존 면 생산라인 시연"}</strong></div><div><b>{String(index+1).padStart(2,"0")}</b><span>/ {TOTAL}</span></div></div>
    {career ? <article className="career-slide"><div className="career-slide-copy"><span className="eyebrow">{career.kicker}</span><h2>{career.title}</h2><p className="career-headline">{career.headline}</p><ul>{career.points.map((p)=><li key={p}>{p}</li>)}</ul><blockquote>{career.question}</blockquote><div className="slide-source">{career.sources.length?<>출처: {career.sources.map((n)=><a href={CAREER_SOURCES[n].url} key={n} target="_blank" rel="noreferrer">{CAREER_SOURCES[n].title}</a>)}</>:"이 수업의 활동·안전 안내"}</div></div><div className="career-slide-image"><img src={career.image} alt="식품 연구와 제조 시연 자료" /><span>식품개발연구원 · 라면 연구소</span></div></article> : <div className="presenter-stage"><FactoryMotionScene tone={step.tone} playing={playing} /><article className="presenter-script" aria-live="polite"><span>공정 {index-CAREER_SLIDES.length+1}</span><h2>{step.title}</h2><p>{step.short}</p><div><span>연구원이 확인하는 것</span><strong>{step.researcherCheck}</strong></div><blockquote>{step.teacherPrompt}</blockquote></article></div>}
    <div className="presenter-controls"><button onClick={()=>move(-1)} disabled={index===0}>이전</button>{!career && <button className="presenter-play" onClick={()=>setPlaying(!playing)}>{playing?"시연 일시정지":"자동 시연 시작"}</button>}<button onClick={()=>move(1)} disabled={index===TOTAL-1}>다음</button></div></>;
  return <section className="teacher-panel career-process-panel"><header className="teacher-panel-head"><div><span>CAREER PRESENTER</span><h1>직업 소개·수업 발표</h1><p>직업 소개부터 전체화면으로 넘겨 주세요. 이어서 기존 면 생산공정 시연을 볼 수 있습니다.</p></div><button className="teacher-primary" onClick={()=>{setIndex(0);setPlaying(false);setFull(true);}}>직업 소개부터 전체화면</button></header><div className="career-slide-jumps"><label>발표 장면<select aria-label="발표 장면" value={index} onChange={(e)=>{setIndex(Number(e.target.value));setPlaying(false);}}>{CAREER_SLIDES.map((s,i)=><option key={s.title} value={i}>{i+1}. {s.title}</option>)}{RAMEN_PROCESS_STEPS.map((s,i)=><option key={s.title} value={CAREER_SLIDES.length+i}>공정 {i+1}. {s.title}</option>)}</select></label><button onClick={()=>setFull(true)}>현재 장면 전체화면</button></div>
    {!full && <div className="career-presenter">{slide}</div>}{full && <Fullscreen title="식품개발연구원 발표" close={()=>{setFull(false);setPlaying(false);}} previous={()=>move(-1)} next={()=>move(1)}><div className="career-presenter fullscreen-career">{slide}</div></Fullscreen>}
    <details className="slide-teacher-notes"><summary>발표 출처·이미지 생성 프롬프트</summary><p>직업 정보 확인: 2026-10-02. 개발 순서는 수업용으로 간략히 정리했습니다. 현재 화면에는 기존 시연 이미지를 사용합니다. 아래 프롬프트는 새 발표 이미지를 만들 때 사용하세요.</p>{CAREER_SLIDES.map((s,i)=><section key={s.title}><h3>{i+1}. {s.title}</h3><p>{s.prompt}</p></section>)}{CAREER_SOURCES.map((s)=><p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></p>)}</details><div className="student-handoff"><div><span>설명을 마쳤나요?</span><h2>학생은 레시피와 맛을 기록해요.</h2><p>제조공정 체험은 필수 단계가 아닙니다. 학생 화면에는 재료의 양과 맛 느낌을 남기면 됩니다.</p></div></div></section>;
}
