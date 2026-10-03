"use client";

import { useState } from "react";
import Image from "next/image";
import { CAREER_VIDEO, type CareerSlide } from "@/lib/career-slides";

function OfficialVideo() {
  const [open, setOpen] = useState(false);
  return <>
    <div className="career-video-frame">
      {open ? <iframe src={CAREER_VIDEO.embedUrl} title={CAREER_VIDEO.title}
        allow="encrypted-media; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /> :
        <div className="career-video-poster"><div>
          <span>한국식품연구원 · 공식 영상</span>
          <strong>식품은 어디까지 연구할 수 있을까요?</strong>
          <p>기능 · 품질 · 안전 · 기술</p>
          <button onClick={() => setOpen(true)}>영상 불러오기</button>
          <small>불러온 뒤 재생을 눌러 주세요 · 약 1분 시청</small>
        </div></div>}
    </div>
    <div className="career-video-links">
      {open && <button onClick={() => setOpen(false)}>영상 닫기</button>}
      <a href={CAREER_VIDEO.watchUrl} target="_blank" rel="noreferrer">YouTube에서 보기</a>
      <a href={CAREER_VIDEO.sourceUrl} target="_blank" rel="noreferrer">공식 게시 페이지</a>
    </div>
    <details className="career-video-fallback"><summary>재생이 안 되나요? 영상 대신 설명</summary><p>한국식품연구원은 식품의 기능과 품질·안전 등을 연구합니다. 공식 소개에는 무균포장 즉석밥과 한국형 우주식품 같은 연구 성과가 나옵니다.</p><p>“음식을 오래 보관하거나 특별한 환경에서 먹으려면 무엇을 연구해야 할까요?”라고 함께 이야기해 보세요.</p></details>
  </>;
}

