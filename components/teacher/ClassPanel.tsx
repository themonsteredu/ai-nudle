"use client";
import { AllergenEditor } from "../recipe/Allergens";
import type { AppSettings, LessonClass } from "@/lib/types";
export function ClassPanel({ settings, setSettings, classId, selectClass }: { settings: AppSettings; setSettings: (s:AppSettings)=>void; classId: string; selectClass: (id:string)=>void }) {
  const classes = settings.classes ?? [];
  const lesson = classes.find((x) => x.id === classId);
  function add() {
    const id=crypto.randomUUID();
    const next: LessonClass={id, name:`새 수업 ${classes.length+1}`, code:id.replaceAll("-", "").slice(0,8).toUpperCase(), waterMl:100, cookMinutes:3, noodleFraction:0.25};
    setSettings({ ...settings, classes:[...classes,next] }); selectClass(id);
  }
  const patch=(change:Partial<LessonClass>) => setSettings({ ...settings, classes: classes.map((x)=> x.id === classId ? {...x,...change}:x) });
  return <section className="teacher-panel"><header className="teacher-panel-head"><div><span>CLASS SETTINGS</span><h1>수업·반 설정</h1><p>학교와 반마다 새 수업을 만들어 주세요. 저장한 뒤 수업 코드를 학생에게 알려 주세요.</p></div><button className="teacher-primary" onClick={add}>수업 추가</button></header>
    {!lesson ? <p>새 수업을 추가하거나 위에서 반을 선택해 주세요.</p> : <div className="class-setting-fields"><label className="admin-field"><span>학교 · 반 · 수업일</span><input value={lesson.name} maxLength={100} onChange={(e)=>patch({name:e.target.value})} placeholder="예: 모아중 1학년 2반 · 10월 2일" /></label><div className="class-code"><span>학생 입장 코드</span><strong>{lesson.code}</strong></div><label className="admin-field"><span>물 양 (ml)</span><input type="number" min="1" max="10000" value={lesson.waterMl} onChange={(e)=>patch({waterMl:Number(e.target.value)})} /></label><label className="admin-field"><span>기다리는 시간 (분) · 실제 면 조리법 확인</span><input type="number" min="0.5" max="120" step="0.5" value={lesson.cookMinutes} onChange={(e)=>patch({cookMinutes:Number(e.target.value)})} /></label><label className="admin-field"><span>1회 시식용 라면사리 (개)</span><input type="number" min="0.05" max="1" step="0.05" value={lesson.noodleFraction} onChange={(e)=>patch({noodleFraction:Number(e.target.value)})} /></label><p>국물 연습 횟수는 자유입니다. 라면사리 시식은 기본 베이스 1회, 시판 스프 1회로 진행합니다.</p></div>}
    <h2>비교할 시판 스프</h2><p>상품명은 교사에게만 보이고 학생에게는 A·B·C로 보입니다.</p>
    {settings.comparisonSoups?.map((soup,i)=><article className="comparison-admin" key={soup.id}><label className="admin-field"><span>스프 {String.fromCharCode(65+i)} · 실제 상품명</span><input value={soup.name} maxLength={100} onChange={(e)=>setSettings({...settings,comparisonSoups:settings.comparisonSoups!.map((x)=>x.id===soup.id?{...x,name:e.target.value}:x)})} /></label><label><input type="checkbox" checked={soup.enabled} onChange={(e)=>setSettings({...settings,comparisonSoups:settings.comparisonSoups!.map((x)=>x.id===soup.id?{...x,enabled:e.target.checked}:x)})} />사용</label><AllergenEditor value={soup} onChange={(change)=>setSettings({...settings,comparisonSoups:settings.comparisonSoups!.map((x)=>x.id===soup.id?{...x,...change}:x)})} /></article>)}
    <h2>사리면 포장 확인</h2><AllergenEditor value={settings.noodleAllergens ?? {}} onChange={(change)=>setSettings({...settings,noodleAllergens:{...settings.noodleAllergens,...change}})} />
  </section>;
}
