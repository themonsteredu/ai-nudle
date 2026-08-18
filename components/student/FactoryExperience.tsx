"use client";

import { useEffect, useState } from "react";
import { FactoryMotionScene } from "@/components/process/FactoryMotionScene";
import type { ProcessTone } from "@/lib/ramen-process";

const MISSIONS = [
  { title: "반죽 상태 조절", subtitle: "물 투입 밸브를 움직여 목표 구간에 맞추세요.", tone: "dough" as ProcessTone },
  { title: "면 굵기 설정", subtitle: "롤러 간격을 조절해 오늘의 규격을 맞추세요.", tone: "noodle" as ProcessTone },
  { title: "생산 방식 선택", subtitle: "생산 의뢰서에 맞는 수분 제거 공정을 선택하세요.", tone: "dry" as ProcessTone },
  { title: "면 냉각", subtitle: "냉각팬을 가동해 포장 가능한 온도까지 식히세요.", tone: "cool" as ProcessTone },
  { title: "포장·품질검사", subtitle: "구성품을 빠짐없이 넣고 최종 검사를 완료하세요.", tone: "pack" as ProcessTone },
];

export function FactoryExperience({ onComplete }: { onComplete: () => void }) {
  const [started, setStarted] = useState(false);
  const [mission, setMission] = useState(0);
  const [moisture, setMoisture] = useState(35);
  const [thickness, setThickness] = useState(1);
  const [method, setMethod] = useState("");
  const [temperature, setTemperature] = useState(82);
  const [cooling, setCooling] = useState(false);
  const [packed, setPacked] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!cooling || temperature <= 32) return;
    const timer = window.setTimeout(() => setTemperature((value) => Math.max(32, value - 2)), 90);
    return () => window.clearTimeout(timer);
  }, [cooling, temperature]);

  const current = MISSIONS[mission];
  const missionPassed =
    (mission === 0 && moisture >= 62 && moisture <= 68) ||
    (mission === 1 && thickness >= 2.7 && thickness <= 3.3) ||
    (mission === 2 && method === "유탕") ||
    (mission === 3 && temperature <= 35) ||
    (mission === 4 && ["면", "스프팩", "건더기팩"].every((item) => packed.includes(item)));

  function checkMission() {
    if (!missionPassed) {
      setMessage(mission === 2 ? "생산 의뢰서에는 유탕면이라고 적혀 있어요." : "표시된 목표 구간을 다시 확인해 보세요.");
      return;
    }
    setMessage("공정 기준을 통과했습니다.");
    window.setTimeout(() => {
      setMessage("");
      setMission((value) => Math.min(MISSIONS.length, value + 1));
    }, 700);
  }

  if (!started) {
    return (
      <section className="content-stage factory-experience-stage">
        <div className="factory-experience-intro">
          <div><span>STEP 02 · NOODLE FACTORY</span><h1>교사의 설명을 들었나요?</h1><p>이제 식품개발연구원이 되어 면 생산라인의 핵심 장치를 직접 조작해 보세요.</p><button className="primary-cta" onClick={() => setStarted(true)}>생산라인 입장</button></div>
          <FactoryMotionScene tone="noodle" />
        </div>
      </section>
    );
  }

  if (mission >= MISSIONS.length) {
    return (
      <section className="content-stage factory-experience-stage">
        <div className="factory-complete">
          <span>PRODUCTION COMPLETE</span><h1>면 생산 완료</h1><p>공정 기준과 품질검사를 모두 통과했습니다.<br />이제 제품의 맛을 설계할 차례입니다.</p>
          <div><b>반죽</b><b>제면</b><b>유탕</b><b>냉각</b><b>품질검사</b></div>
          <button className="primary-cta" onClick={onComplete}>스프 배합 LAB으로</button>
        </div>
      </section>
    );
  }

  return (
    <section className="content-stage factory-experience-stage">
      <div className="page-heading"><div><span className="eyebrow">FACTORY MISSION {String(mission + 1).padStart(2, "0")}</span><h1>{current.title}</h1></div><p>{current.subtitle}</p></div>
      <div className="factory-mission-progress"><i style={{ width: `${((mission + 1) / MISSIONS.length) * 100}%` }} /></div>
      <div className="factory-mission-board">
        <FactoryMotionScene tone={current.tone} playing={(cooling && temperature > 32) || mission !== 3} />
        <div className="factory-control-panel">
          {mission === 0 && <RangeMission label="반죽 수분 상태" value={moisture} setValue={setMoisture} min={0} max={100} target="목표 62–68" left="단단함" right="질음" />}
          {mission === 1 && <RangeMission label="롤러 간격" value={thickness} setValue={setThickness} min={1} max={5} step={0.1} target="목표 3단계" left="가는 면" right="굵은 면" />}
          {mission === 2 && <div className="method-mission"><div className="factory-order"><span>오늘의 생산 의뢰서</span><strong>조리 시간이 짧은 유탕면</strong></div><div><button className={method === "건면" ? "selected" : ""} onClick={() => setMethod("건면")}>열풍으로 건조</button><button className={method === "유탕" ? "selected" : ""} onClick={() => setMethod("유탕")}>기름에 유탕</button></div></div>}
          {mission === 3 && <div className="cooling-mission"><span>현재 면 온도</span><strong>{temperature}℃</strong><div><i style={{ width: `${temperature}%` }} /></div><small>35℃ 이하가 되면 포장할 수 있어요.</small><button onClick={() => setCooling((value) => !value)} disabled={temperature <= 32}>{temperature <= 32 ? "냉각 완료" : cooling ? "냉각팬 정지" : "냉각팬 가동"}</button></div>}
          {mission === 4 && <div className="packing-mission"><span>용기에 넣을 구성품</span><div>{["면", "스프팩", "건더기팩"].map((item) => <button key={item} className={packed.includes(item) ? "selected" : ""} onClick={() => setPacked((items) => items.includes(item) ? items.filter((value) => value !== item) : [...items, item])}>{item}<b>{packed.includes(item) ? "투입 완료" : "투입하기"}</b></button>)}</div></div>}
          {message && <p className={missionPassed ? "mission-message success" : "mission-message"} role="status">{message}</p>}
          <button className="factory-check-button" onClick={checkMission}>{mission === 4 ? "품질검사 실행" : "공정 기준 확인"}</button>
        </div>
      </div>
    </section>
  );
}

function RangeMission({ label, value, setValue, min, max, step = 1, target, left, right }: {
  label: string;
  value: number;
  setValue: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  target: string;
  left: string;
  right: string;
}) {
  return (
    <div className="range-mission">
      <div><span>{label}</span><strong>{Number(value.toFixed(1))}</strong></div>
      <span className="range-target">{target}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => setValue(Number(event.target.value))} aria-label={label} />
      <div className="range-labels"><span>{left}</span><span>{right}</span></div>
    </div>
  );
}
