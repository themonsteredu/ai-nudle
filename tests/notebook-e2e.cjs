/* Integration checks against a LOCAL Vite/Cloudflare D1 server only.
   PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome node tests/notebook-e2e.cjs
   Writes test classrooms to local D1; never run against production. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const studentDefaultsEmpty = s => s.ingredients.filter(x=>x.id!=='cheese').every(x=>!x.allergenChecked && x.allergens.length===0);
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Use a local test database');
const out = path.resolve('outputs/verification');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const api = await request.newContext({baseURL:origin});
 assert.equal((await api.post('/api/teacher/login',{data:{password:'0000'}})).status(),401);
 assert.equal((await api.post('/api/teacher/login',{data:{password:'3035'}})).status(),200);
 const settings=(await (await api.get('/api/settings')).json()).settings;
 assert(studentDefaultsEmpty(settings),'Unconfigured ingredients must not guess allergens');
 const suffix=Date.now().toString(16).slice(-6).toUpperCase();
 const a={id:crypto.randomUUID(),name:`검증학교 1반 ${suffix}`,code:`A${suffix}`,waterMl:100,cookMinutes:3,noodleFraction:.25};
 const b={...a,id:crypto.randomUUID(),name:`다른학교 2반 ${suffix}`,code:`B${suffix}`,waterMl:120};
 settings.classes.push(a,b);
 const cheese=settings.ingredients.find(x=>x.id==='cheese');cheese.allergens=['우유'];cheese.allergenChecked=true;
 settings.ingredients.find(x=>x.id==='pepper').enabled=false;
 let response=await api.put('/api/settings',{data:{settings}});assert.equal(response.status(),200);
 const anonymous=await request.newContext({baseURL:origin});
 assert.equal((await anonymous.get('/api/settings')).status(),404);
 const studentSettings=(await (await anonymous.get('/api/settings?code='+a.code)).json()).settings;
 assert.equal(studentSettings.classes.length,1);assert.equal(studentSettings.classes[0].code,'');
 assert.equal(studentSettings.comparisonSoups[0].name,'스프 A');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 const errors=[];const context=await browser.newContext({viewport:{width:1366,height:960}});const page=await context.newPage();global.debugPage=page;
 page.on('pageerror',e=>errors.push(e.message));
 async function saved(){await page.waitForFunction(()=>document.querySelector('.student-topbar .save-status')?.textContent==='자동 저장됨');}
 async function join(p,c,group=1){await p.goto(origin);await p.waitForLoadState('networkidle');await p.getByLabel('수업 코드',{exact:true}).fill(c);await p.getByRole('button',{name:'기록 시작하기',exact:true}).click();await p.getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?',exact:true}).waitFor();await p.getByRole('button',{name:`${group}모둠`,exact:true}).click();await p.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();}
 await join(page,a.code);await saved();
 // The class uses the 기본 베이스 only: no method tabs, no 시판 스프 notes and no soup letters in the editor.
 const soupLetters = async p => (await p.locator('.gram-rows .gram-row strong').allInnerTexts()).filter(n=>/^스프 [A-Z]$/.test(n));
 async function baseOnly(p,label){
  assert.equal(await p.getByRole('tablist').count(),0,label+': no 기본 베이스/시판 스프 tabs');assert.equal(await p.getByRole('tab').count(),0,label+': no method tab');
  assert.equal(await p.locator('details.comparison-notes').count(),0,label+': no 시판 스프 notes');
  assert(!(await p.locator('.student-main').innerText()).includes('시판 스프'),label+': the record page never mentions 시판 스프');
  assert.deepEqual(await soupLetters(p),[],label+': no commercial soup in the editor');
 }
 await baseOnly(page,'empty record page');
 await page.getByRole('button',{name:'국물 연습 추가',exact:true}).click();
 await baseOnly(page,'practice editor');
 await page.getByLabel('쇠고기 조미분말 양(g)',{exact:true}).fill('1.25');await page.getByLabel('맛 느낌 한 줄',{exact:true}).fill('고소하고 부드러운 맛');await saved();
 assert.equal(await page.getByLabel('후추 양(g)',{exact:true}).count(),0);
 await page.getByRole('button',{name:'국물 연습 추가',exact:true}).click();await page.getByLabel('마늘분말 양(g)',{exact:true}).fill('.15');await page.getByLabel('맛 느낌 한 줄',{exact:true}).fill('마늘 향이 진해요');
 await page.getByRole('button',{name:'이 레시피를 라면 기록으로 복사',exact:true}).click();
 assert.equal(await page.getByLabel('마늘분말 양(g)',{exact:true}).inputValue(),'0.15');
 await page.getByLabel('야채 후레이크 양(g)',{exact:true}).fill('.3');await saved();
 await page.getByRole('button',{name:'연습 1',exact:true}).click();assert.equal(await page.getByLabel('쇠고기 조미분말 양(g)',{exact:true}).inputValue(),'1.25');
 assert.equal(await page.getByLabel('야채 후레이크 양(g)',{exact:true}).count(),0);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'이 레시피를 라면 기록으로 복사',exact:true}).click();await saved();
 assert.equal(await page.getByText('이전 라면 기록 보기 (1)',{exact:true}).count(),1);
 // The ramen tasting (copied from 연습 1) lists toppings but still no commercial soup.
 assert.equal(await page.locator('.recipe-editor h2').innerText(),'라면 시식');assert.equal(await page.getByLabel('야채 후레이크 양(g)',{exact:true}).count(),1);
 await baseOnly(page,'tasting editor');
 await page.getByLabel('치즈분말 양(g)',{exact:true}).fill('.4');await page.getByLabel('맛 느낌 한 줄',{exact:true}).fill('부드러운 치즈 향');await saved();
 assert.match(await page.locator('.recipe-editor .recipe-allergens').innerText(),/우유/);assert.match(await page.locator('.recipe-editor .recipe-allergens').innerText(),/아직 확인하지 않은 재료/);
 // 모둠 베스트 제출 has no record picker: it always submits the 기본 베이스 라면 시식 record.
 await page.getByRole('button',{name:'모둠 베스트 제출',exact:true}).click();await page.getByLabel('라면 이름',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('제출할 라면 기록',{exact:true}).count(),0,'no 제출할 라면 기록 picker');
 assert(!(await page.locator('.final-notebook').innerText()).includes('시판 스프'),'the submit page never mentions 시판 스프');
 const submitReadout = page.locator('.final-notebook .recipe-readout');
 assert.equal(await submitReadout.locator('h3').innerText(),'제출할 라면 시식 기록');
 assert.match(await submitReadout.innerText(),/쇠고기 조미분말\s*1\.25g/);assert.match(await submitReadout.innerText(),/치즈분말\s*0\.4g/);assert.match(await submitReadout.innerText(),/부드러운 치즈 향/);
 await page.getByLabel('라면 이름',{exact:true}).fill('부드러운 치즈 라면');await page.getByLabel('한 줄 소개',{exact:true}).fill('내가 찾은 치즈와 베이스의 조합');await page.getByLabel('맵기 단계',{exact:true}).selectOption('1');page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'모둠 베스트 레시피 제출',exact:true}).click();await page.getByText('제출 완료',{exact:true}).waitFor();await saved();
 await page.getByLabel('인쇄할 이름 (선택)',{exact:true}).fill('인쇄전용이름');await saved();
 const local=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('ramen-notebook:')))));
 assert.equal(local.project.notebook.base.practices.length,2);assert.equal(local.project.notebook.base.tastingHistory.length,1);
 assert.deepEqual(local.project.notebook.commercial,{practices:[],tastingHistory:[]},'a new record never gets a 시판 스프 part');
 const mine=await anonymous.get('/api/students?id='+local.project.id,{headers:{'x-class-code':a.code,'x-student-key':local.key}});assert.equal(mine.status(),200);
 const mineJson=await mine.json();assert(!JSON.stringify(mineJson).includes('인쇄전용이름'));
 { const n=mineJson.project.notebook;
  assert.equal(n.final.method,'base');assert.equal(n.final.shared,true);assert.equal(n.final.record.id,n.base.tasting.id,'the submission is the 기본 베이스 라면 시식 record');
  assert.deepEqual(n.final.record.items.map(x=>[x.name,x.amount]),n.base.tasting.items.map(x=>[x.name,x.amount]));
  assert.deepEqual(n.final.record.items.filter(x=>['beef-base','cheese'].includes(x.id)).map(x=>[x.id,x.amount]).sort(),[['beef-base',1.25],['cheese',0.4]]);
  assert.deepEqual(n.commercial,{practices:[],tastingHistory:[]}); }
 assert.equal((await anonymous.get('/api/students?id='+local.project.id,{headers:{'x-class-code':b.code,'x-student-key':local.key}})).status(),403);
 assert.equal((await anonymous.post('/api/students',{headers:{'x-class-code':a.code,'x-student-key':'wrong-key-with-enough-characters'},data:{project:local.project}})).status(),403);
 assert.equal((await anonymous.post('/api/students',{headers:{'x-class-code':a.code,'x-student-key':local.key},data:{project:{...local.project,revision:0}}})).status(),409);
 const sharedA=(await (await anonymous.get('/api/students',{headers:{'x-class-code':a.code}})).json()).projects;
 assert.equal(sharedA.length,1);assert(!JSON.stringify(sharedA).includes(local.project.id));assert(!JSON.stringify(sharedA).includes(local.key));assert(!JSON.stringify(sharedA).includes('ownerHash'));
 assert.equal((await (await anonymous.get('/api/students',{headers:{'x-class-code':b.code}})).json()).projects.length,0);
 await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(out,'student-stickers.png'),fullPage:true});
 await page.pdf({path:path.join(out,'stickers.pdf'),preferCSSPageSize:true,printBackground:true});
 // Offline edits survive page reload and sync after network restoration.
 await page.getByRole('button',{name:'레시피 기록',exact:true}).click();await page.getByRole('button',{name:'라면 기록 열기',exact:true}).click();
 await context.setOffline(true);await page.getByLabel('맛 느낌 한 줄',{exact:true}).fill('끊겨도 남아 있는 치즈 맛 기록');
 await context.setOffline(false);await page.reload();await page.waitForLoadState('networkidle');await page.getByLabel('수업 코드',{exact:true}).fill(a.code);await page.getByRole('button',{name:'기록 시작하기',exact:true}).click();await page.getByRole('button',{name:'라면 기록 열기',exact:true}).click();await saved();assert.equal(await page.getByLabel('맛 느낌 한 줄',{exact:true}).inputValue(),'끊겨도 남아 있는 치즈 맛 기록');
 for(const [label,width,height] of [['phone',390,844],['tablet',768,1024],['laptop',1366,960]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),label+' horizontal overflow');await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});}
 // A second student in the same class, on another device.
 const c2=await browser.newContext();const p2=await c2.newPage();p2.on('pageerror',e=>errors.push(e.message));await join(p2,a.code,2);await p2.getByRole('button',{name:'국물 연습 추가',exact:true}).click();await p2.getByLabel('양파분말 양(g)',{exact:true}).fill('.2');await p2.getByLabel('맛 느낌 한 줄',{exact:true}).fill('달큰한 양파 향');await p2.waitForFunction(()=>document.querySelector('.student-topbar .save-status')?.textContent==='자동 저장됨');
 // An OLDER record from when the class also used 시판 스프: it has a 시판 스프 part, a soup note and a 시판 스프 group submission.
 const t0='2026-09-01T01:00:00.000Z';
 const rec=(id,items,note)=>({id,items:items.map(([iid,name,amount,category])=>({id:iid,name,amount,category})),note,waterMl:a.waterMl,cookMinutes:a.cookMinutes,noodleFraction:a.noodleFraction,createdAt:t0,updatedAt:t0});
 const oldCommercial={practices:[rec('record-old-com-1',[['soup-a','스프 A',1,'시판 스프'],['garlic-powder','마늘분말',.2,'향']],'옛 시판 연습 메모')],tasting:rec('record-old-com-t',[['soup-b','스프 B',1.5,'시판 스프'],['chili','고춧가루',.1,'매운맛']],'옛 시판 라면 메모'),tastingHistory:[rec('record-old-com-h',[['soup-a','스프 A',.8,'시판 스프']],'옛 시판 첫 라면')]};
 const olderKey=crypto.randomUUID();
 const older={id:`student-older-${suffix.toLowerCase()}`,classId:a.id,revision:0,studentName:'',teamName:'',experiments:[],bestRecipeIndex:null,label:{productName:'',tasteLine:'',developerName:''},createdAt:t0,updatedAt:t0,
  notebook:{base:{practices:[rec('record-old-base-1',[['bone-base','사골분말',1,'BASE']],'옛 사골 연습')],tastingHistory:[]},commercial:oldCommercial,comparisons:{__group:'3','soup-a':'옛 스프 A 메모'},
   final:{method:'commercial',record:oldCommercial.tasting,productName:'옛 시판 라면',tasteLine:'예전에 낸 시판 스프 레시피',keywords:[],spicyLevel:2,savedAt:t0,shared:true}}};
 const seeded=await anonymous.post('/api/students',{headers:{'x-class-code':a.code,'x-student-key':olderKey},data:{project:older}});assert.equal(seeded.status(),200,'seed the older record');
 const olderSaved=(await seeded.json()).project;
 assert.equal(olderSaved.notebook.commercial.practices[0].items[0].name,'스프 A');assert.equal(olderSaved.notebook.final.method,'commercial');
 const olderServer=async(check,label)=>{const deadline=Date.now()+25000;for(;;){const r=await anonymous.get('/api/students?id='+older.id,{headers:{'x-class-code':a.code,'x-student-key':olderKey}});const project=r.status()===200?(await r.json()).project:null;if(project&&check(project))return project;if(Date.now()>deadline)assert.fail('older record never matched: '+label);await new Promise(r=>setTimeout(r,500));}};
 // The student keeps working on that record on a phone: only the 기본 베이스 part is shown.
 const c3=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const p3=await c3.newPage();p3.on('pageerror',e=>errors.push(e.message));global.debugPage=p3;
 await p3.goto(origin);await p3.waitForLoadState('networkidle');
 await p3.evaluate(([lessonId,session])=>{localStorage.setItem('ramen-active:'+lessonId,session.project.id);localStorage.setItem('ramen-notebook:'+session.project.id,JSON.stringify(session));},[a.id,{project:olderSaved,key:olderKey,code:a.code,dirty:false}]);
 await p3.getByLabel('수업 코드',{exact:true}).fill(a.code);await p3.getByRole('button',{name:'기록 시작하기',exact:true}).click();await p3.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();
 assert.equal(await p3.locator('.gb-mygroup').textContent(),'3모둠');
 await baseOnly(p3,'older record');
 assert.deepEqual(await p3.locator('.record-pills button').allInnerTexts(),['연습 1'],'only the 기본 베이스 practice is listed');
 assert.equal(await p3.getByRole('button',{name:'라면 기록 쓰기',exact:true}).count(),1,'the hidden 시판 스프 tasting is not offered as the 라면 기록');
 assert.equal(await p3.getByText(/이전 라면 기록 보기/).count(),0,'the hidden 시판 스프 tasting history is not listed');
 { const shown=await p3.locator('.student-main').innerText(); for(const hidden of ['옛 시판','옛 스프 A 메모','스프 A','스프 B']) assert(!shown.includes(hidden),`older record page shows hidden 시판 스프 data "${hidden}"`); }
 // Its old 시판 스프 submission is not shown as done: the student is asked to submit the 기본 베이스 record and is led to it.
 await p3.locator('.student-nav').getByRole('button',{name:'모둠 베스트 제출',exact:true}).click();await p3.getByText('다시 제출 필요',{exact:true}).waitFor();
 assert.equal(await p3.getByText('제출 완료',{exact:true}).count(),0,'an old 시판 스프 submission is not shown as 제출 완료');
 assert.equal(await p3.locator('.sticker-toolbar').count(),0,'no sticker of the old 시판 스프 recipe');
 { const t=await p3.locator('.final-notebook').innerText(); for(const hidden of ['시판','스프 A','스프 B']) assert(!t.includes(hidden),`submit page shows old 시판 스프 data "${hidden}"`); }
 assert.deepEqual(await p3.locator('.taste-keywords button').allInnerTexts(),['사골','연습'],'keywords come from the 기본 베이스 notes only');
 await p3.getByRole('button',{name:'레시피 기록으로 가기',exact:true}).click();await p3.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();
 await p3.getByRole('button',{name:'연습 1',exact:true}).click();assert.equal(await p3.getByLabel('사골분말 양(g)',{exact:true}).inputValue(),'1');
 await baseOnly(p3,'older record practice');
 await p3.getByRole('button',{name:'국물 연습 추가',exact:true}).click();await p3.getByLabel('쇠고기 조미분말 양(g)',{exact:true}).fill('.9');await p3.getByLabel('맛 느낌 한 줄',{exact:true}).fill('새 기본 베이스 연습');
 await p3.getByRole('button',{name:'라면 기록 쓰기',exact:true}).click();await p3.getByLabel('멸치 조미분말 양(g)',{exact:true}).fill('1.1');await p3.getByLabel('맛 느낌 한 줄',{exact:true}).fill('새 기본 라면 기록');
 await baseOnly(p3,'older record tasting');
 await olderServer(x=>x.notebook.base.tasting?.note==='새 기본 라면 기록'&&x.notebook.base.practices.length===2,'older record base edits saved');
 // Its old 시판 스프 submission is replaced by the 기본 베이스 라면 시식 record on the next submit.
 await p3.locator('.student-nav').getByRole('button',{name:'모둠 베스트 제출',exact:true}).click();await p3.getByText('다시 제출 필요',{exact:true}).waitFor();
 assert.equal(await p3.getByLabel('제출할 라면 기록',{exact:true}).count(),0,'older record: no 제출할 라면 기록 picker');
 assert.equal(await p3.getByRole('button',{name:'레시피 기록으로 가기',exact:true}).count(),0,'a 기본 베이스 tasting exists, so no detour');
 // Keywords: the submitted tasting first, then the 기본 베이스 practices; never the hidden 시판 스프 notes.
 assert.deepEqual(await p3.locator('.taste-keywords button').allInnerTexts(),['기본','라면','기록','사골','연습','베이스']);
 { const r=await p3.locator('.final-notebook .recipe-readout').innerText(); assert.match(r,/멸치 조미분말\s*1\.1g/);assert.match(r,/새 기본 라면 기록/);assert(!/스프 B|고춧가루|옛 시판 라면 메모/.test(r),'the submit page shows the 기본 베이스 record, not the old 시판 스프 one'); }
 await p3.getByText(/바뀐 내용이 있어요/).waitFor();
 p3.once('dialog',d=>d.accept());await p3.getByRole('button',{name:'다시 제출하기',exact:true}).click();
 await p3.getByText('제출 완료',{exact:true}).waitFor();assert.equal(await p3.getByText('다시 제출 필요',{exact:true}).count(),0);await p3.locator('.sticker-toolbar').waitFor();
 const olderAfter=await olderServer(x=>x.notebook.final?.method==='base','older record re-submitted');
 assert.equal(olderAfter.notebook.final.shared,true);assert.equal(olderAfter.notebook.final.record.id,olderAfter.notebook.base.tasting.id,'older record submits its 기본 베이스 라면 시식 record');
 assert.deepEqual(olderAfter.notebook.final.record.items.map(x=>[x.id,x.amount]),[['anchovy-base',1.1]]);
 // Nothing of the 시판 스프 part was lost by the edits.
 assert.deepEqual(olderAfter.notebook.commercial,olderSaved.notebook.commercial,'the older 시판 스프 part survives later edits unchanged');
 assert.equal(olderAfter.notebook.comparisons['soup-a'],'옛 스프 A 메모','the older soup note survives');assert.equal(olderAfter.notebook.comparisons.__group,'3');
 assert.deepEqual(olderAfter.notebook.base.practices.map(x=>x.note),['옛 사골 연습','새 기본 베이스 연습']);
 await p3.evaluate(()=>document.fonts.ready);await p3.screenshot({path:path.join(out,'older-record-phone.png'),fullPage:true});
 global.debugPage=page;
 const teacherContext=await browser.newContext({storageState:await api.storageState(),viewport:{width:1920,height:1080}});const teacher=await teacherContext.newPage();teacher.on('pageerror',e=>errors.push(e.message));
 await teacher.goto(origin+'/teacher');await teacher.waitForLoadState('networkidle');await teacher.getByLabel('수업 선택',{exact:true}).selectOption(a.id);
 const menus=await teacher.locator('.teacher-sidebar nav button').allInnerTexts();assert(!menus.includes('시판 스프 관리')&&!menus.some(m=>m.includes('시판')),'no 시판 스프 menu: '+menus.join(', '));
 await teacher.getByRole('button',{name:'학생 레시피 보기',exact:true}).click();await teacher.locator('.student-recipe-list button').nth(2).waitFor();
 // A 기본 베이스-only record shows one column and no 시판 스프 column.
 const columnTitles=()=>teacher.locator('.recipe-presentation :is(.one-recipe,.two-recipes)>div>.recipe-readout>h3').allInnerTexts();
 await teacher.locator('.student-recipe-list button').first().click();await teacher.getByRole('dialog').waitFor();
 assert.equal(await teacher.locator('.two-recipes').count(),0,'a 기본 베이스-only record has no 시판 스프 column');assert.equal(await teacher.locator('.one-recipe>.recipe-readout').count(),0);assert.equal(await teacher.locator('.one-recipe>div').count(),1);
 assert.deepEqual(await columnTitles(),['기본 베이스 · 라면 시식']);assert(!(await teacher.getByRole('dialog').innerText()).includes('시판 스프'));
 assert.match(await teacher.locator('.one-recipe').innerText(),/치즈분말\s*0\.4g/);
 await teacher.screenshot({path:path.join(out,'teacher-recipes.png')});await teacher.keyboard.press('ArrowRight');assert.match(await teacher.locator('.recipe-presentation>header h1').innerText(),/2번/);assert.match(await teacher.locator('.one-recipe').innerText(),/달큰한 양파 향/);
 assert.deepEqual(await columnTitles(),['기본 베이스 · 최근 국물 연습']);assert.equal(await teacher.locator('.two-recipes').count(),0);
 // The older record still shows its 시판 스프 column next to the newer 기본 베이스 work.
 await teacher.keyboard.press('ArrowRight');assert.match(await teacher.locator('.recipe-presentation>header h1').innerText(),/3번/);
 assert.equal(await teacher.locator('.two-recipes>div').count(),2,'the older record shows two columns');assert.equal(await teacher.locator('.one-recipe').count(),0);
 assert.deepEqual(await columnTitles(),['기본 베이스 · 라면 시식','시판 스프 · 라면 시식']);
 { const [baseCol,comCol]=await teacher.locator('.two-recipes>div').allInnerTexts();
  assert.match(baseCol,/멸치 조미분말\s*1\.1g/);assert.match(baseCol,/새 기본 라면 기록/);assert.match(baseCol,/연습 기록 펼치기 \(2\)/);
  assert.match(comCol,/스프 B\s*1\.5g/);assert.match(comCol,/고춧가루\s*0\.1g/);assert.match(comCol,/옛 시판 라면 메모/);assert.match(comCol,/연습 기록 펼치기 \(1\)/);
  for(const n of ['오뚜기','짬뽕']) assert(!comCol.includes(n),'the projected 시판 스프 column shows soup letters, not product names'); }
 await teacher.locator('.two-recipes>div').nth(1).locator('summary').click();assert.match(await teacher.locator('.two-recipes>div').nth(1).innerText(),/스프 A\s*1g[\s\S]*옛 시판 연습 메모/);
 await teacher.screenshot({path:path.join(out,'teacher-recipes-older.png')});
 await teacher.keyboard.press('Escape');await teacher.getByRole('dialog').waitFor({state:'hidden'});
 // 모둠 베스트·블라인드 투표 with an old 시판 스프 submission that was never re-submitted (4모둠).
 const legacyKey=crypto.randomUUID();const legacyTasting=rec('record-legacy-com-t',[['soup-a','스프 A',1,'시판 스프'],['garlic-powder','마늘분말',.2,'향']],'옛 시판 메모');
 const legacy={...older,id:`student-legacy-${suffix.toLowerCase()}`,notebook:{base:{practices:[],tastingHistory:[]},commercial:{practices:[],tasting:legacyTasting,tastingHistory:[]},comparisons:{__group:'4'},final:{method:'commercial',record:legacyTasting,productName:'옛 4모둠 라면',tasteLine:'',keywords:[],spicyLevel:0,savedAt:t0,shared:true}}};
 assert.equal((await anonymous.post('/api/students',{headers:{'x-class-code':a.code,'x-student-key':legacyKey},data:{project:legacy}})).status(),200,'seed an old 시판 스프 submission');
 const soupIndex=settings.comparisonSoups.findIndex(x=>x.id==='soup-a');const soupKey=`스프 ${String.fromCharCode(65+soupIndex)} = ${settings.comparisonSoups[soupIndex].name||'이름 없음'}`;
 await teacher.getByRole('button',{name:'모둠 베스트·블라인드 투표',exact:true}).click();
 await teacher.waitForFunction(()=>[...document.querySelectorAll('.gb-notes li')].some(li=>li.textContent.startsWith('4모둠은 예전 시판 스프 레시피가 제출되어 있어요')),null,{timeout:15000});
 assert(!(await teacher.locator('.gb-notes').innerText()).includes(soupKey),'no product key before the start');
 teacher.once('dialog',d=>void d.accept());await teacher.getByRole('button',{name:'블라인드 테스트 시작',exact:true}).click();await teacher.locator('.gb-cards .gb-card').first().waitFor();
 { const cards=await teacher.locator('.gb-cards .gb-card').allInnerTexts();assert.equal(cards.length,3,'1모둠, 3모둠 (re-submitted as 기본 베이스) and 4모둠 (old 시판 스프)');
  assert(cards.every(t=>!t.includes('기본 베이스')),'no 기본 베이스 chip on the blind cards');
  assert.equal(cards.filter(t=>t.includes('시판 스프')).length,1,'only the old submission is marked 시판 스프');
  assert(cards.every(t=>!t.includes(settings.comparisonSoups[soupIndex].name||'@@')),'cards never show the product name'); }
 await teacher.waitForFunction(k=>[...document.querySelectorAll('.gb-notes li')].some(li=>li.textContent.includes(k)),soupKey,{timeout:15000});
 assert.equal(await teacher.getByText(/4모둠은 예전 시판 스프/).count(),0,'no group named once the round started');
 await teacher.screenshot({path:path.join(out,'teacher-groupbest-legacy.png'),fullPage:true});
 teacher.once('dialog',d=>void d.accept());await teacher.getByRole('button',{name:'투표 초기화 · 새로 시작',exact:true}).click();await teacher.getByRole('button',{name:'블라인드 테스트 시작',exact:true}).waitFor();
 await teacher.getByRole('button',{name:'학생 레시피 보기',exact:true}).click();
 await teacher.getByLabel('수업 선택',{exact:true}).selectOption(b.id);await teacher.getByText('이 반에 저장된 학생 기록이 아직 없습니다.',{exact:true}).waitFor();assert.equal(await teacher.locator('.student-recipe-list button').count(),0);
 await teacher.getByRole('button',{name:'직업소개·공정시연',exact:true}).click();await teacher.getByRole('button',{name:'직업 소개부터 전체화면',exact:true}).click();assert.match(await teacher.getByRole('dialog').innerText(),/라면 한 봉지/);await teacher.keyboard.press('ArrowRight');assert.equal(await teacher.locator('.career-reveal.shown').count(),1);await teacher.screenshot({path:path.join(out,'teacher-slide.png')});await teacher.keyboard.press('Escape');await teacher.getByLabel('발표 장면',{exact:true}).selectOption({label:'공정 1. 원료 배합'});assert(await teacher.locator('.presenter-stage').count());
 assert.deepEqual(errors,[],'Browser errors');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',checks:['teacher password and class creation','no inferred allergens','anonymous g records','unlimited practice records, 기본 베이스 only (no tabs, notes or soups)','copy and tasting history','toppings only in ramen tasting','allergen aggregation and unverified warning','group best submits the 기본 베이스 tasting record','older 시판 스프 record kept through edits and shown to the teacher','print-only names','class isolation and owner authorization','stale revision rejects overwrite','anonymous opt-in sharing','offline/reload recovery','phone/tablet/laptop responsive layouts','teacher read-only fullscreen and keyboard','career slides and existing process demonstration'],screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png'))},null,2));
 console.log('PASS: 18 integration groups; artifacts in outputs/verification');
 await browser.close();await api.dispose();await anonymous.dispose();
})().catch(async e=>{if(global.debugPage){await global.debugPage.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error((await global.debugPage.locator('body').innerText()).slice(-2200));}console.error(e);process.exit(1)});
