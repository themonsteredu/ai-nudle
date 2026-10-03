"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { FactoryMotionScene } from "@/components/process/FactoryMotionScene";
import { RAMEN_PROCESS_STEPS } from "@/lib/ramen-process";
import { CAREER_SLIDES, CAREER_SOURCES, CAREER_VIDEO, CAREER_DURATION_SECONDS, formatCareerTime, type CareerSlide } from "@/lib/career-slides";
import { Fullscreen } from "../recipe/Fullscreen";

const TOTAL = CAREER_SLIDES.length + RAMEN_PROCESS_STEPS.length;
const revealCount = (index: number) => (CAREER_SLIDES[index]?.points.length ?? 0) + 1;

function CareerVisual({ slide }: { slide: CareerSlide }) {
  const [videoOpen, setVideoOpen] = useState(false);
  return <aside className="career-visual">
    {slide.video ? <>
      <div className="career-video-frame">
        {videoOpen ? <iframe
          src={CAREER_VIDEO.embedUrl}
          title={CAREER_VIDEO.title}
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        /> : <div className="career-video-poster">
          <Image src={slide.image} alt="" fill sizes="(max-width: 800px) 100vw, 45vw" />
          <div><span>한국식품연구원</span><strong>실제 연구 현장 만나기</strong><button onClick={() => setVideoOpen(true)}>영상 불러오기</button><small>불러온 뒤 재생을 눌러 주세요 · 약 1분 시청</small></div>
        </div>}
      </div>
      <div className="career-video-links">
        {videoOpen && <button onClick={() => setVideoOpen(false)}>영상 닫기</button>}
        <a href={CAREER_VIDEO.watchUrl} target="_blank" rel="noreferrer">YouTube에서 보기</a>
        <a href={CAREER_VIDEO.sourceUrl} target="_blank" rel="noreferrer">공식 게시 페이지</a>
      </div>
      <details className="career-video-fallback"><summary>재생이 안 되나요? 영상 대신 설명</summary><p>한국식품연구원은 식품의 기능과 품질·안전 등을 연구합니다. 공식 소개에는 무균포장 즉석밥과 한국형 우주식품 같은 연구 성과가 나옵니다.</p><p>“음식을 오래 보관하거나 특별한 환경에서 먹으려면 무엇을 연구해야 할까요?”라고 함께 이야기해 보세요.</p></details>
    </> : <figure className="career-photo"><Image src={slide.image} alt={slide.imageAlt} width={1536} height={1024} sizes="(max-width: 800px) 100vw, 45vw" /><figcaption>수업용 생성 이미지 · 실제 기관 촬영 사진이 아닙니다</figcaption></figure>}
    <div className="career-visual-caption"><span>{slide.visualLabel}</span><div>{slide.visualWords.map((word, i) => <strong key={word}><small>{String(i + 1).padStart(2, "0")}</small>{word}</strong>)}</div></div>
  </aside>;
}

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
  const career = CAREER_SLIDES[index];
  const step = RAMEN_PROCESS_STEPS[index - CAREER_SLIDES.length];
  const complete = career ? revealed >= revealCount(index) : true;
  const jump = (nextIndex: number, showAll = false) => {
    const bounded = Math.min(TOTAL - 1, Math.max(0, nextIndex));
    setIndex(bounded);
    setRevealed(showAll ? revealCount(bounded) : 0);
    setPlaying(false);
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
    if (!playing || career) return;
    const timer = setTimeout(() => {
      if (index < TOTAL - 1) setIndex(index + 1);
      else setPlaying(false);
    }, 5200);
    return () => clearTimeout(timer);
  }, [playing, index, career]);

  const slide = <>
    <div className="presenter-topline"><div><span>{career ? "FOOD RESEARCHER" : "NOODLE FACTORY"}</span><strong>{career ? "식품개발연구원 · 10분 진로 이야기" : "면 생산라인 시연"}</strong></div><div><b>{String(career ? index + 1 : index - CAREER_SLIDES.length + 1).padStart(2, "0")}</b><span>/ {career ? CAREER_SLIDES.length : RAMEN_PROCESS_STEPS.length}</span></div></div>
    {career ? <article className={"career-slide" + (career.video ? " career-slide-video" : "")} key={career.id}>
      <div className="career-slide-copy">
        <div className="career-slide-meta"><span className="eyebrow">{career.kicker}</span><span>권장 {career.seconds}초</span></div>
        <h2 className="career-title-enter">{career.title}</h2>
        <p className="career-headline">{career.headline}</p>
        <ul className="career-reveal-list">
          {career.points.map((point, i) => <li key={point} className={revealed > i ? "career-reveal shown" : "career-reveal"} aria-hidden={revealed <= i}><span className="career-point-number" aria-hidden="true">{i + 1}</span><span>{point}</span></li>)}
        </ul>
        <blockquote className={complete ? "career-reveal shown" : "career-reveal"} aria-hidden={!complete}><span>함께 생각해요</span>{career.question}</blockquote>
        <div className="slide-source">{career.sources.length ? <>출처: {career.sources.map(n => <a href={CAREER_SOURCES[n].url} key={n} target="_blank" rel="noreferrer">{CAREER_SOURCES[n].title}</a>)}</> : "이 수업의 활동·안전 안내"}</div>
      </div>
      <CareerVisual slide={career} />
    </article> : <div className="presenter-stage"><FactoryMotionScene tone={step.tone} playing={playing} /><article className="presenter-script" aria-live="polite"><span>공정 {index - CAREER_SLIDES.length + 1}</span><h2>{step.title}</h2><p>{step.short}</p><div><span>연구원이 확인하는 것</span><strong>{step.researcherCheck}</strong></div><blockquote>{step.teacherPrompt}</blockquote></article></div>}
    <div className="presenter-controls career-controls">
      <button onClick={() => jump(index - 1, true)} disabled={index === 0}>이전 장</button>
      {career ? <>
        <button onClick={() => setRevealed(complete ? 0 : revealCount(index))}>{complete ? "내용 다시 펼치기" : "내용 모두 보기"}</button>
        <span className="career-reveal-status" aria-live="polite">{revealed} / {revealCount(index)} 내용</span>
        <button className="presenter-play" onClick={advance}>{complete ? index === CAREER_SLIDES.length - 1 ? "면 생산공정으로" : "다음 장" : "다음 내용"}</button>
        {!complete && <button onClick={() => jump(index + 1)}>다음 장</button>}
      </> : <>
        <button className="presenter-play" onClick={() => setPlaying(!playing)}>{playing ? "시연 일시정지" : "자동 시연 시작"}</button>
        <button onClick={() => jump(index + 1)} disabled={index === TOTAL - 1}>다음 장</button>
      </>}
    </div>
    {career && <SpeakingNotes slide={career} key={career.id + "-notes"} />}
  </>;

  return <section className="teacher-panel career-process-panel">
    <header className="teacher-panel-head"><div><span>CAREER PRESENTER</span><h1>직업 소개·수업 발표</h1><p>직업 이야기 {CAREER_SLIDES.length}장, 약 {formatCareerTime(CAREER_DURATION_SECONDS)}. 설명·짧은 질문·영상 1분을 포함한 구성입니다. 면 생산공정 시연은 뒤에 이어집니다.</p></div><button className="teacher-primary" onClick={() => { jump(0); setFull(true); }}>직업 소개부터 전체화면</button></header>
    <div className="career-slide-jumps"><label>발표 장면<select aria-label="발표 장면" value={index} onChange={e => jump(Number(e.target.value))}>{CAREER_SLIDES.map((s, i) => <option key={s.id} value={i}>{i + 1}. {s.title} · {s.seconds}초</option>)}{RAMEN_PROCESS_STEPS.map((s, i) => <option key={s.title} value={CAREER_SLIDES.length + i}>공정 {i + 1}. {s.title}</option>)}</select></label><button onClick={() => { setPlaying(false); setFull(true); }}>현재 장면 전체화면</button></div>
    <p className="career-control-hint">전체화면에서 오른쪽 방향키·왼쪽으로 쓸기: 내용 펼치기 / 다음 장 · 왼쪽 방향키: 되돌리기 · ESC: 닫기</p>
    {!full && <div className="career-presenter">{slide}</div>}
    {full && <Fullscreen title="식품개발연구원 발표" close={() => { setFull(false); setPlaying(false); }} previous={back} next={advance}><div className="career-presenter fullscreen-career">{slide}</div></Fullscreen>}
    <details className="slide-teacher-notes"><summary>10분 발표안·출처·이미지 생성 프롬프트</summary>
      <p>자료 확인: 2026-10-02. 권장 시간은 설명과 학생의 짧은 응답을 포함합니다. 개발 순서와 협업 예시는 수업용으로 정리했으며, 회사와 제품에 따라 실제 업무는 다릅니다. 이미지는 수업용으로 생성한 연구실·협업 장면이고, 영상은 한국식품연구원의 공식 자료입니다.</p>
      <ol className="career-agenda">{CAREER_SLIDES.map((s, i) => <li key={s.id}><button onClick={() => jump(i)}>{s.title}</button><span>{s.seconds}초</span></li>)}</ol>
      {CAREER_SLIDES.map((s, i) => <details key={s.id}><summary>{i + 1}. {s.title} · 설명과 이미지 프롬프트</summary>{s.notes.map(note => <p key={note}>{note}</p>)}<p><b>질문</b> {s.question}</p><p><b>이미지 생성 프롬프트</b> {s.prompt}</p></details>)}
      {CAREER_SOURCES.map(s => <p key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.title}</a></p>)}
    </details>
    <div className="student-handoff"><div><span>설명을 마쳤나요?</span><h2>학생은 레시피와 맛을 기록해요.</h2><p>제조공정 체험은 필수 단계가 아닙니다. 학생 화면에는 재료의 양과 맛 느낌을 남기면 됩니다.</p></div></div>
  </section>;
}
