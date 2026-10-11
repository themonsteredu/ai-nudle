/* 모둠 베스트 제출 + 블라인드 투표 end-to-end checks against a LOCAL Vite/Cloudflare D1 server only.
   PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome TEST_ORIGIN=http://127.0.0.1:5199 node tests/group-vote-e2e.cjs
   Optional SCREENSHOT_DIR (default outputs/verification/group-vote). Writes a new test classroom to local D1; never run against production. */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test script run directly by node */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Use a local test database');
const out = path.resolve(process.env.SCREENSHOT_DIR || 'outputs/verification/group-vote');fs.mkdirSync(out,{recursive:true});
const POLL = 25000; // students re-read settings every 12s, the teacher re-reads projects every 5s
const GROUP_NEAR_LETTER = /레시피\s*[A-L][^\n]{0,16}\d+\s*모둠|\d+\s*모둠[^\n]{0,16}레시피\s*[A-L](?![A-Za-z])/;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let debugPage = null;

(async()=>{
 const { groupLabel, tallyVotes, voteKey, GROUP_KEY } = await import('../lib/groups.ts');
 const api = await request.newContext({baseURL:origin});
 assert.equal((await api.post('/api/teacher/login',{data:{password:'3035'}})).status(),200);
 // Local D1 can briefly answer SQLITE_BUSY when another dev server shares it.
 async function putSettings(settings){for(let i=0;;i++){const r=await api.put('/api/settings',{data:{settings}});if(r.status()===200)return (await r.json()).settings;if(i>=5||r.status()!==500)assert.fail(`PUT /api/settings ${r.status()} ${await r.text()}`);await sleep(600);}}
 const teacherSettings = async () => (await (await api.get('/api/settings')).json()).settings;
 const teacherProjects = async id => (await (await api.get('/api/students?classId='+id)).json()).projects;

 // 1. A fresh class with 4 모둠 and a numeric 6-digit code.
 const settings = await teacherSettings();
 const used = new Set(settings.classes.map(c=>c.code));
 let code; do code = String(100000 + Math.floor(Math.random()*900000)); while (used.has(code));
 const lesson = { id:crypto.randomUUID(), name:`블라인드 검증반 ${code}`, code, waterMl:110, cookMinutes:3, noodleFraction:.25, groupCount:4 };
 settings.classes.push(lesson);
 const savedSettings = await putSettings(settings);
 assert.equal(savedSettings.classes.find(c=>c.id===lesson.id).groupCount,4,'groupCount survives the settings save');
 const anonymous = await request.newContext({baseURL:origin});
 const studentLesson = async () => (await (await anonymous.get('/api/settings?code='+code)).json()).settings.classes[0];
 const first = await studentLesson();
 assert.equal(first.code,'');assert.equal(first.groupCount,4);assert.equal(first.blindRound,undefined);
 // Ingredients the base-method editor shows (labels are "<name> 양(g)").
 const ingredients = savedSettings.ingredients.filter(x=>x.enabled).sort((a,b)=>a.order-b.order).map(x=>x.displayName||x.name);
 assert(ingredients.length>=6,'need at least 6 enabled ingredients');

 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 const errors = [];
 const shot = (p,name,full=true) => p.screenshot({path:path.join(out,`e2e-${name}.png`),fullPage:full});
 const noOverflow = async (p,label) => assert(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),label+' horizontal overflow');
 async function studentPage(){const c=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p=await c.newPage();p.on('pageerror',e=>errors.push('student: '+e.message));return p;}
 const local = p => p.evaluate(id=>{const pid=localStorage.getItem('ramen-active:'+id);return JSON.parse(localStorage.getItem('ramen-notebook:'+pid));},lesson.id);
 // Waits until this device's record on the server satisfies check (more reliable than the save badge).
 async function serverProject(p,check,label){const s=await local(p);const deadline=Date.now()+POLL;for(;;){const r=await anonymous.get('/api/students?id='+s.project.id,{headers:{'x-class-code':code,'x-student-key':s.key}});const project=r.status()===200?(await r.json()).project:null;if(project&&check(project))return project;if(Date.now()>deadline)assert.fail(`server record never matched: ${label}`);await sleep(500);}}
 const nav = (p,name) => p.locator('.student-nav').getByRole('button',{name,exact:true});
 async function join(p,group,shotName){
  await p.goto(origin);await p.waitForLoadState('networkidle');
  await p.getByLabel('수업 코드',{exact:true}).fill(code);await p.getByRole('button',{name:'기록 시작하기',exact:true}).click();
  await p.getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?',exact:true}).waitFor();
  assert.deepEqual(await p.locator('.gb-pick-grid button').evaluateAll(b=>b.map(x=>x.getAttribute('aria-label'))),['1모둠','2모둠','3모둠','4모둠'],'picker shows groupCount buttons');
  if(shotName){await noOverflow(p,'group picker');await shot(p,shotName);}
  await p.getByRole('button',{name:`${group}모둠`,exact:true}).click();
  await p.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();
  assert.equal(await p.locator('.gb-mygroup').textContent(),groupLabel(group));
  await serverProject(p,x=>x.notebook?.comparisons?.[GROUP_KEY]===String(group),`group ${group} saved`);
  await p.waitForFunction(g=>/^\d+모둠 · \d+번 연구원$/.test(document.querySelector('.notebook-session strong')?.textContent??'')&&document.querySelector('.notebook-session strong').textContent.startsWith(g),groupLabel(group));
 }
 const recipes = [
  { group:1, items:[[ingredients[0],'1.2'],[ingredients[3],'0.15']], note:'노트하나 칼칼해요', name:'초록불꽃 라면', line:'비밀소개하나 매콤한 불꽃', spicy:'2' },
  { group:2, items:[[ingredients[1],'1.5'],[ingredients[4],'0.25']], note:'노트둘 구수해요', name:'구름사골 라면', line:'비밀소개둘 진한 사골', spicy:'0' },
  { group:3, items:[[ingredients[2],'0.8'],[ingredients[5],'0.35']], note:'노트셋 달큰해요', name:'달빛마늘 라면', line:'비밀소개셋 고소한 마늘', spicy:'1' },
 ];
 const secrets = recipes.flatMap(r=>[r.name,r.line]);
 async function submitBest(p,r,shotName){
  await nav(p,'레시피 기록').click();
  await p.getByRole('button',{name:'라면 기록 쓰기',exact:true}).click();
  for(const [name,grams] of r.items) await p.getByLabel(`${name} 양(g)`,{exact:true}).fill(grams);
  await p.getByLabel('맛 느낌 한 줄',{exact:true}).fill(r.note);
  await nav(p,'모둠 베스트 제출').click();
  await p.getByText('미제출',{exact:true}).waitFor();
  await p.getByLabel('제출할 라면 기록',{exact:true}).selectOption('base');
  await p.getByLabel('라면 이름',{exact:true}).fill(r.name);await p.getByLabel('한 줄 소개',{exact:true}).fill(r.line);await p.getByLabel('맵기 단계',{exact:true}).selectOption(r.spicy);
  let message='';p.once('dialog',d=>{message=d.message();void d.accept();});
  await p.getByRole('button',{name:'모둠 베스트 레시피 제출',exact:true}).click();
  await p.locator('.gb-sub-status.done').getByText('제출 완료',{exact:true}).waitFor();
  assert.match(message,new RegExp(groupLabel(r.group)),'confirm names the student\'s own group');
  await p.getByRole('button',{name:'제출 취소',exact:true}).waitFor();
  await p.getByRole('button',{name:'다시 제출하기',exact:true}).waitFor();
  assert.equal(await p.locator('.sticker-sheet').count(),1,'stickers stay available after submitting');
  assert.equal(await p.getByRole('button',{name:'앞·뒷면 인쇄',exact:true}).count(),1);
  const saved = await serverProject(p,x=>x.notebook?.final?.shared===true&&x.notebook.final.productName===r.name,`group ${r.group} submission`);
  assert.equal(saved.notebook.final.method,'base');assert.equal(saved.notebook.final.tasteLine,r.line);assert.equal(saved.notebook.final.spicyLevel,Number(r.spicy));
  assert.deepEqual(saved.notebook.final.record.items.map(x=>[x.name,x.amount]).sort(),r.items.map(([n,g])=>[n,Number(g)]).sort());
  assert.equal(saved.notebook.comparisons[GROUP_KEY],String(r.group));
  if(shotName){await noOverflow(p,'submit page');await shot(p,shotName);}
  return saved;
 }

 // 2. Students: S1..S3 submit a group best recipe, S4 (1모둠) and S5 (2모둠) only vote.
 const S = [];
 for(let i=0;i<5;i++) S.push(await studentPage());
 debugPage = S[0];
 await join(S[0],1,'01-student-group-picker');
 const sub1 = await submitBest(S[0],recipes[0],'02-student-submitted');
 await join(S[1],2);const sub2 = await submitBest(S[1],recipes[1]);
 await join(S[2],3);const sub3 = await submitBest(S[2],recipes[2]);
 await join(S[3],1);await join(S[4],2);
 const studentIds = await Promise.all(S.map(async p=>(await local(p)).project.id));
 const groupOfStudent = [1,2,3,1,2];

 // 3. Teacher (board size) sees only 제출/미제출 per group.
 const teacherContext = await browser.newContext({storageState:await api.storageState(),viewport:{width:1366,height:900}});
 const teacher = await teacherContext.newPage();teacher.on('pageerror',e=>errors.push('teacher: '+e.message));debugPage = teacher;
 await teacher.goto(origin+'/teacher');await teacher.waitForLoadState('networkidle');
 await teacher.getByLabel('수업 선택',{exact:true}).selectOption(lesson.id);
 await teacher.locator('.teacher-sidebar').getByRole('button',{name:'모둠 베스트·블라인드 투표',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelector('.gb-count')?.textContent==='3 / 4 모둠 제출',null,{timeout:POLL});
 const chips = await teacher.locator('.gb-chips li').evaluateAll(li=>li.map(x=>({text:x.textContent,done:x.classList.contains('done')})));
 assert.deepEqual(chips,[{text:'1모둠제출',done:true},{text:'2모둠제출',done:true},{text:'3모둠제출',done:true},{text:'4모둠미제출',done:false}],'submission chips show only 제출/미제출');
 const startButton = teacher.getByRole('button',{name:'블라인드 테스트 시작',exact:true});
 assert(await startButton.isEnabled(),'start is enabled with 3 submitted groups');
 let panelText = await teacher.locator('.gb-panel').innerText();
 for(const s of secrets) assert(!panelText.includes(s),`recipe content "${s}" must not be shown before the test`);
 await noOverflow(teacher,'teacher panel');await shot(teacher,'03-teacher-submissions');
 // Shared recipes are the future blind samples, so the friend gallery stays closed before the test too.
 await nav(S[3],'친구 레시피').click();
 await S[3].getByText('블라인드 테스트 뒤에 열려요',{exact:true}).waitFor();
 assert.equal(await S[3].locator('.class-recipes article').count(),0,'gallery is hidden before the test');
 { const before = await S[3].locator('body').innerText(); assert(!secrets.some(s=>before.includes(s)),'gallery shows no submitted recipe before the test'); }

 // 4. Start the blind test.
 let confirmText='';teacher.once('dialog',d=>{confirmText=d.message();void d.accept();});
 await startButton.click();
 await teacher.locator('.gb-status.voting').waitFor();
 assert.match(confirmText,/3개 모둠/);
 const round = (await teacherSettings()).classes.find(c=>c.id===lesson.id).blindRound;
 assert.equal(round.status,'voting');assert.deepEqual(round.samples.map(x=>x.label),['A','B','C']);
 assert.deepEqual(round.samples.map(x=>x.projectId).sort(),[sub1.id,sub2.id,sub3.id].sort(),'one sample per submitted group');
 const groupOfLetter = Object.fromEntries(round.samples.map(s=>[s.label,[sub1,sub2,sub3].find(x=>x.id===s.projectId).notebook.comparisons[GROUP_KEY]|0]));
 const letterOfGroup = Object.fromEntries(Object.entries(groupOfLetter).map(([l,g])=>[g,l]));
 const recipeOfLetter = l => recipes.find(r=>r.group===groupOfLetter[l]);
 // Students can read the raw lesson JSON: it must not reveal a group.
 const raw = await studentLesson();
 assert.deepEqual(Object.keys(raw.blindRound).sort(),['id','samples','startedAt','status']);
 for(const s of raw.blindRound.samples) assert.deepEqual(Object.keys(s).sort(),['label','projectId'],'samples hold only label and projectId');
 assert(!/모둠|group/i.test(JSON.stringify(raw.blindRound)),'student blindRound JSON names no group');
 const sharedList = await (await anonymous.get('/api/students',{headers:{'x-class-code':code}})).text();
 assert(!sharedList.includes(GROUP_KEY)&&!sharedList.includes('__vote')&&![sub1,sub2,sub3].some(x=>sharedList.includes(x.id)),'student listing cannot be joined to groups or samples');
 // Letter cards: cooking recipe visible, product name / tagline / group hidden.
 const cards = teacher.locator('.gb-cards .gb-card');
 assert.equal(await cards.count(),3);
 for(const l of ['A','B','C']){
  const text = await teacher.locator(`.gb-cards .gb-card[aria-label="레시피 ${l}"]`).innerText();
  const r = recipeOfLetter(l);
  for(const [name,grams] of r.items){assert(text.includes(name),`card ${l} lists ${name}`);assert(text.includes(`${Number(grams)}g`),`card ${l} shows ${grams}g`);}
  assert(text.includes('물 110ml')&&text.includes('면 0.25개')&&text.includes('조리 3분'),`card ${l} shows water/noodle/minutes`);
  assert(text.includes('맛보기 전에 확인해요'),`card ${l} shows the allergen notice`);
  assert(!/\d+\s*모둠/.test(text),`card ${l} must not show a group`);
 }
 assert.equal(await teacher.locator('.gb-reveal').count(),0);
 panelText = await teacher.locator('.gb-panel').innerText();
 for(const s of secrets) assert(!panelText.includes(s),`"${s}" must stay hidden while voting`);
 assert(!GROUP_NEAR_LETTER.test(panelText),'teacher panel shows no group next to a letter');
 assert.equal(await teacher.locator('.gb-results').count(),0,'results are hidden by default while voting');
 await noOverflow(teacher,'teacher voting');await shot(teacher,'04-teacher-voting-cards');
 // Fullscreen presentation of the blind cards.
 await teacher.getByRole('button',{name:'크게 보기 (전체 화면)',exact:true}).click();
 const dialog = teacher.getByRole('dialog');await dialog.waitFor();
 assert.match(await dialog.innerText(),/레시피 A[\s\S]*1 \/ 3/);
 await teacher.keyboard.press('ArrowRight');await teacher.waitForFunction(()=>/2 \/ 3/.test(document.querySelector('.gb-present')?.innerText??''));
 const slide = await dialog.innerText();assert.match(slide,/레시피 B/);
 assert(!/\d+\s*모둠/.test(slide)&&!secrets.some(s=>slide.includes(s)),'fullscreen card stays blind');
 await shot(teacher,'05-teacher-fullscreen-blind',false);
 await teacher.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});

 // 5. Students get the vote within one settings poll.
 for(const p of S) await p.locator('.gb-vote-banner').waitFor({timeout:POLL});
 assert.equal(await nav(S[3],'블라인드 투표').count(),1);
 await noOverflow(S[3],'vote banner');await shot(S[3],'06-student-vote-banner');
 // Friends' recipes are hidden during the test.
 await nav(S[3],'친구 레시피').click();
 await S[3].getByText('블라인드 테스트 중이에요',{exact:true}).waitFor();
 assert.equal(await S[3].locator('.class-recipes article').count(),0);
 const hiddenText = await S[3].locator('body').innerText();assert(!secrets.some(s=>hiddenText.includes(s)),'gallery hides recipes while voting');
 await shot(S[3],'07-student-gallery-hidden');
 // A submitter whose recipe is a sample cannot cancel or change it, nor switch group.
 await nav(S[0],'모둠 베스트 제출').click();
 await S[0].locator('.gb-sub-lock').waitFor();
 assert.equal(await S[0].getByRole('button',{name:'제출 취소',exact:true}).count(),0,'cancel is hidden during voting');
 assert(await S[0].getByRole('button',{name:'다시 제출하기',exact:true}).isDisabled(),'re-submit is disabled during voting');
 assert(await S[0].getByLabel('라면 이름',{exact:true}).isDisabled(),'fields are locked during voting');
 let alertText='';S[0].once('dialog',d=>{alertText=d.message();void d.accept();});
 await S[0].getByRole('button',{name:'모둠 바꾸기',exact:true}).click();
 await S[0].waitForTimeout(300);assert.match(alertText,/바꿀 수 없어요/);
 assert.equal(await S[0].getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?'}).count(),0);
 await shot(S[0],'08-student-submission-locked');

 // 6. Votes. S5 first picks its own sample, then changes its mind.
 const L1=letterOfGroup[1],L2=letterOfGroup[2],L3=letterOfGroup[3];
 const plan = [L1,L3,L1,L1,L3]; // S1(1)->own, S2(2)->3, S3(3)->1, S4(1)->own, S5(2)->3 after trying own
 async function vote(p,label,group){
  if(!(await p.locator('.gb-ballot').count())) await nav(p,'블라인드 투표').click();
  await p.locator('.gb-ballot-grid').waitFor();
  assert.deepEqual(await p.locator('.gb-ballot-grid button').evaluateAll(b=>b.map(x=>x.getAttribute('aria-label'))),['레시피 A','레시피 B','레시피 C']);
  await p.getByRole('button',{name:`레시피 ${label}`,exact:true}).click();
  await p.waitForFunction(l=>document.querySelector('.gb-ballot-mine')?.textContent===`내 선택: ${l} · 마감 전까지 바꿀 수 있어요`,label);
  assert.equal(await p.locator('.gb-ballot-grid button[aria-pressed="true"]').getAttribute('aria-label'),`레시피 ${label}`);
  const ballot = await p.locator('.gb-ballot').innerText();
  assert(!/\d+\s*모둠/.test(ballot),'vote page shows no group number');
  assert(!/모둠|우리/.test(await p.locator('.gb-ballot-grid').innerText()),'letters carry no group hint');
  const body = await p.locator('body').innerText();
  assert(!GROUP_NEAR_LETTER.test(body),'no group next to a letter anywhere on the student screen');
  for(const [,g] of body.matchAll(/(?<!\d)(\d{1,2})\s*모둠/g)) assert.equal(Number(g),group,'only the student\'s own group appears');
  await serverProject(p,x=>x.notebook?.comparisons?.[voteKey(round.id)]===label,`vote ${label}`);
 }
 await vote(S[4],L2,2);await noOverflow(S[4],'vote page');await shot(S[4],'09-student-vote-own-first');
 for(let i=0;i<5;i++) await vote(S[i],plan[i],groupOfStudent[i]);
 await shot(S[4],'10-student-vote-changed');

 // 7. Teacher: participation, preview toggle, close, tally.
 await teacher.waitForFunction(()=>document.querySelector('.gb-hero')?.textContent==='5명 투표',null,{timeout:POLL});
 await shot(teacher,'11-teacher-participation');
 const projectsNow = await teacherProjects(lesson.id);
 assert.deepEqual(studentIds.map(id=>projectsNow.find(x=>x.id===id)?.notebook.comparisons[voteKey(round.id)]),plan,'server stores each device\'s final vote');
 // Expected tally with the documented semantics: a vote is "own" when the voter's group made that sample.
 function expected(exclude){const rows=['A','B','C'].map(l=>{const v=plan.map((x,i)=>x===l?groupOfStudent[i]:0).filter(Boolean);const own=v.filter(g=>g===groupOfLetter[l]).length;return {label:l,n:exclude?v.length-own:v.length,own};});const total=rows.reduce((s,r)=>s+r.n,0),top=Math.max(...rows.map(r=>r.n));return {rows,total,own:rows.reduce((s,r)=>s+r.own,0),winners:rows.filter(r=>r.n===top&&top>0).map(r=>r.label),top};}
 for(const exclude of [true,false]){const lib=tallyVotes(projectsNow,round,exclude),exp=expected(exclude);assert.equal(lib.voters,5);assert.deepEqual(lib.rows.map(r=>lib.counted(r)),exp.rows.map(r=>r.n),'tallyVotes agrees with the expected own-group rule');assert.deepEqual(lib.winners,exp.winners);}
 assert.notDeepEqual(expected(true).winners,expected(false).winners,'scenario distinguishes the two counting modes');
 const preview = teacher.getByRole('button',{name:'결과 미리 보기',exact:true});
 assert.equal(await preview.getAttribute('aria-pressed'),'false');
 await preview.click();await teacher.locator('.gb-results').waitFor();
 await shot(teacher,'12-teacher-preview');
 await preview.click();await teacher.locator('.gb-results').waitFor({state:'hidden'});
 // A change saved elsewhere (another teacher device) must survive the next vote button: commits reload first.
 const renamed = `${lesson.name} 수정`;
 { const s = await teacherSettings(); s.classes.find(c=>c.id===lesson.id).name = renamed; await putSettings(s); }
 teacher.once('dialog',d=>void d.accept());
 await teacher.getByRole('button',{name:'투표 마감',exact:true}).click();
 await teacher.locator('.gb-status.closed').waitFor();
 assert.equal((await studentLesson()).blindRound.status,'closed');
 const afterClose = (await teacherSettings()).classes.find(c=>c.id===lesson.id);
 assert.equal(afterClose.name,renamed,'closing the vote keeps a newer change saved elsewhere');
 assert.equal(afterClose.blindRound.id,round.id);
 async function checkTally(exclude){
  const exp = expected(exclude);
  const toggle = teacher.getByRole('button',{name:'자기 모둠 표 빼고 세기',exact:true});
  if((await toggle.getAttribute('aria-pressed'))!==String(exclude)) await toggle.click();
  await teacher.waitForFunction(t=>document.querySelector('.gb-results header p')?.textContent.includes(t),`반영한 표 ${exp.total}표`);
  const head = await teacher.locator('.gb-results header p').innerText();
  assert(head.includes(`자기 모둠 표 ${exp.own}표 ${exclude?'제외':'포함'}`),head);
  const bars = await teacher.locator('.gb-bars li').evaluateAll(li=>li.map(x=>({name:x.querySelector('.gb-bar-name').textContent,value:x.querySelector('.gb-bar-value').textContent,win:x.classList.contains('win')})));
  assert.deepEqual(bars.map(b=>b.name.slice(0,5)),['레시피 A','레시피 B','레시피 C']);
  for(const [i,r] of exp.rows.entries()){const pct=exp.total?Math.round(r.n/exp.total*100):0;assert(bars[i].value.startsWith(`${r.n}표 · ${pct}%`),`bar ${r.label}: ${bars[i].value} expected ${r.n}표 · ${pct}%`);assert.equal(bars[i].win,exp.winners.includes(r.label),`bar ${r.label} winner flag`);}
  const winner = await teacher.locator('.gb-winner').innerText();
  assert(winner.includes(`${exp.winners.length>1?'공동 1위':'1위'} · ${exp.winners.map(l=>'레시피 '+l).join(', ')}`)&&winner.includes(`(${exp.top}표)`),winner);
  return bars;
 }
 const toggleState = await teacher.getByRole('button',{name:'자기 모둠 표 빼고 세기',exact:true}).getAttribute('aria-pressed');
 assert.equal(toggleState,'true','own-group votes are excluded by default');
 let bars = await checkTally(true);
 assert(!bars.some(b=>/모둠/.test(b.name)),'no group labels on bars before reveal');
 panelText = await teacher.locator('.gb-panel').innerText();
 for(const s of secrets) assert(!panelText.includes(s),`"${s}" hidden after closing`);
 assert(!GROUP_NEAR_LETTER.test(panelText),'closed results show no group next to a letter');
 await shot(teacher,'13-teacher-closed-excluding-own');
 await checkTally(false);await shot(teacher,'14-teacher-closed-including-own');
 await checkTally(true);
 // Students: closed state with their choice and disabled buttons.
 if(!(await S[1].locator('.gb-ballot').count())) await nav(S[1],'블라인드 투표').click();
 await S[1].getByText('투표가 마감됐어요',{exact:true}).waitFor({timeout:POLL});
 assert.equal(await S[1].locator('.gb-ballot-mine').innerText(),`내 선택: ${plan[1]}`);
 assert(await S[1].locator('.gb-ballot-grid button').evaluateAll(b=>b.every(x=>x.disabled)),'ballot buttons are disabled after closing');
 assert.equal(await S[1].locator('.gb-vote-banner').count(),0);
 await shot(S[1],'15-student-vote-closed');
 await nav(S[3],'친구 레시피').click();
 await S[3].locator('.gb-vote-banner').waitFor({state:'detached',timeout:POLL});
 await S[3].getByText('블라인드 테스트 중이에요',{exact:true}).waitFor();
 assert.equal(await S[3].locator('.class-recipes article').count(),0,'gallery stays hidden while closed');

 // 8. Reveal groups.
 teacher.once('dialog',d=>void d.accept());
 await teacher.getByRole('button',{name:'모둠 공개',exact:true}).click();
 await teacher.locator('.gb-status.revealed').waitFor();
 for(const l of ['A','B','C']){
  const card = teacher.locator(`.gb-cards .gb-card[aria-label="레시피 ${l}"]`);const r = recipeOfLetter(l);
  assert.equal(await card.locator('.gb-reveal b').innerText(),groupLabel(r.group),`card ${l} reveals its group`);
  assert.equal(await card.locator('.gb-reveal strong').innerText(),r.name);assert.equal(await card.locator('.gb-reveal p').innerText(),r.line);
 }
 const winExcluded = expected(true).winners;
 assert.deepEqual(await teacher.locator('.gb-cards .gb-card.win').evaluateAll(c=>c.map(x=>x.getAttribute('aria-label'))),winExcluded.map(l=>'레시피 '+l),'winner card highlighted');
 bars = await checkTally(true);
 for(const [i,l] of ['A','B','C'].entries()) assert(bars[i].name.endsWith(groupLabel(groupOfLetter[l])),`bar ${l} shows its group after reveal`);
 const winnerText = await teacher.locator('.gb-winner').innerText();
 assert(winExcluded.every(l=>winnerText.includes(`레시피 ${l} · ${groupLabel(groupOfLetter[l])} 「${recipeOfLetter(l).name}」`)),winnerText);
 await noOverflow(teacher,'teacher revealed');await shot(teacher,'16-teacher-revealed');
 await teacher.getByRole('button',{name:'크게 보기 (전체 화면)',exact:true}).click();await teacher.getByRole('dialog').waitFor();
 assert(/\d모둠/.test(await teacher.getByRole('dialog').innerText()),'fullscreen shows the group after reveal');
 await shot(teacher,'17-teacher-fullscreen-revealed',false);await teacher.keyboard.press('Escape');await teacher.getByRole('dialog').waitFor({state:'hidden'});
 // Students after reveal: notice on the vote page, gallery back, submission unlocked.
 await S[1].getByText('투표가 끝났어요 · 선생님 화면에서 결과를 확인해요',{exact:true}).waitFor({timeout:POLL});
 assert(!GROUP_NEAR_LETTER.test(await S[1].locator('body').innerText()),'students still see no group next to a letter after reveal');
 await shot(S[1],'18-student-revealed');
 await nav(S[3],'레시피 기록').click();await nav(S[3],'친구 레시피').click();
 await S[3].locator('.class-recipes article').nth(2).waitFor({timeout:POLL});
 assert.equal(await S[3].locator('.class-recipes article').count(),3);
 await shot(S[3],'19-student-gallery-after');
 // The revealed sample stays fixed until the round is reset, so the projected result cannot change.
 await nav(S[0],'레시피 기록').click();await nav(S[0],'모둠 베스트 제출').click();
 await S[0].locator('.gb-sub-lock').getByText(/투표를 초기화하면 다시 고칠 수 있어요/).waitFor({timeout:POLL});
 assert.equal(await S[0].getByRole('button',{name:'제출 취소',exact:true}).count(),0,'cancel stays hidden after reveal');

 // 9. "학생 레시피 보기" is also projected: it never shows group numbers.
 await teacher.locator('.teacher-sidebar').getByRole('button',{name:'학생 레시피 보기',exact:true}).click();
 await teacher.locator('.student-recipe-list button').nth(4).waitFor({timeout:POLL});
 assert(!/\d+\s*모둠/.test(await teacher.locator('.teacher-panel').innerText()),'student recipe list shows no group');
 await teacher.locator('.student-recipe-list button').first().click();await teacher.getByRole('dialog').waitFor();
 assert(!/\d+\s*모둠/.test(await teacher.getByRole('dialog').innerText()),'student recipe fullscreen shows no group');
 await shot(teacher,'20-teacher-student-recipes',false);
 await teacher.keyboard.press('Escape');await teacher.getByRole('dialog').waitFor({state:'hidden'});

 // 10. Reset while the class settings have unsaved edits: both are saved together, the round disappears for everyone.
 await teacher.locator('.teacher-sidebar').getByRole('button',{name:'수업·반 설정',exact:true}).click();
 const groupInput = teacher.getByLabel(/^모둠 수/);
 assert.equal(await groupInput.inputValue(),'4');
 await groupInput.fill('5');await groupInput.blur();
 await teacher.locator('.save-area i').waitFor();
 await teacher.locator('.teacher-sidebar').getByRole('button',{name:'모둠 베스트·블라인드 투표',exact:true}).click();
 await teacher.locator('.gb-status.revealed').waitFor();
 teacher.once('dialog',d=>void d.accept());
 await teacher.getByRole('button',{name:'투표 초기화 · 새로 시작',exact:true}).click();
 await startButton.waitFor();assert.equal(await teacher.locator('.gb-status').count(),0);
 await teacher.locator('.teacher-toast').filter({hasText:'저장하지 않았던 설정도 함께 저장했어요'}).waitFor();
 assert.equal(await teacher.locator('.save-area i').count(),0,'unsaved marker cleared');
 const afterReset = (await teacherSettings()).classes.find(c=>c.id===lesson.id);
 assert.equal(afterReset.groupCount,5);assert.equal(afterReset.blindRound,undefined);assert.equal(afterReset.name,renamed);
 assert.equal((await studentLesson()).blindRound,undefined,'reset removes the round for students');
 await nav(S[2],'블라인드 투표').waitFor({state:'detached',timeout:POLL});
 // After the reset the sample unlocks; cancelling a submission updates the teacher's chips.
 await S[0].getByRole('button',{name:'제출 취소',exact:true}).waitFor({timeout:POLL});
 S[0].once('dialog',d=>void d.accept());
 await S[0].getByRole('button',{name:'제출 취소',exact:true}).click();
 await S[0].locator('.gb-sub-status').getByText('미제출',{exact:true}).waitFor();
 await serverProject(S[0],x=>x.notebook?.final?.shared===false,'cancelled submission');
 await teacher.waitForFunction(()=>document.querySelector('.gb-count')?.textContent==='2 / 5 모둠 제출',null,{timeout:POLL});
 assert.equal(await teacher.locator('.gb-chips li').count(),5);
 assert.equal(await teacher.locator('.gb-chips li').first().textContent(),'1모둠미제출');
 await shot(teacher,'21-teacher-after-reset');
 // 모둠 바꾸기: the picker offers 취소, and a new choice is saved.
 await S[4].getByRole('button',{name:'모둠 바꾸기',exact:true}).click();
 await S[4].getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?',exact:true}).waitFor();
 assert.equal(await S[4].locator('.gb-pick-grid button[aria-pressed="true"]').getAttribute('aria-label'),'2모둠');
 await S[4].getByRole('button',{name:'취소',exact:true}).click();
 assert.equal(await S[4].locator('.gb-mygroup').textContent(),'2모둠');
 await S[4].getByRole('button',{name:'모둠 바꾸기',exact:true}).click();
 await S[4].getByRole('button',{name:'3모둠',exact:true}).click();
 assert.equal(await S[4].locator('.gb-mygroup').textContent(),'3모둠');
 await serverProject(S[4],x=>x.notebook?.comparisons?.[GROUP_KEY]==='3','changed group');
 // A new student on the same device must pick a group again; a later 2모둠 submission becomes the group's newest.
 S[3].once('dialog',d=>void d.accept());
 await S[3].getByRole('button',{name:'다른 학생 시작',exact:true}).click();
 await S[3].getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?',exact:true}).waitFor();
 assert.equal(await S[3].getByRole('button',{name:'취소',exact:true}).count(),0,'a fresh record has no cancel on the picker');
 assert.equal(await S[3].locator('.gb-pick-grid button').count(),5,'picker follows the new 모둠 수');
 await shot(S[3],'22-student-new-student-picker');
 await S[3].getByRole('button',{name:'2모둠',exact:true}).click();
 assert.equal(await S[3].locator('.gb-mygroup').textContent(),'2모둠');
 assert.notEqual((await local(S[3])).project.id,studentIds[3]);
 const late = { group:2, items:[[ingredients[0],'2'],[ingredients[5],'0.5']], note:'노트넷 나중', name:'새벽국물 라면', line:'비밀소개넷 나중에 낸 레시피', spicy:'3' };
 const sub4 = await submitBest(S[3],late);
 await teacher.waitForFunction(()=>[...document.querySelectorAll('.gb-notes li')].some(li=>li.textContent.includes('2모둠은 여러 기기에서 제출했어요')),null,{timeout:POLL});
 assert.equal(await teacher.locator('.gb-count').textContent(),'2 / 5 모둠 제출');
 // A fresh round gets a new id, uses the newest 2모둠 submission and starts with no votes.
 teacher.once('dialog',d=>void d.accept());
 await startButton.click();await teacher.locator('.gb-status.voting').waitFor();
 const round2 = (await teacherSettings()).classes.find(c=>c.id===lesson.id).blindRound;
 assert.notEqual(round2.id,round.id,'a reset round gets a new id');
 assert.deepEqual(round2.samples.map(x=>x.projectId).sort(),[sub4.id,sub3.id].sort(),'the newest submission of a group is used');
 assert.equal(await teacher.locator('.gb-hero').textContent(),'0명 투표','old votes do not carry over');
 const cardsText = await teacher.locator('.gb-cards').innerText();
 assert(![late.name,late.line,...secrets].some(x=>cardsText.includes(x))&&!/\d+\s*모둠/.test(cardsText),'second round cards stay blind');
 await shot(teacher,'23-teacher-second-round');
 teacher.once('dialog',d=>void d.accept());
 await teacher.getByRole('button',{name:'투표 초기화 · 새로 시작',exact:true}).click();await startButton.waitFor();
 // Records without a class cannot run a vote.
 await teacher.getByLabel('수업 선택',{exact:true}).selectOption('legacy');
 await teacher.locator('.gb-empty').waitFor();
 assert.match(await teacher.locator('.gb-empty').innerText(),/반을 골라/);
 await shot(teacher,'24-teacher-legacy');

 for(const p of [teacher,...S]) await p.evaluate(()=>document.fonts.ready);
 assert.deepEqual(errors,[],'Browser errors');
 fs.writeFileSync(path.join(out,'group-vote-results.json'),JSON.stringify({status:'PASS',classCode:code,roundId:round.id,groupOfLetter,votes:plan,screenshots:fs.readdirSync(out).filter(x=>/^e2e-.*\.png$/.test(x))},null,2));
 console.log(`PASS: group best + blind vote (class ${code}, letters ${JSON.stringify(groupOfLetter)}); screenshots in ${out}`);
 await browser.close();await api.dispose();await anonymous.dispose();
})().catch(async e=>{if(debugPage){await debugPage.screenshot({path:path.join(out,'e2e-failure.png'),fullPage:true}).catch(()=>{});console.error((await debugPage.locator('body').innerText().catch(()=>'')).slice(-2200));}console.error(e);process.exit(1);});