function TopicDiagram({ type }: { type: CareerSlide["visual"] }) {
  switch (type) {
    case "job": return <div className="career-job-map">
      <div className="career-diagram-heading"><span>연구실에서 남기는 자료</span><strong>질문이 결과물로 이어져요</strong></div>
      <dl>{[
        ["어떤 제품이 필요할까?", "조사·기획", "개발 목표와 비교 기준"],
        ["어떻게 만들 수 있을까?", "배합·시제품", "배합표와 만드는 방법"],
        ["목표에 가까워졌을까?", "평가·수정", "평가 기록과 수정한 조건"],
      ].map(([question, work, result], i) => <div key={work}><dt><span>0{i + 1}</span>{question}</dt><dd><b>{work}</b><span aria-hidden="true">→</span><strong>{result}</strong></dd></div>)}</dl>
    </div>;
    case "brief": return <div className="career-brief">
      <div className="career-diagram-heading"><span>개발 의뢰서 · 수업용 가상 상황</span><strong>덜 맵고 고소한 국물</strong></div>
      <dl>{[
        ["먹는 사람", "매운맛은 부담스럽지만 라면은 좋아하는 사람"],
        ["바꿀 것", "매운 느낌을 줄이기"],
        ["유지할 것", "고소한 향과 국물의 풍미"],
        ["비교 조건", "같은 물의 양 · 같은 조리 조건"],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <p className="career-brief-goal">목표를 정하면 무엇을 바꿔 볼지 보이기 시작해요.</p>
    </div>;
    case "case": return <div className="career-case-study">
      <div className="career-diagram-heading"><span>실제 개발 사례 · CJ제일제당, 2022년 발표</span><strong>맛을 넘어 식감까지</strong></div>
      <div className="career-case-path">
        <div><span>원료</span><strong>대두 · 완두 등</strong><p>식물성 단백질 소재를 만들 원료를 배합</p></div>
        <div><span>연구 과제</span><strong>구조와 식감</strong><p>탄력과 씹는 느낌, 수분감을 구현</p></div>
        <div><span>제품 적용</span><strong>떡갈비 · 함박</strong><p>개발한 소재를 식물성 식품에 활용</p></div>
      </div>
      <p className="career-diagram-note">기업의 당시 공식 발표 요약입니다. 현재 제품의 성분 안내는 실제 포장을 확인해요.</p>
    </div>;
    case "journey": return <div className="career-journey">
      <div className="career-diagram-heading"><span>신제품 개발 · 수업용 요약</span><strong>만들고, 확인하고, 되돌아가기</strong></div>
      <ol>{[
        ["조사와 목표", "누구를 위해 무엇을 바꿀까?"],
        ["시제품 만들기", "원료·배합·만드는 방법을 시험"],
        ["맛과 품질 평가", "결과를 목표와 비교"],
        ["시험 생산", "양이 늘어나도 같은 품질일까?"],
        ["포장과 출시 준비", "보관·조리·표시 등을 검토"],
      ].map(([title, detail], i) => <li key={title}><span>0{i + 1}</span><div><strong>{title}</strong><p>{detail}</p></div>{i === 2 && <b className="career-loop">목표와 다르면 02로</b>}</li>)}</ol>
    </div>;
    case "recipe": return <div className="career-recipe-example">
      <table><caption><span>수업용 가상 예시 · 권장 투입량 아님</span><strong>마늘 양만 바꿔 보기</strong></caption>
        <thead><tr><th scope="col">재료·조건</th><th scope="col">배합 A</th><th scope="col">배합 B</th></tr></thead>
        <tbody>
          <tr><th scope="row">베이스</th><td>1.0 g</td><td>1.0 g</td></tr>
          <tr><th scope="row">양파</th><td>0.2 g</td><td>0.2 g</td></tr>
          <tr className="career-changed-row"><th scope="row">마늘 <small>바꾼 것</small></th><td>0.1 g</td><td><strong>0.2 g</strong></td></tr>
          <tr><th scope="row">물</th><td>100 ml</td><td>100 ml</td></tr>
          <tr className="career-taste-row"><th scope="row">느낀 맛</th><td>마늘 향이 약하게 느껴짐</td><td>마늘 향이 더 또렷하게 느껴짐</td></tr>
        </tbody>
      </table>
      <p className="career-diagram-note">실제 맛을 보장하는 배합표가 아니에요. 수업에서는 선생님이 정한 양과 조건을 따라요.</p>
    </div>;
    case "quality": return <div className="career-quality">
      <div className="career-diagram-heading"><span>출시를 준비하며 확인할 세 가지</span><strong>맛 평가만으로 끝나지 않아요</strong></div>
      {[
        ["분석", "안전을 확인할 자료", "원료·제품의 이화학·미생물 분석 등"],
        ["시험 생산", "같은 품질로 만들 조건", "생산 규모에서 혼합·가열 상태 확인"],
        ["포장·보관", "유통하고 사용할 조건", "시간이 지난 뒤 상태와 조리법 확인"],
      ].map(([label, title, detail], i) => <div className="career-quality-row" key={label}><span>0{i + 1}</span><div><small>{label}</small><strong>{title}</strong><p>{detail}</p></div></div>)}
    </div>;
    case "skills": return <div className="career-skills-map">
      <div className="career-diagram-heading"><span>지금의 배움 → 연구실에서 하는 일</span><strong>배운 것을 연결하는 힘</strong></div>
      <dl>{[
        ["과학", "재료의 성질과 변화를 관찰해요."],
        ["수학", "양과 비율을 재고 비교해요."],
        ["국어·소통", "느낀 차이와 근거를 정확하게 전해요."],
        ["협력", "다른 담당자의 의견으로 문제를 풀어요."],
      ].map(([subject, work]) => <div key={subject}><dt>{subject}</dt><dd>{work}</dd></div>)}</dl>
      <div className="career-study-path"><span>관련 전공의 예</span><p>식품공학 · 식품영양학 · 생명과학 등</p></div>
    </div>;
    case "methods": return <div className="career-methods">
      <div className="career-diagram-heading"><span>오늘의 두 가지 연구</span><strong>각 방법에서 라면 시식 한 번씩</strong></div>
      <div className="career-method-columns">{[
        ["01", "기본 베이스", "베이스와 추가 재료로 맛의 바탕부터 만들어요."],
        ["02", "시판 스프", "완성된 스프에 추가 재료로 변화를 줘요."],
      ].map(([number, title, detail]) => <section key={title}><span>{number}</span><h3>{title}</h3><p>{detail}</p><ol><li>국물 연습<small>필요할 때 기록 추가</small></li><li>레시피 선택<small>기록을 복사해 사용</small></li><li>라면 시식 1회<small>재료 g + 맛 느낌 한 줄</small></li></ol></section>)}</div>
    </div>;
    default: return null;
  }
}

export function CareerSlideVisual({ slide }: { slide: CareerSlide }) {
  return <aside className={"career-visual career-visual-" + slide.visual} data-visual={slide.visual}>
    {slide.visual === "video" ? <OfficialVideo /> : slide.visual === "photo" && slide.image ? <>
      <figure className="career-photo"><Image src={slide.image} alt={slide.imageAlt ?? ""} width={1536} height={1024} sizes="(max-width: 800px) 100vw, 45vw" /><figcaption>수업용 생성 이미지 · 실제 기관 촬영 사진이 아닙니다</figcaption></figure>
      <div className="career-visual-caption"><span>{slide.visualLabel}</span><div>{slide.visualWords.map((word, i) => <strong key={word}><small>{String(i + 1).padStart(2, "0")}</small>{word}</strong>)}</div></div>
    </> : <TopicDiagram type={slide.visual} />}
    <div className="career-example"><span>{slide.example.label}</span><p>{slide.example.text}</p></div>
  </aside>;
}
