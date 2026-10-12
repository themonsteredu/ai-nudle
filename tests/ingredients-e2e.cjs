/* 스프·첨가물 관리 + 시판 스프 관리 end-to-end checks against a LOCAL Vite/Cloudflare D1 server only.
   PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome TEST_ORIGIN=http://localhost:5211 node tests/ingredients-e2e.cjs
   Optional SCREENSHOT_DIR (default outputs/verification/ingredients).
   Writes a new test classroom to local D1 and edits the (global) ingredient + commercial soup lists through the
   teacher UI; the original lists are put back at the end so the other e2e scripts keep their fixtures.
   Never run against production. */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test script run directly by node */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Use a local test database');
const out = path.resolve(process.env.SCREENSHOT_DIR || 'outputs/verification/ingredients');fs.mkdirSync(out,{recursive:true});
const POLL = 30000; // students re-read settings every 12s
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PRODUCT_NAMES = ['오뚜기','짬뽕','진라면'];
const NEW_SOUP = '진라면 매운맛 스프';
let debugPage = null;
const warnings = [];
const soft = (ok,message) => { if(!ok){warnings.push(message);console.warn('WARN:',message);} };

(async()=>{
 const api = await request.newContext({baseURL:origin});
 assert.equal((await api.post('/api/teacher/login',{data:{password:'3035'}})).status(),200);
 async function putSettings(settings){for(let i=0;;i++){const r=await api.put('/api/settings',{data:{settings}});if(r.status()===200)return (await r.json()).settings;if(i>=5||r.status()!==500)assert.fail(`PUT /api/settings ${r.status()} ${await r.text()}`);await sleep(600);}}
 const teacherSettings = async () => (await (await api.get('/api/settings')).json()).settings;
 const original = await teacherSettings();
 const restore = async () => { const now = await teacherSettings(); await putSettings({...now,ingredients:original.ingredients,comparisonSoups:original.comparisonSoups}); };
 // The scenario needs the default fixtures (후추, 설탕, three default soups) to start from.
 for(const id of ['pepper','sugar','curry']) assert(original.ingredients.some(x=>x.id===id),`fixture ingredient ${id} missing`);
 assert.deepEqual(original.comparisonSoups.map(x=>x.id),['soup-a','soup-b','soup-c'],'fixture soups');
 // Start from a known state: 후추·설탕 visible so hiding/deleting them is observable.
 await putSettings({...original,ingredients:original.ingredients.map(x=>['pepper','sugar'].includes(x.id)?{...x,enabled:true}:x)});

 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 const errors = [];
 const shot = (p,name,full=true) => p.screenshot({path:path.join(out,`ing-${name}.png`),fullPage:full});
 const noOverflow = async (p,label) => { const r = await p.evaluate(()=>({sw:document.documentElement.scrollWidth,w:window.innerWidth,wide:[...document.querySelectorAll('.teacher-main *, .student-main *')].filter(e=>{const b=e.getBoundingClientRect();return b.width>0&&b.right>window.innerWidth+1;}).slice(0,5).map(e=>e.tagName+'.'+e.className+' right='+Math.round(e.getBoundingClientRect().right))})); assert(r.sw<=r.w+1,`${label} horizontal overflow: scrollWidth ${r.sw} > ${r.w}; ${r.wide.join(', ')}`); };
 try {
 // 1. A fresh class.
 const settings = await teacherSettings();
 const used = new Set(settings.classes.map(c=>c.code));
 let code; do code = String(100000 + Math.floor(Math.random()*900000)); while (used.has(code));
 const lesson = { id:crypto.randomUUID(), name:`재료 검증반 ${code}`, code, waterMl:110, cookMinutes:3, noodleFraction:.25, groupCount:4 };
 settings.classes.push(lesson);
 await putSettings(settings);
 const anonymous = await request.newContext({baseURL:origin});

 // ---- Teacher: 스프·첨가물 관리 (1366x900) ----
 const teacherContext = await browser.newContext({storageState:await api.storageState(),viewport:{width:1366,height:900}});
 const teacher = await teacherContext.newPage();teacher.on('pageerror',e=>errors.push('teacher: '+e.message));debugPage = teacher;
 const navTo = async (p,name) => { await p.locator('.teacher-sidebar').getByRole('button',{name,exact:true}).click(); };
 const openTeacher = async p => { await p.goto(origin+'/teacher');await p.waitForLoadState('networkidle');await p.locator('.teacher-sidebar').waitFor(); };
 const ingRow = (p,name) => p.locator('article.ing-row').filter({has:p.getByRole('button',{name:`${name} 위로`,exact:true})});
 const sections = p => p.locator('.ing-section').evaluateAll(secs=>secs.map(s=>({title:s.querySelector('h2').firstChild.textContent.trim(),rows:[...s.querySelectorAll('article.ing-row')].map(r=>({name:r.querySelector('.ing-name input').value,kind:r.querySelector('.ing-kind select').value,on:r.querySelector('.switch-label input').checked}))})));
 const soupRows = p => p.locator('article.soup-row').evaluateAll(rows=>rows.map(r=>({letter:r.querySelector('.soup-letter').textContent,name:r.querySelector('.ing-name input').value,on:r.querySelector('.switch-label input').checked})));
 async function saveTeacher(p){
  await p.locator('.save-area').getByText('저장하지 않은 변경',{exact:true}).waitFor();
  await p.locator('.save-area').getByRole('button',{name:'설정 저장',exact:true}).click();
  await p.getByText('교사 설정을 저장했습니다. 학생 화면에도 반영됩니다.',{exact:true}).waitFor();
  assert.equal(await p.locator('.save-area').getByText('저장하지 않은 변경',{exact:true}).count(),0,'dirty flag cleared after save');
 }

 await openTeacher(teacher);
 await navTo(teacher,'스프·첨가물 관리');
 await teacher.getByRole('heading',{name:'스프·첨가물 관리',exact:true}).waitFor();
 let before = await sections(teacher);
 assert.deepEqual(before.map(s=>s.title),['기본 스프','첨가물']);
 assert.deepEqual(before[0].rows.map(r=>r.name),['쇠고기 조미분말','멸치 조미분말','사골분말']);
 assert(before[0].rows.every(r=>r.kind==='BASE'));
 assert(before[1].rows.some(r=>r.name==='후추')&&before[1].rows.some(r=>r.name==='설탕'));
 const addForm = teacher.locator('form.ing-add');
 assert(await addForm.getByRole('button',{name:'＋ 추가',exact:true}).isDisabled(),'add is disabled with an empty name');
 await addForm.locator('input').fill('   ');
 assert(await addForm.getByRole('button',{name:'＋ 추가',exact:true}).isDisabled(),'add is disabled with a blank name');
 // Add 다시마분말 as 기본 스프.
 await addForm.locator('input').fill('다시마분말');
 await addForm.locator('select').selectOption({label:'기본 스프'});
 await addForm.getByRole('button',{name:'＋ 추가',exact:true}).click();
 await teacher.getByText(/^추가했어요\./).waitFor();
 assert.equal(await addForm.locator('input').inputValue(),'','name box is cleared after adding');
 // Add 간장분말 as 짠맛 (press Enter to submit, like a teacher typing).
 await addForm.locator('input').fill('간장분말');
 await addForm.locator('select').selectOption('짠맛');
 await addForm.locator('input').press('Enter');
 await ingRow(teacher,'간장분말').waitFor();
 // A name that already exists is not added twice.
 await addForm.locator('input').fill(' 마늘분말 ');
 await addForm.getByRole('button',{name:'＋ 추가',exact:true}).click();
 assert.match(await teacher.locator('.ing-error').innerText(),/'마늘분말'은\(는\) 이미 첨가물 목록에 있어요/);
 assert.equal(await teacher.getByRole('button',{name:'마늘분말 위로',exact:true}).count(),1,'no duplicate row');
 await addForm.locator('input').fill('');
 let now = await sections(teacher);
 assert.deepEqual(now[0].rows.map(r=>r.name),['쇠고기 조미분말','멸치 조미분말','사골분말','다시마분말'],'다시마분말 lands in 기본 스프');
 assert.equal(now[1].rows.at(-1).name,'간장분말');assert.equal(now[1].rows.at(-1).kind,'짠맛');
 assert(await ingRow(teacher,'간장분말').evaluate(e=>e.classList.contains('new')),'the newly added row is highlighted');
 // Delete 후추 (confirm).
 let dialogText='';teacher.once('dialog',d=>{dialogText=d.message();void d.accept();});
 await ingRow(teacher,'후추').getByRole('button',{name:'삭제',exact:true}).click();
 await ingRow(teacher,'후추').waitFor({state:'detached'});
 assert.match(dialogText,/'후추'/);assert.match(dialogText,/이미 저장한 학생 레시피는 그대로 남아요/);
 // Dismissing the confirm keeps the row.
 teacher.once('dialog',d=>{void d.dismiss();});
 await ingRow(teacher,'설탕').getByRole('button',{name:'삭제',exact:true}).click();
 assert.equal(await ingRow(teacher,'설탕').count(),1,'cancelled delete keeps the row');
 // Hide 설탕.
 await ingRow(teacher,'설탕').locator('.switch-label').click();
 assert.equal(await ingRow(teacher,'설탕').locator('.switch-label input').isChecked(),false);
 assert.match(await ingRow(teacher,'설탕').locator('.ing-status').innerText(),/학생 화면에서 숨김/);
 // Move 간장분말 up within 첨가물; the ↑ of the first row in each section is disabled.
 await ingRow(teacher,'간장분말').getByRole('button',{name:'간장분말 위로',exact:true}).click();
 assert(await teacher.getByRole('button',{name:'쇠고기 조미분말 위로',exact:true}).isDisabled());
 assert(await teacher.getByRole('button',{name:'다시마분말 아래로',exact:true}).isDisabled(),'last base soup cannot move into 첨가물');
 now = await sections(teacher);
 const expectedBase = ['쇠고기 조미분말','멸치 조미분말','사골분말','다시마분말'];
 const expectedAdditives = before[1].rows.map(r=>r.name).filter(n=>n!=='후추');
 expectedAdditives.splice(expectedAdditives.length-1,0,'간장분말');
 assert.deepEqual(now[0].rows.map(r=>r.name),expectedBase);
 assert.deepEqual(now[1].rows.map(r=>r.name),expectedAdditives,'간장분말 moved above the last additive');
 // 자세히 opens the full editor (photo, 재료명, amounts, allergy).
 await ingRow(teacher,'간장분말').getByRole('button',{name:'자세히',exact:true}).click();
 await ingRow(teacher,'간장분말').locator('.ing-detail').waitFor();
 assert.equal(await ingRow(teacher,'간장분말').locator('.ing-detail label.admin-field').filter({hasText:'재료명'}).locator('input').inputValue(),'간장분말');
 await shot(teacher,'01-teacher-ingredients-edited');
 await ingRow(teacher,'간장분말').getByRole('button',{name:'접기',exact:true}).click();
 await saveTeacher(teacher);
 // Server copy (normalizeSettings must not bring 후추 back).
 let server = await teacherSettings();
 assert(!server.ingredients.some(x=>x.id==='pepper'||x.name==='후추'),'후추 stays deleted on the server');
 assert.equal(server.ingredients.find(x=>x.id==='sugar').enabled,false);
 const dashima = server.ingredients.find(x=>x.name==='다시마분말'), soy = server.ingredients.find(x=>x.name==='간장분말');
 assert(dashima&&soy);assert.equal(dashima.category,'BASE');assert.equal(soy.category,'짠맛');assert.equal(dashima.displayName,'다시마분말');
 assert.equal(soy.allergenChecked,false);assert.deepEqual(soy.allergens,[]);
 // Reload: everything persisted.
 await teacher.reload();await teacher.waitForLoadState('networkidle');
 await navTo(teacher,'스프·첨가물 관리');
 await ingRow(teacher,'간장분말').waitFor();
 const reloaded = await sections(teacher);
 assert.deepEqual(reloaded[0].rows.map(r=>r.name),expectedBase,'base order after reload');
 assert.deepEqual(reloaded[1].rows.map(r=>r.name),expectedAdditives,'additive order after reload');
 assert.equal(reloaded[1].rows.find(r=>r.name==='설탕').on,false,'설탕 stays hidden after reload');
 assert.equal(await ingRow(teacher,'후추').count(),0,'후추 did not come back after reload');
 // A second save round-trip (e.g. after an unrelated edit) must not bring 후추 back either.
 server = await putSettings(await teacherSettings());
 assert(!server.ingredients.some(x=>x.id==='pepper'),'후추 stays deleted after another save');
 await shot(teacher,'02-teacher-ingredients-reloaded');

 // ---- Teacher: 시판 스프 관리 ----
 await navTo(teacher,'시판 스프 관리');
 await teacher.getByRole('heading',{name:'시판 스프 관리',exact:true}).waitFor();
 let soups = await soupRows(teacher);
 assert.deepEqual(soups,[{letter:'A',name:'오뚜기 쇠고기 스프',on:true},{letter:'B',name:'짬뽕 스프',on:true},{letter:'C',name:'',on:false}]);
 const soupForm = teacher.locator('form.ing-add');
 // The empty, unused 스프 C slot is filled first, so students never see A, B, D.
 assert(await soupForm.getByRole('button',{name:'＋ 스프 C로 추가',exact:true}).isDisabled(),'add soup disabled while empty');
 await soupForm.locator('input').fill(NEW_SOUP);
 await soupForm.getByRole('button',{name:'＋ 스프 C로 추가',exact:true}).click();
 await soupForm.getByRole('button',{name:'＋ 스프 D로 추가',exact:true}).waitFor();
 soups = await soupRows(teacher);
 assert.deepEqual(soups,[{letter:'A',name:'오뚜기 쇠고기 스프',on:true},{letter:'B',name:'짬뽕 스프',on:true},{letter:'C',name:NEW_SOUP,on:true}],'new soup fills the empty C slot, enabled');
 // Disable then enable again.
 const newRow = teacher.locator('article.soup-row').nth(2);
 await newRow.locator('.switch-label').click();
 assert.equal((await soupRows(teacher))[2].on,false);assert.match(await newRow.locator('.ing-status').innerText(),/학생 화면에서 숨김/);
 assert.match(await teacher.locator('.ing-section h2 small').innerText(),/3개 · 사용 2개/);
 await newRow.locator('.switch-label').click();
 assert.equal((await soupRows(teacher))[2].on,true);
 assert.match(await teacher.locator('.ing-section h2 small').innerText(),/3개 · 사용 3개/);
 // 알레르기 확인 opens the allergen editor.
 await newRow.getByRole('button',{name:'알레르기 확인',exact:true}).click();
 await newRow.locator('.ing-detail').waitFor();
 await newRow.getByRole('button',{name:'접기',exact:true}).click();
 // The last soup is really deleted (after a confirm that warns about reusing its letter).
 await soupForm.locator('input').fill('임시 스프');
 await soupForm.getByRole('button',{name:'＋ 스프 D로 추가',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelectorAll('article.soup-row').length===4);
 dialogText='';teacher.once('dialog',d=>{dialogText=d.message();void d.accept();});
 await teacher.locator('article.soup-row').nth(3).getByRole('button',{name:'삭제',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelectorAll('article.soup-row').length===3);
 assert.match(dialogText,/스프 D '임시 스프'을\(를\) 삭제할까요\?/);assert.match(dialogText,/모든 반/);
 // 삭제 on a middle soup (B 짬뽕 스프) only turns it off, so later letters never shift away from saved records.
 dialogText='';teacher.once('dialog',d=>{dialogText=d.message();void d.accept();});
 await teacher.locator('article.soup-row').nth(1).getByRole('button',{name:'삭제',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelectorAll('article.soup-row')[1]?.classList.contains('off'));
 assert.match(dialogText,/스프 B '짬뽕 스프'은\(는\) 삭제하는 대신 '사용'을 끌게요/);
 soups = await soupRows(teacher);
 assert.deepEqual(soups,[{letter:'A',name:'오뚜기 쇠고기 스프',on:true},{letter:'B',name:'짬뽕 스프',on:false},{letter:'C',name:NEW_SOUP,on:true}]);
 // Pressing 삭제 again on the turned-off middle soup only explains; the slot stays.
 dialogText='';teacher.once('dialog',d=>{dialogText=d.message();void d.accept();});
 await teacher.locator('article.soup-row').nth(1).getByRole('button',{name:'삭제',exact:true}).click();
 await teacher.waitForFunction(()=>document.querySelectorAll('article.soup-row').length===3);
 assert.match(dialogText,/이미 꺼져 있어서/);
 assert.deepEqual(await soupRows(teacher),soups,'turned-off middle soup keeps its letter');
 await shot(teacher,'03-teacher-soups-edited');
 await saveTeacher(teacher);
 server = await teacherSettings();
 assert.deepEqual(server.comparisonSoups.map(x=>[x.name,x.enabled]),[['오뚜기 쇠고기 스프',true],['짬뽕 스프',false],[NEW_SOUP,true]]);
 assert.deepEqual(server.comparisonSoups.slice(0,2).map(x=>x.id),['soup-a','soup-b'],'soup ids keep their slots');
 await teacher.reload();await teacher.waitForLoadState('networkidle');
 await navTo(teacher,'시판 스프 관리');
 await teacher.locator('article.soup-row').nth(2).waitFor();
 assert.deepEqual(await soupRows(teacher),soups,'soup order/letters after reload');
 assert.equal(await teacher.getByRole('button',{name:'＋ 스프 D로 추가',exact:true}).count(),1);
 // 수업·반 설정 now points to 시판 스프 관리.
 await navTo(teacher,'수업·반 설정');
 assert.match(await teacher.locator('.teacher-panel').innerText(),/시판 스프 관리.*지금 사용 중: 2개/s);

 // ---- Student (390x844) ----
 const studentSettingsJson = await (await anonymous.get('/api/settings?code='+code)).text();
 for(const n of PRODUCT_NAMES) assert(!studentSettingsJson.includes(n),`GET /api/settings?code= leaks "${n}"`);
 const studentSoups = JSON.parse(studentSettingsJson).settings.comparisonSoups;
 assert.deepEqual(studentSoups.map(x=>x.name),['스프 A','스프 B','스프 C']);
 const sc = await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const student = await sc.newPage();student.on('pageerror',e=>errors.push('student: '+e.message));debugPage = student;
 const local = () => student.evaluate(id=>{const pid=localStorage.getItem('ramen-active:'+id);return JSON.parse(localStorage.getItem('ramen-notebook:'+pid));},lesson.id);
 async function serverProject(check,label){const s=await local();const deadline=Date.now()+POLL;for(;;){const r=await anonymous.get('/api/students?id='+s.project.id,{headers:{'x-class-code':code,'x-student-key':s.key}});const project=r.status()===200?(await r.json()).project:null;if(project&&check(project))return project;if(Date.now()>deadline)assert.fail(`server record never matched: ${label}`);await sleep(500);}}
 await student.goto(origin);await student.waitForLoadState('networkidle');
 await student.getByLabel('수업 코드',{exact:true}).fill(code);await student.getByRole('button',{name:'기록 시작하기',exact:true}).click();
 await student.getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?',exact:true}).waitFor();
 await student.getByRole('button',{name:'1모둠',exact:true}).click();
 await student.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();
 const gramNames = () => student.locator('.gram-rows .gram-row strong').allInnerTexts();
 const has = async name => (await student.getByLabel(`${name} 양(g)`,{exact:true}).count())===1;
 // 기본 베이스 tab.
 await student.getByRole('button',{name:'국물 연습 추가',exact:true}).click();
 await student.locator('.gram-rows').waitFor();
 const baseNames = await gramNames();
 assert(await has('다시마분말'),'base tab shows 다시마분말');assert(await has('간장분말'),'base tab shows 간장분말');
 assert(!(await has('후추')),'base tab hides deleted 후추');assert(!(await has('설탕')),'base tab hides hidden 설탕');
 assert(!baseNames.some(n=>/^스프 [A-Z]$/.test(n)),'no commercial soups in the base tab');
 // The teacher sees 기본 스프 first, then 첨가물; the student list should follow the same grouping.
 const baseInStudent = baseNames.filter(n=>expectedBase.includes(n));
 assert.deepEqual(baseNames.slice(0,expectedBase.length),expectedBase,`student 기본 베이스 order is not grouped like the teacher list: student sees [${baseNames.join(', ')}], teacher shows 기본 스프 [${expectedBase.join(', ')}] then 첨가물 [${expectedAdditives.filter(n=>n!=='설탕').join(', ')}]`);
 assert.deepEqual(baseInStudent,expectedBase,'base soups keep the teacher order relative to each other');
 const kinds = await student.locator('.gram-rows .gram-row small').allInnerTexts();
 assert(kinds.includes('기본 스프')&&!kinds.includes('BASE')&&!kinds.includes('SPECIAL'),`students see friendly kind labels: ${kinds.join(', ')}`);
 assert(baseNames.indexOf('간장분말')<baseNames.indexOf('카레분말'),'간장분말 moved above 카레분말 for students too');
 await student.getByLabel('간장분말 양(g)',{exact:true}).fill('0.5');
 await student.getByLabel('다시마분말 양(g)',{exact:true}).fill('1.1');
 await student.getByLabel('맛 느낌 한 줄',{exact:true}).fill('다시마 감칠맛');
 await shot(student,'04-student-base');
 await noOverflow(student,'student base tab');
 // 시판 스프 tab.
 await student.getByRole('tab',{name:'시판 스프',exact:true}).click();
 await student.getByRole('button',{name:'국물 연습 추가',exact:true}).click();
 await student.locator('.gram-rows').waitFor();
 const commercialNames = await gramNames();
 assert(await has('간장분말'),'commercial tab shows 간장분말');assert(!(await has('다시마분말')),'commercial tab hides 기본 스프 다시마분말');
 for(const n of expectedBase) assert(!(await has(n)),`commercial tab hides base ${n}`);
 assert.deepEqual(commercialNames.filter(n=>/^스프 /.test(n)),['스프 A','스프 C'],'enabled soups appear by teacher letter');
 await student.locator('details.comparison-notes summary').click();
 assert.deepEqual(await student.locator('details.comparison-notes .admin-field span').allInnerTexts(),['스프 A','스프 C']);
 await student.getByLabel('스프 A 양(g)',{exact:true}).fill('1');
 await student.getByLabel('스프 C 양(g)',{exact:true}).fill('2');
 await student.getByLabel('간장분말 양(g)',{exact:true}).fill('0.3');
 await student.getByLabel('맛 느낌 한 줄',{exact:true}).fill('스프 C가 매워요');
 const saved = await serverProject(p=>{const b=p.notebook?.base.practices[0]?.items??[],c=p.notebook?.commercial.practices[0]?.items??[];return b.some(x=>x.name==='간장분말'&&x.amount===0.5)&&c.some(x=>x.name==='스프 C'&&x.amount===2)&&c.some(x=>x.name==='간장분말');},'student amounts saved');
 const soyId = soy.id;
 assert.deepEqual(saved.notebook.commercial.practices[0].items.map(x=>x.name).sort(),['간장분말','스프 A','스프 C'].sort());
 assert.equal(saved.notebook.base.practices[0].items.find(x=>x.id===soyId).amount,0.5);
 const studentHtml = await student.content() + JSON.stringify(await student.evaluate(()=>Object.fromEntries(Object.entries(localStorage))));
 for(const n of PRODUCT_NAMES) assert(!studentHtml.includes(n),`student DOM/localStorage shows product name "${n}"`);
 assert(!JSON.stringify(saved).includes('진라면'),'saved record has no product name');
 await shot(student,'05-student-commercial');
 await noOverflow(student,'student commercial tab');

 // ---- Teacher deletes 간장분말 -> the saved student record keeps it ----
 await navTo(teacher,'스프·첨가물 관리');
 await ingRow(teacher,'간장분말').waitFor();
 teacher.once('dialog',d=>void d.accept());
 await ingRow(teacher,'간장분말').getByRole('button',{name:'삭제',exact:true}).click();
 await ingRow(teacher,'간장분말').waitFor({state:'detached'});
 await saveTeacher(teacher);
 assert(!(await teacherSettings()).ingredients.some(x=>x.name==='간장분말'));
 // The student screen picks the change up on its next settings refresh (12s).
 await student.getByLabel('간장분말 양(g)',{exact:true}).waitFor({state:'detached',timeout:POLL});
 const history = student.locator('.historical-ingredients');
 await history.waitFor();
 assert.match(await history.innerText(),/간장분말 0\.3g/,'commercial record keeps 간장분말 0.3g');
 await student.getByRole('tab',{name:'기본 베이스',exact:true}).click();
 await student.locator('.historical-ingredients').waitFor();
 assert.match(await student.locator('.historical-ingredients').innerText(),/간장분말 0\.5g/,'base record keeps 간장분말 0.5g');
 assert.equal(await student.getByLabel('다시마분말 양(g)',{exact:true}).inputValue(),'1.1');
 // An edit after the deletion is saved and the server keeps the snapshot of the deleted ingredient.
 await student.getByLabel('맛 느낌 한 줄',{exact:true}).fill('다시마 감칠맛, 간장은 이제 없음');
 const after = await serverProject(p=>p.notebook?.base.practices[0]?.note==='다시마 감칠맛, 간장은 이제 없음','edit after delete saved');
 const keptSoy = after.notebook.base.practices[0].items.find(x=>x.id===soyId);
 assert(keptSoy,'deleted ingredient survives a later save');assert.equal(keptSoy.name,'간장분말');assert.equal(keptSoy.amount,0.5);
 await shot(student,'06-student-after-delete');
 // Teacher 학생 레시피 보기 shows the snapshot.
 await teacher.getByLabel('수업 선택',{exact:true}).selectOption(lesson.id);
 await navTo(teacher,'학생 레시피 보기');
 await teacher.locator('.student-recipe-list button').first().waitFor({timeout:POLL});
 await teacher.locator('.student-recipe-list button').first().click();
 await teacher.getByRole('dialog').waitFor();
 const readout = await teacher.locator('.two-recipes').innerText();
 assert.match(readout,/간장분말\s*0\.5g/,'teacher sees 간장분말 0.5g in the base record');
 assert.match(readout,/간장분말\s*0\.3g/,'teacher sees 간장분말 0.3g in the commercial record');
 assert.match(readout,/다시마분말\s*1\.1g/);assert.match(readout,/스프 C\s*2g/);
 await shot(teacher,'07-teacher-student-recipe',false);
 await teacher.keyboard.press('Escape');await teacher.getByRole('dialog').waitFor({state:'hidden'});

 // ---- Phone-size teacher (390x844) ----
 const phoneContext = await browser.newContext({storageState:await api.storageState(),viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const phone = await phoneContext.newPage();phone.on('pageerror',e=>errors.push('teacher phone: '+e.message));debugPage = phone;
 await openTeacher(phone);
 await navTo(phone,'스프·첨가물 관리');
 await phone.getByRole('heading',{name:'스프·첨가물 관리',exact:true}).waitFor();
 await phone.evaluate(()=>document.fonts.ready);
 await noOverflow(phone,'phone 스프·첨가물 관리');
 await shot(phone,'08-phone-ingredients');
 await ingRow(phone,'다시마분말').getByRole('button',{name:'자세히',exact:true}).click();
 await ingRow(phone,'다시마분말').locator('.ing-detail').waitFor();
 await noOverflow(phone,'phone 스프·첨가물 관리 (자세히 open)');
 await ingRow(phone,'다시마분말').screenshot({path:path.join(out,'ing-09-phone-ingredient-detail.png')});
 const tap = async (p,label) => { const box = await p.getByRole('button',{name:label,exact:true}).boundingBox(); return box && box.height; };
 soft((await tap(phone,'다시마분말 위로'))>=40,'phone ↑ button is shorter than 40px');
 await navTo(phone,'시판 스프 관리');
 await phone.getByRole('heading',{name:'시판 스프 관리',exact:true}).waitFor();
 await noOverflow(phone,'phone 시판 스프 관리');
 await shot(phone,'10-phone-soups');
 await phone.locator('article.soup-row').nth(2).getByRole('button',{name:'알레르기 확인',exact:true}).click();
 await noOverflow(phone,'phone 시판 스프 관리 (알레르기 open)');
 await shot(phone,'11-phone-soups-allergen');
 // Laptop/tablet widths too.
 for(const [label,width,height] of [['tablet',768,1024],['laptop',1366,900]]){
  await phone.setViewportSize({width,height});
  for(const nav of ['스프·첨가물 관리','시판 스프 관리']){await navTo(phone,nav);await noOverflow(phone,`${label} ${nav}`);}
 }

 assert.deepEqual(errors,[],'Browser errors');
 const result = {status:'PASS',warnings,screenshots:fs.readdirSync(out).filter(x=>x.startsWith('ing-')&&x.endsWith('.png'))};
 fs.writeFileSync(path.join(out,'ingredients-results.json'),JSON.stringify(result,null,2));
 console.log(`PASS: ingredients/soups e2e${warnings.length?` with ${warnings.length} warning(s)`:''}; artifacts in ${out}`);
 } finally {
  await restore().catch(e=>console.error('restore failed',e));
  await browser.close();await api.dispose();
 }
})().catch(async e=>{if(debugPage){await debugPage.screenshot({path:path.join(out,'ing-failure.png'),fullPage:true}).catch(()=>{});console.error((await debugPage.locator('body').innerText().catch(()=>'')).slice(-2200));}console.error(e);if(warnings.length)console.error('Warnings:',warnings);process.exit(1)});
