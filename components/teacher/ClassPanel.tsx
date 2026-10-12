"use client";
import { AllergenEditor } from "../recipe/Allergens";
import type { AppSettings, LessonClass } from "@/lib/types";
import { DEFAULT_GROUP_COUNT, groupCountOf, MAX_GROUP_COUNT } from "@/lib/groups";
function numericCode(used: string[]) {
  let code = "";
  do code = String(100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000)); while (used.includes(code));
  return code;
}
export function ClassPanel({ settings, setSettings, classId, selectClass, openSoups }: { settings: AppSettings; setSettings: (s:AppSettings)=>void; classId: string; selectClass: (id:string)=>void; openSoups: ()=>void }) {
  const classes = settings.classes ?? [];
  const lesson = classes.find((x) => x.id === classId);
  function add() {
    const id=crypto.randomUUID();
    const next: LessonClass={id, name:`새 수업 ${classes.length+1}`, code:numericCode(classes.map((x)=>x.code)), waterMl:100, cookMinutes:3, noodleFraction:0.25, groupCount:DEFAULT_GROUP_COUNT};
    setSettings({ ...settings, classes:[...classes,next] }); selectClass(id);
  }
  const patch=(change:Partial<LessonClass>) => setSettings({ ...settings, classes: classes.map((x)=> x.id === classId ? {...x,...change}:x) });
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>CLASS SETTINGS</span><h1>수업·반 설정</h1><p>학교와 반마다 새 수업을 만들어 주세요. 저장한 뒤 수업 코드를 학생에게 알려 주세요.</p></div><button className="teacher-primary" onClick={add}>수업 추가</button></header>
    {!lesson ? <p>새 수업을 추가하거나 위에서 반을 선택해 주세요.</p> : <div className="class-setting-fields"><label className="admin-field"><span>학교 · 반 · 수업일</span><input value={lesson.name} maxLength={100} onChange={(e)=>patch({name:e.target.value})} placeholder="예: 모아중 1학년 2반 · 10월 2일" /></label><div className="class-code"><span>학생 입장 코드</span><strong>{lesson.code}</strong></div><label className="admin-field"><span>물 양 (ml)</span><input type="number" min="1" max="10000" value={lesson.waterMl} onChange={(e)=>patch({waterMl:Number(e.target.value)})} /></label><label className="admin-field"><span>기다리는 시간 (분) · 실제 면 조리법 확인</span><input type="number" min="0.5" max="120" step="0.5" value={lesson.cookMinutes} onChange={(e)=>patch({cookMinutes:Number(e.target.value)})} /></label><label className="admin-field"><span>1회 시식용 라면사리 (개)</span><input type="number" min="0.05" max="1" step="0.05" value={lesson.noodleFraction} onChange={(e)=>patch({noodleFraction:Number(e.target.value)})} /></label><label className="admin-field"><span>모둠 수 · 학생이 처음 들어올 때 고르는 모둠 (2~{MAX_GROUP_COUNT})</span><input type="number" min="2" max={MAX_GROUP_COUNT} step="1" inputMode="numeric" value={lesson.groupCount ?? DEFAULT_GROUP_COUNT} onChange={(e)=>patch({groupCount:Math.round(Number(e.target.value) || 0)})} onBlur={()=>{ if (lesson.groupCount !== undefined && lesson.groupCount !== groupCountOf(lesson)) patch({groupCount:groupCountOf(lesson)}); }} /><small className="gb-field-hint">학생이 이미 들어왔다면 모둠 수를 줄이지 마세요. 큰 번호 모둠 학생은 모둠을 다시 골라야 해요. (블라인드 투표 중에는 그대로 두어요)</small></label><p>국물 연습 횟수는 자유입니다. 라면사리 시식은 기본 베이스 1회, 시판 스프 1회로 진행합니다.</p></div>}
    <h2>비교할 시판 스프</h2><p>시판 스프 추가·삭제와 상품명·알레르기는 <button type="button" className="ing-link" onClick={openSoups}>재료 관리 › 시판 스프 관리</button>에서 바꿔요. 지금 사용 중: {settings.comparisonSoups?.filter((x)=>x.enabled).length ?? 0}개</p>
    <h2>사리면 포장 확인</h2><AllergenEditor value={settings.noodleAllergens ?? {}} onChange={(change)=>setSettings({...settings,noodleAllergens:{...settings.noodleAllergens,...change}})} />
  </section>;
}
