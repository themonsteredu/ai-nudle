"use client";
import { useEffect, useRef, useState } from "react";
import { CareerSlideVisual } from "./CareerSlideVisual";
import { FactoryMotionScene } from "@/components/process/FactoryMotionScene";
import { RAMEN_PROCESS_STEPS } from "@/lib/ramen-process";
import { CAREER_SLIDES, CAREER_SOURCES, CAREER_DURATION_SECONDS, formatCareerTime, type CareerSlide } from "@/lib/career-slides";
import { Fullscreen } from "../recipe/Fullscreen";

const TOTAL = CAREER_SLIDES.length + RAMEN_PROCESS_STEPS.length;
const FRYING_INDEX = RAMEN_PROCESS_STEPS.findIndex(step => step.tone === "dry");
const revealCount = (index: number) => (CAREER_SLIDES[index]?.points.length ?? 0) + 1;

function SpeakingNotes({ slide }: { slide: CareerSlide }) {
  return <details className="career-speaking-notes">
    <summary>이 장 설명 메모 · 권장 {slide.seconds}초</summary>
    <small>화면에 함께 보이는 교사용 메모입니다.</small>
    {slide.notes.map(note => <p key={note}>{note}</p>)}
  </details>;
}

export function CareerProcessPanel() {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const [full, setFull] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const presenterRef = useRef<HTMLDivElement>(null);
  const career = CAREER_SLIDES[index];
  const step = RAMEN_PROCESS_STEPS[index - CAREER_SLIDES.length];
  const complete = career ? revealed >= revealCount(index) : true;
  const jump = (nextIndex: number, showAll = false) => {
    const bounded = Math.min(TOTAL - 1, Math.max(0, nextIndex));
    setIndex(bounded);
    setRevealed(showAll ? revealCount(bounded) : 0);
    setPlaying(bounded >= CAREER_SLIDES.length);
    setAutoAdvance(false);
  };
  const openProcess = (processIndex: number) => {
    setIndex(CAREER_SLIDES.length + processIndex);
    setRevealed(0);
    setAutoAdvance(false);
    setPlaying(true);
    setFull(true);
  };
  const advance = () => {
    if (career && !complete) setRevealed(value => Math.min(revealCount(index), value + 1));
    else jump(index + 1);
  };
  const back = () => {
    if (career && revealed > 0) setRevealed(value => value - 1);
    else if (index > 0) jump(index - 1, true);
  };
  useEffect(() => {
    presenterRef.current?.closest(".lesson-fullscreen")?.scrollTo({ top: 0 });
  }, [index, full]);
  const processEnded = () => {
    if (!autoAdvance) return;
    if (index < TOTAL - 1) setIndex(value => value + 1);
    else { setPlaying(false); setAutoAdvance(false); }
  };

  const slide = <>
    <div className="presenter-topline"><div><span>{career ? "FOOD RESEARCHER" : "NOODLE FACTORY"}</span><strong>{career ? "식품개발연구원 · 10분 진로 이야기" : "면 생산라인 시연"}</strong></div><div><b>{String(career ? index + 1 : index - CAREER_SLIDES.length + 1).padStart(2, "0")}</b><span>/ {career ? CAREER_SLIDES.length : RAMEN_PROCESS_STEPS.length}</span></div></div>
    {career ? <article className={"career-slide" + (career.video ? " career-slide-video" : "")} key={career.id}>
      <header className="career-slide-heading">
        <div className="career-slide-meta"><span className="eyebrow">{career.kicker}</span><span>권장 {career.seconds}초</span></div>
        <h2 className="career-title-enter">{career.title}</h2>
      </header>
      <div className="career-slide-copy">
        <p className="career-headline">{career.headline}</p>
        <ul className="career-reveal-list">
          {career.points.map((point, i) => <li key={point} className={revealed > i ? "career-reveal shown" : "career-reveal"} aria-hidden={revealed <= i}><span className="career-point-number" aria-hidden="true">{i + 1}</span><div><strong>{point}</strong><p className="career-point-detail">{career.details[i]}</p></div></li>)}
        </ul>
        <blockquote className={complete ? "career-reveal shown" : "career-reveal"} aria-hidden={!complete}><span>함께 생각해요</span>{career.question}</blockquote>
        <div className="slide-source">{career.sources.length ? <>출처: {career.sources.map(n => <a href={CAREER_SOURCES[n].url} key={n} target="_blank" rel="noreferrer">{CAREER_SOURCES[n].title}</a>)}</> : "이 수업의 활동·안전 안내"}</div>
      </div>
      <CareerSlideVisual slide={career} />
    </article> : <div className="presenter-stage"><FactoryMotionScene key={step.tone} tone={step.tone} playing={playing} loop={!autoAdvance} respectReducedMotion={false} onEnded={processEnded} /><article className="presenter-script" aria-live="polite"><span>공정 {index - CAREER_SLIDES.length + 1}</span><h2>{step.title}</h2><p>{step.short}</p><div><span>연구원이 확인하는 것</span><strong>{step.researcherCheck}</strong></div><blockquote>{step.teacherPrompt}</blockquote></article></div>}
    {!career && <nav className="presenter-timeline" aria-label="라면 공정 영상 목록">{RAMEN_PROCESS_STEPS.map((item, i) => <button key={item.tone} className={item.tone === step.tone ? "active" : ""} aria-current={item.tone === step.tone ? "step" : undefined} onClick={() => { jump(CAREER_SLIDES.length + i); setPlaying(true); }}><span>공정 {i + 1}</span><b>{item.title}</b></button>)}</nav>}
    <div className="presenter-controls career-controls">
      <button onClick={() => jump(index - 1, true)} disabled={index === 0}>이전 장</button>
      {career ? <>
        <button onClick={() => setRevealed(complete ? 0 : revealCount(index))}>{complete ? "내용 다시 펼치기" : "내용 모두 보기"}</button>
        <span className="career-reveal-status" aria-live="polite">{revealed} / {revealCount(index)} 내용</span>
        <button className="presenter-play" onClick={advance}>{complete ? index === CAREER_SLIDES.length - 1 ? "면 생산공정으로" : "다음 장" : "다음 내용"}</button>
        {!complete && <button onClick={() => jump(index + 1)}>다음 장</button>}
      </> : <>
        <button className="presenter-play" onClick={() => { setAutoAdvance(false); setPlaying(!playing); }}>{playing ? "영상 일시정지" : "이 영상 재생"}</button>
        <button aria-pressed={autoAdvance} onClick={() => { setAutoAdvance(!autoAdvance); setPlaying(true); }}>{autoAdvance ? "자동 넘김 끄기" : "전체 공정 자동 넘김"}</button>
        <button onClick={() => jump(index + 1)} disabled={index === TOTAL - 1}>다음 장</button>
      </>}
    </div>
    {!career && <p className="process-playback-hint">{autoAdvance ? "영상이 끝나면 다음 공정으로 넘어갑니다." : "재생하면 이 영상을 반복해서 보여 줍니다. 다른 공정은 위에서 골라 주세요."}</p>}
    {career && <SpeakingNotes slide={career} key={career.id + "-notes"} />}
  </>;

  return <section className="teacher-panel career-process-panel">
    <header className="teacher-panel-head"><div><span>CAREER PRESENTER</span><h1>직업 소개·수업 발표</h1><p>직업 이야기 {CAREER_SLIDES.length}장, 약 {formatCareerTime(CAREER_DURATION_SECONDS)}. 설명·짧은 질문·영상 1분을 포함한 구성입니다. 면 생산공정 시연은 뒤에 이어집니다.</p></div><button className="teacher-primary" onClick={() => { jump(0); setFull(true); }}>직업 소개부터 전체화면</button></header>
    <div className="process-video-shortcuts"><div><strong>라면 공정 영상</strong><p>직업 소개를 넘기지 않고 바로 볼 수 있어요.</p></div><div><button onClick={() => openProcess(0)}>공정 영상 바로 보기</button><button onClick={() => openProcess(FRYING_INDEX)}>유탕 영상 바로 보기</button></div></div>
    <div className="career-slide-jumps"><label>발표 장면<select aria-label="발표 장면" value={index} onChange={e => jump(Number(e.target.value))}>{CAREER_SLIDES.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title} · {s.seconds}초</option>)}{RAMEN_PROCESS_STEPS.map((s, i) => <option key={s.title} value={CAREER_SLIDES.length + i}>공정 {i + 1}. {s.title}</option>)}</select></label><button onClick={() => { setAutoAdvance(false); setPlaying(Boolean(step)); setFull(true); }}>현재 장면 전체화면</button></div>
    <p className="career-control-hint">전체화면에서 오른쪽 방향키·왼쪽으로 쓸기: 내용 펼치기 / 다음 장 · 왼쪽 방향키: 되돌리기 · ESC: 닫기</p>
    {!full && <div className="career-presenter">{slide}</div>}
    {full && <Fullscreen title={career ? "식품개발연구원 발표" : "라면 공정 영상"} close={() => { setFull(false); setPlaying(false); setAutoAdvance(false); }} previous={back} next={advance}><div ref={presenterRef} className="career-presenter fullscreen-career">{slide}</div></Fullscreen>}
    <details className="slide-teacher-notes"><summary>10분 발표안·출처·이미지 생성 프롬프트</summary>
      <p>자료 확인: 2026-10-03. 권장 시간은 설명과 학생의 짧은 응답을 포함합니다. 개발 순서와 협업 예시는 수업용으로 정리했으며, 회사와 제품에 따라 실제 업무는 다릅니다. 사진 다섯 장은 각기 다른 주제의 수업용 생성 이미지입니다. 실제 개발 사례와 가상 실험 예시는 구분해 표시했고, 영상은 한국식품연구원의 공식 자료입니다.</p>
      <ol className="career-agenda">{CAREER_SLIDES.map((s, i) => <li key={s.id}><button onClick={() => jump(i)}>{s.title}</button><span>{s.seconds}초</span></li>)}</ol>
      {CAREER_SLIDES.map((s, i) => <details key={s.id}><summary>{i + 1}. {s.title} · 설명과 이미지 프롬프트</summary>{s.notes.map(note => <p key={note}>{note}</p>)}<p><b>질문</b> {s.question}</p><p><b>이미지 생성 프롬프트</b> {s.prompt}</p></details>)}
      {CAREER_SOURCES.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></p>)}
    </details>
    <div className="student-handoff"><div><span>설명을 마쳤나요?</span><h2>학생은 레시피와 맛을 기록해요.</h2><p>제조공정 체험은 필수 단계가 아닙니다. 학생 화면에는 재료의 양과 맛 느낌을 남기면 됩니다.</p></div></div>
  </section>;
}
