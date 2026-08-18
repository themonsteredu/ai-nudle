"use client";

import type { AppSettings, StudentProject } from "@/lib/types";
import { grams } from "../StudentApp";

export function BestRecipeView({
  project,
  ingredients,
  finalScale,
  selectBest,
  onLabel,
}: {
  project: StudentProject;
  ingredients: AppSettings["ingredients"];
  finalScale: number;
  selectBest: (index: number) => void;
  onLabel: () => void;
}) {
  const best = project.bestRecipeIndex === null
    ? null
    : project.experiments[project.bestRecipeIndex];

  return (
    <section className="content-stage best-stage">
      <div className="page-heading">
        <div><span className="eyebrow">FINAL DECISION</span><h1>어떤 레시피를 출시할까요?</h1></div>
        <p>R-01도 훌륭한 연구 결과예요.</p>
      </div>
      <div className="best-choice-grid">
        {project.experiments.map((experiment, index) => (
          <button
            key={index}
            className={project.bestRecipeIndex === index ? "selected" : ""}
            onClick={() => selectBest(index)}
          >
            <span>RECIPE</span>
            <strong>R-{String(index + 1).padStart(2, "0")}</strong>
            <small>{experiment.note || "내 배합 확인"}</small>
            <i>{project.bestRecipeIndex === index ? "선택 완료" : "이 레시피 선택"}</i>
          </button>
        ))}
      </div>
      {best && (
        <div className="final-production">
          <div className="final-recipe-panel">
            <span className="eyebrow">FINAL SPICE MIX</span>
            <h2>최종 스프 계량표</h2>
            <p>시식 배합을 사리면 1개 기준으로 {Number(finalScale.toFixed(1))}배 계산했어요.</p>
            <div>
              {ingredients
                .filter((item) => (best.recipe[item.id] ?? 0) > 0)
                .map((item) => (
                  <span key={item.id}><b>{item.displayName}</b><strong>{grams((best.recipe[item.id] ?? 0) * finalScale)}</strong></span>
                ))}
            </div>
          </div>
          <ol className="production-steps">
            {[
              "무지 라면용기 준비",
              "사리면 1개 넣기",
              "최종 비율로 스프 계량",
              "식품용 소분팩에 담기",
              "건더기 소분팩 준비",
              "용기에 함께 넣기",
              "제품 라벨 붙이기",
            ].map((step, index) => <li key={step}><span>{index + 1}</span>{step}</li>)}
          </ol>
          <button className="primary-cta compact" onClick={onLabel}>제품 라벨 만들기 →</button>
        </div>
      )}
    </section>
  );
}

export function LabelView({
  project,
  setProject,
  ingredients,
  bestExperiment,
  finalScale,
  persist,
}: {
  project: StudentProject;
  setProject: (project: StudentProject) => void;
  ingredients: AppSettings["ingredients"];
  bestExperiment: StudentProject["experiments"][number] | null;
  finalScale: number;
  persist: (project: StudentProject, message: string) => Promise<void>;
}) {
  if (!bestExperiment || project.bestRecipeIndex === null) {
    return (
      <section className="content-stage">
        <div className="empty-state large"><h1>먼저 BEST RECIPE를 선택해 주세요.</h1><p>나의 레시피 메뉴에서 가장 만족한 배합을 고르면 라벨을 만들 수 있어요.</p></div>
      </section>
    );
  }

  const updateLabel = (key: keyof StudentProject["label"], value: string) =>
    setProject({ ...project, label: { ...project.label, [key]: value } });

  return (
    <section className="content-stage label-stage">
      <div className="page-heading">
        <div><span className="eyebrow">PRODUCT DESIGN</span><h1>제품 라벨 만들기</h1></div>
        <p>내 레시피를 진짜 제품처럼 완성해요.</p>
      </div>
      <div className="label-workspace">
        <div className="label-fields">
          <label><span>제품명</span><input value={project.label.productName} onChange={(event) => updateLabel("productName", event.target.value)} placeholder="예: 불꽃마늘라면" maxLength={18} /></label>
          <label><span>한 줄 맛 설명</span><input value={project.label.tasteLine} onChange={(event) => updateLabel("tasteLine", event.target.value)} placeholder="예: 마늘향 뒤에 매콤함이 톡!" maxLength={34} /></label>
          <label><span>개발자명</span><input value={project.label.developerName} onChange={(event) => updateLabel("developerName", event.target.value)} placeholder="이름 또는 개발팀명" maxLength={20} /></label>
          <div className="label-buttons">
            <button className="filled" onClick={() => void persist(project, "제품 라벨을 저장했어요.")}>라벨 저장</button>
            <button onClick={() => window.print()}>내 라벨 인쇄</button>
          </div>
        </div>
        <ProductLabelPreview project={project} ingredients={ingredients} bestExperiment={bestExperiment} finalScale={finalScale} />
      </div>
    </section>
  );
}

export function ProductLabelPreview({
  project,
  ingredients,
  bestExperiment,
  finalScale,
  compact = false,
  printTarget = true,
}: {
  project: StudentProject;
  ingredients: AppSettings["ingredients"];
  bestExperiment: StudentProject["experiments"][number];
  finalScale: number;
  compact?: boolean;
  printTarget?: boolean;
}) {
  return (
    <article className={`product-label ${compact ? "compact-label" : ""} ${printTarget ? "print-target" : ""}`}>
      <div className="label-front">
        <span>FOOD R&amp;D LAB</span>
        <h2>{project.label.productName || "나의 신제품 라면"}</h2>
        <p>{project.label.tasteLine || "한 줄 맛 설명을 입력해 주세요"}</p>
        <strong>{project.label.developerName || project.studentName || "개발 연구원"}</strong>
      </div>
      <div className="label-recipe">
        <span>BEST RECIPE · R-{String((project.bestRecipeIndex ?? 0) + 1).padStart(2, "0")}</span>
        <div>
          {ingredients
            .filter((item) => (bestExperiment.recipe[item.id] ?? 0) > 0)
            .map((item) => <p key={item.id}><b>{item.displayName}</b><strong>{grams((bestExperiment.recipe[item.id] ?? 0) * finalScale)}</strong></p>)}
        </div>
        <small>본 라벨은 직업체험 수업용입니다.</small>
      </div>
    </article>
  );
}
