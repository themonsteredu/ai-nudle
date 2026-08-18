"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { FactoryMotionScene } from "@/components/process/FactoryMotionScene";
import { RAMEN_PROCESS_STEPS } from "@/lib/ramen-process";

const AUTO_PLAY_MS = 5200;

export function CareerProcessPanel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const presenterRef = useRef<HTMLDivElement>(null);
  const step = RAMEN_PROCESS_STEPS[activeIndex];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setActiveIndex((current) => {
        if (current === RAMEN_PROCESS_STEPS.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, AUTO_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [activeIndex, playing]);

  function startPresentation() {
    if (activeIndex === RAMEN_PROCESS_STEPS.length - 1) setActiveIndex(0);
    setPlaying(true);
  }

  async function openFullscreen() {
    if (!presenterRef.current || document.fullscreenElement) return;
    await presenterRef.current.requestFullscreen();
  }

  return (
    <section className="teacher-panel career-process-panel">
      <header className="teacher-panel-head">
        <div>
          <span>CAREER PRESENTER</span>
          <h1>직업소개·면 생산 공정 시연</h1>
          <p>교사가 설명한 뒤 학생들이 직접 공장 조작 체험을 시작합니다.</p>
        </div>
        <button className="teacher-primary" onClick={openFullscreen}>전체화면 시연</button>
      </header>

      <div className="career-role-intro">
        <div>
          <span>오늘의 직업</span>
          <h2>식품개발연구원</h2>
          <p>새로운 제품을 설계하고, 반복 실험으로 맛·품질·안전을 개선하는 사람입니다.</p>
        </div>
        <ol>
          <li><b>01</b><span>제품을 설계해요</span></li>
          <li><b>02</b><span>배합을 실험해요</span></li>
          <li><b>03</b><span>결과를 기록해요</span></li>
          <li><b>04</b><span>품질을 개선해요</span></li>
        </ol>
      </div>

      <div className="career-presenter" ref={presenterRef}>
        <div className="presenter-topline">
          <div><span>NOODLE FACTORY</span><strong>면 생산라인 시연</strong></div>
          <div><b>{String(activeIndex + 1).padStart(2, "0")}</b><span>/ {String(RAMEN_PROCESS_STEPS.length).padStart(2, "0")}</span></div>
        </div>

        <div className="presenter-stage">
          <FactoryMotionScene tone={step.tone} playing={playing} />
          <article className="presenter-script" aria-live="polite">
            <span>공정 {activeIndex + 1}</span>
            <h2>{step.title}</h2>
            <p>{step.short}</p>
            <div><span>연구원이 확인하는 것</span><strong>{step.researcherCheck}</strong></div>
            <blockquote>{step.teacherPrompt}</blockquote>
          </article>
        </div>

        <div className="presenter-timeline" aria-label="면 생산 공정 선택">
          {RAMEN_PROCESS_STEPS.map((item, index) => (
            <button
              key={item.title}
              className={`${index === activeIndex ? "active" : ""} ${index < activeIndex ? "passed" : ""}`}
              onClick={() => { setActiveIndex(index); setPlaying(false); }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{item.title}</b>
            </button>
          ))}
        </div>

        <div className="presenter-controls">
          <button onClick={() => { setActiveIndex(Math.max(0, activeIndex - 1)); setPlaying(false); }} disabled={activeIndex === 0}>이전 공정</button>
          <button className="presenter-play" onClick={() => playing ? setPlaying(false) : startPresentation()}>{playing ? "시연 일시정지" : "자동 시연 시작"}</button>
          <button onClick={() => { setActiveIndex(Math.min(RAMEN_PROCESS_STEPS.length - 1, activeIndex + 1)); setPlaying(false); }} disabled={activeIndex === RAMEN_PROCESS_STEPS.length - 1}>다음 공정</button>
        </div>
      </div>

      <div className="student-handoff">
        <div><span>설명을 마쳤나요?</span><h2>이제 학생들이 생산라인을 직접 조작합니다.</h2><p>학생 화면의 ‘라면 제조 공정’에서 반죽·제면·건조·냉각·포장 체험을 진행하세요.</p></div>
        <Link href="/" target="_blank">학생 체험 화면 열기</Link>
      </div>
    </section>
  );
}
