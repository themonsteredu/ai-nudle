"use client";
import { useState } from "react";
import type { AppSettings, RecipeRecord, StudentProject } from "@/lib/types";
import { METHOD_NAMES, selectedRecord } from "@/lib/notebook";
import { RecipeReadout } from "../student/RecipeNotebook";
import { Fullscreen } from "../recipe/Fullscreen";
function legacyRecord(p: StudentProject, settings: AppSettings): RecipeRecord | undefined {
  const e = p.experiments[p.bestRecipeIndex ?? Math.max(0, p.experiments.findLastIndex((x) => x.saved))];
  if (!e) return undefined;
  return { id:`legacy-${p.id}`, items:Object.entries(e.recipe).filter(([,amount])=>amount>0).map(([id,amount])=>{const item=settings.ingredients.find((x)=>x.id===id); return { id, amount, name:item?.displayName ?? id, category:item?.category ?? "이전 재료", ...item };}), note:e.note, waterMl:0, cookMinutes:0, noodleFraction:0, createdAt:p.updatedAt, updatedAt:p.updatedAt };
}
export function StudentRecipesPanel({ projects, settings, refresh, loading, error, classId }: { projects: StudentProject[]; settings: AppSettings; refresh:()=>void; loading:boolean; error:string; classId:string }) {
  const [studentId,setStudentId]=useState<string|null>(null);
  const [hidden,setHidden]=useState(true);
  const index=projects.findIndex((p)=>p.id===studentId);
  const project=projects[index];
  const lesson=settings.classes?.find((x)=>x.id===classId);
  const displayName=(p:StudentProject,i:number)=> !hidden && p.studentName ? p.studentName : `${p.researcherNumber ?? i+1}번 연구원`;
  const previous=()=>{if(index>0)setStudentId(projects[index-1].id);};
  const next=()=>{if(index<projects.length-1)setStudentId(projects[index+1].id);};
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>CLASS RECIPES</span><h1>학생 레시피 보기</h1><p>{lesson?.name ?? "반 정보 없는 이전 기록"} · 5초마다 갱신됩니다. 학생 기록은 보기만 가능합니다.</p></div><button className="teacher-primary" onClick={refresh} disabled={loading}>{loading?"불러오는 중":"새로고침"}</button></header>
    <button className="privacy-toggle" aria-pressed={hidden} onClick={()=>setHidden(!hidden)}>{hidden?"이름 가리기 켜짐":"이름 가리기 꺼짐"}</button><p role="status">{error}</p>
    <div className="student-recipe-list">{projects.map((p,i)=><button key={p.id} onClick={()=>setStudentId(p.id)}><strong>{displayName(p,i)}</strong><span>{p.notebook?.final?.productName || "레시피 열기"}</span></button>)}</div>{!projects.length && !error && <p className="empty-record">이 반에 저장된 학생 기록이 아직 없습니다.</p>}
    {project && <Fullscreen title={`${lesson?.name ?? "이전 기록"} · ${displayName(project,index)}`} close={()=>setStudentId(null)} previous={previous} next={next}><div className="recipe-presentation"><header><div><span>우리 반 레시피</span><h1>{displayName(project,index)}</h1></div><div><button aria-pressed={hidden} onClick={()=>setHidden(!hidden)}>{hidden?"이름 가리기 켜짐":"이름 가리기 꺼짐"}</button><button onClick={refresh}>새로고침</button></div></header>
      <p className="lesson-settings">{lesson?`교사 설정 · 물 ${lesson.waterMl}ml · 라면사리 ${lesson.noodleFraction}개 · ${lesson.cookMinutes}분`:"이전 기록의 물 양·조리 시간은 저장되어 있지 않습니다."}</p>{error && <p role="status">{error}</p>}
      <div className="two-recipes">{(["base","commercial"] as const).map((m)=>{const record=project.notebook?selectedRecord(project,m):m==="base"?legacyRecord(project,settings):undefined;const tasting=Boolean(project.notebook?.[m].tasting);return <div key={m}><RecipeReadout record={record} settings={settings} noodles={tasting} title={`${METHOD_NAMES[m]} · ${!project.notebook ? "이전 배합 기록" : tasting?"라면 시식":"최근 국물 연습"}`} />{project.notebook?.[m].practices.length ? <details className="practice-history" key={`${project.id}-${m}`}><summary>연습 기록 펼치기 ({project.notebook[m].practices.length})</summary>{project.notebook[m].practices.map((r,i)=><RecipeReadout key={r.id} record={r} settings={settings} title={`연습 ${i+1}`} />)}</details>:null}</div>;})}</div>
      <footer className="presentation-navigation"><button disabled={index===0} onClick={previous}>이전 학생</button><span>{index+1} / {projects.length}</span><button disabled={index===projects.length-1} onClick={next}>다음 학생</button></footer></div></Fullscreen>}
  </section>;
}
