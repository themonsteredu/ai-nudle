"use client";

import { TASTE_TAGS } from "@/lib/defaults";
import type { AppSettings, StudentProject } from "@/lib/types";
import { grams } from "../StudentApp";

export function TasteView({
  project,
  setProject,
  currentTest,
  setCurrentTest,
  ingredients,
  saveTasteRecord,
  onReturnLab,
  onCompare,
}: {
  project: StudentProject;
  setProject: (project: StudentProject) => void;
  currentTest: number;
  setCurrentTest: (value: number) => void;
  ingredients: AppSettings["ingredients"];
  saveTasteRecord: (index: number) => void;
  onReturnLab: () => void;
  onCompare: () => void;
}) {
  const experiment = project.experiments[currentTest];
  function updateExperiment(change: Partial<(typeof project.experiments)[number]>) {
    const experiments = [...project.experiments];
    experiments[currentTest] = { ...experiment, ...change };
    setProject({ ...project, experiments });
  }

  return (
    <section className="content-stage taste-stage">
      <div className="page-heading">
        <div><span className="eyebrow">TASTE TEST</span><h1>먹어보고 한 줄 기록</h1></div>
        <p>웹앱이 아니라 연구원이 맛을 판단해요.</p>
      </div>
      <div className="taste-layout">
        <div className="taste-index">
          {project.experiments.map((item, index) => (
            <button key={index} className={currentTest === index ? "active" : ""} onClick={() => setCurrentTest(index)}>
              <strong>R-{String(index + 1).padStart(2, "0")}</strong>
              <span>{item.note || (item.saved ? "시식 대기" : "배합 전")}</span>
            </button>
          ))}
        </div>
        <div className="taste-record">
          <span className="record-number">R-{String(currentTest + 1).padStart(2, "0")}</span>
          <h2>어떤 맛이었나요?</h2>
          <div className="mini-formula">
            {ingredients
              .filter((item) => (experiment.recipe[item.id] ?? 0) > 0)
              .map((item) => <span key={item.id}>{item.displayName} <b>{grams(experiment.recipe[item.id])}</b></span>)}
          </div>
          <div className="taste-tags">
            {TASTE_TAGS.map((tag) => {
              const selected = experiment.tags.includes(tag);
              return (
                <button
                  key={tag}
                  className={selected ? "selected" : ""}
                  onClick={() => updateExperiment({
                    tags: selected
                      ? experiment.tags.filter((item) => item !== tag)
                      : [...experiment.tags, tag],
                  })}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <label className="note-field">
            <span>한 줄 메모 <small>선택</small></span>
            <input
              value={experiment.note}
              onChange={(event) => updateExperiment({ note: event.target.value })}
              placeholder="예: 마늘향을 조금 줄이고 싶다"
              maxLength={60}
            />
          </label>
          <div className="record-actions">
            <button onClick={onReturnLab}>← 배합 수정</button>
            <button className="filled" onClick={() => saveTasteRecord(currentTest)}>기록 저장</button>
            {currentTest < project.experiments.length - 1 ? (
              <button className="primary-cta compact" onClick={() => { setCurrentTest(currentTest + 1); onReturnLab(); }}>다음 TEST →</button>
            ) : (
              <button className="primary-cta compact" onClick={onCompare}>4개 비교 →</button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export function CompareView({
  project,
  ingredients,
  onBest,
}: {
  project: StudentProject;
  ingredients: AppSettings["ingredients"];
  onBest: () => void;
}) {
  return (
    <section className="content-stage compare-stage">
      <div className="page-heading">
        <div><span className="eyebrow">COMPARE</span><h1>4개 레시피 비교</h1></div>
        <p>값을 보고, 먹어본 기억을 떠올려요.</p>
      </div>
      <div className="recipe-table-wrap">
        <table className="recipe-table">
          <thead>
            <tr><th>재료</th>{project.experiments.map((_, index) => <th key={index}>R-{String(index + 1).padStart(2, "0")}</th>)}</tr>
          </thead>
          <tbody>
            {ingredients.map((item) => (
              <tr key={item.id}>
                <th>{item.displayName}</th>
                {project.experiments.map((experiment, index) => <td key={index}>{grams(experiment.recipe[item.id] ?? 0)}</td>)}
              </tr>
            ))}
            <tr className="memo-row">
              <th>시식 메모</th>
              {project.experiments.map((experiment, index) => <td key={index}>{experiment.note || "—"}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="compare-footer">
        <p>가장 많이 바꾼 재료보다, <strong>가장 만족한 맛</strong>을 선택하세요.</p>
        <button className="primary-cta compact" onClick={onBest}>BEST RECIPE 고르기 →</button>
      </div>
    </section>
  );
}
