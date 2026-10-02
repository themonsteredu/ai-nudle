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
 async function join(p,c){await p.goto(origin);await p.waitForLoadState('networkidle');await p.getByLabel('수업 코드',{exact:true}).fill(c);await p.getByRole('button',{name:'기록 시작하기',exact:true}).click();await p.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();}
 await join(page,a.code);await saved();
 await page.getByRole('button',{name:'국물 연습 추가',exact:true}).click();
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
 await page.getByRole('tab',{name:'시판 스프',exact:true}).click();await page.getByRole('button',{name:'국물 연습 추가',exact:true}).click();await page.getByLabel('스프 A 양(g)',{exact:true}).fill('1');await page.getByLabel('치즈분말 양(g)',{exact:true}).fill('.4');await page.getByLabel('맛 느낌 한 줄',{exact:true}).fill('부드러운 치즈 향');
 await page.getByRole('button',{name:'이 레시피를 라면 기록으로 복사',exact:true}).click();await saved();
 assert.match(await page.locator('.recipe-editor .recipe-allergens').innerText(),/우유/);assert.match(await page.locator('.recipe-editor .recipe-allergens').innerText(),/아직 확인하지 않은 재료/);
 await page.getByRole('button',{name:'완제품 스티커',exact:true}).click();await page.getByLabel('스티커에 담을 라면 기록',{exact:true}).selectOption('commercial');await page.getByLabel('라면 이름',{exact:true}).fill('부드러운 치즈 라면');await page.getByLabel('한 줄 소개',{exact:true}).fill('내가 찾은 치즈와 스프의 조합');await page.getByLabel('맵기 단계',{exact:true}).selectOption('1');await page.getByRole('button',{name:'최종 레시피 저장',exact:true}).click();await saved();
 await page.getByLabel('인쇄할 이름 (선택)',{exact:true}).fill('인쇄전용이름');await page.getByRole('button',{name:'우리 반에 공유하기',exact:true}).click();await saved();
 const local=await page.evaluate(()=>JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('ramen-notebook:')))));
 assert.equal(local.project.notebook.base.practices.length,2);assert.equal(local.project.notebook.commercial.practices.length,1);assert.equal(local.project.notebook.base.tastingHistory.length,1);
 const mine=await anonymous.get('/api/students?id='+local.project.id,{headers:{'x-class-code':a.code,'x-student-key':local.key}});assert.equal(mine.status(),200);
 assert(!JSON.stringify(await mine.json()).includes('인쇄전용이름'));
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
 await context.setOffline(false);await page.reload();await page.getByLabel('수업 코드',{exact:true}).fill(a.code);await page.getByRole('button',{name:'기록 시작하기',exact:true}).click();await page.getByRole('tab',{name:'시판 스프',exact:true}).click();await page.getByRole('button',{name:'라면 기록 열기',exact:true}).click();await saved();assert.equal(await page.getByLabel('맛 느낌 한 줄',{exact:true}).inputValue(),'끊겨도 남아 있는 치즈 맛 기록');
 for(const [label,width,height] of [['phone',390,844],['tablet',768,1024],['laptop',1366,960]]){await page.setViewportSize({width,height});await page.evaluate(()=>document.fonts.ready);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),label+' horizontal overflow');await page.screenshot({path:path.join(out,label+'.png'),fullPage:true});}
 // A second student in the same class, on another device.
 const c2=await browser.newContext();const p2=await c2.newPage();await join(p2,a.code);await p2.getByRole('button',{name:'국물 연습 추가',exact:true}).click();await p2.getByLabel('양파분말 양(g)',{exact:true}).fill('.2');await p2.getByLabel('맛 느낌 한 줄',{exact:true}).fill('달큰한 양파 향');await p2.waitForFunction(()=>document.querySelector('.student-topbar .save-status')?.textContent==='자동 저장됨');
 const teacherContext=await browser.newContext({storageState:await api.storageState(),viewport:{width:1920,height:1080}});const teacher=await teacherContext.newPage();teacher.on('pageerror',e=>errors.push(e.message));
 await teacher.goto(origin+'/teacher');await teacher.waitForLoadState('networkidle');await teacher.getByLabel('수업 선택',{exact:true}).selectOption(a.id);await teacher.getByRole('button',{name:'학생 레시피 보기',exact:true}).click();await teacher.locator('.student-recipe-list button').nth(1).waitFor();
 await teacher.locator('.student-recipe-list button').first().click();await teacher.getByRole('dialog').waitFor();assert.equal(await teacher.locator('.two-recipes>.recipe-readout').count(),0);assert.equal(await teacher.locator('.two-recipes>div').count(),2);
 await teacher.screenshot({path:path.join(out,'teacher-recipes.png')});await teacher.keyboard.press('ArrowRight');assert.match(await teacher.locator('.recipe-presentation>header h1').innerText(),/2번/);assert.match(await teacher.locator('.two-recipes').innerText(),/달큰한 양파 향/);
 await teacher.keyboard.press('Escape');await teacher.getByRole('dialog').waitFor({state:'hidden'});
 await teacher.getByLabel('수업 선택',{exact:true}).selectOption(b.id);await teacher.getByText('이 반에 저장된 학생 기록이 아직 없습니다.',{exact:true}).waitFor();assert.equal(await teacher.locator('.student-recipe-list button').count(),0);
 await teacher.getByRole('button',{name:'직업소개·공정시연',exact:true}).click();await teacher.getByRole('button',{name:'직업 소개부터 전체화면',exact:true}).click();assert.match(await teacher.getByRole('dialog').innerText(),/맛있는 생각/);await teacher.keyboard.press('ArrowRight');assert.match(await teacher.getByRole('dialog').innerText(),/아이디어가 바로/);await teacher.screenshot({path:path.join(out,'teacher-slide.png')});await teacher.keyboard.press('Escape');await teacher.getByLabel('발표 장면',{exact:true}).selectOption('7');assert(await teacher.locator('.presenter-stage').count());
 assert.deepEqual(errors,[],'Browser errors');
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',checks:['teacher password and class creation','no inferred allergens','anonymous g records','unlimited practice records and independent tabs','copy and tasting history','toppings only in ramen tasting','allergen aggregation and unverified warning','print-only names','class isolation and owner authorization','stale revision rejects overwrite','anonymous opt-in sharing','offline/reload recovery','phone/tablet/laptop responsive layouts','teacher read-only fullscreen and keyboard','career slides and existing process demonstration'],screenshots:fs.readdirSync(out).filter(x=>x.endsWith('.png'))},null,2));
 console.log('PASS: 16 integration groups; artifacts in outputs/verification');
 await browser.close();await api.dispose();await anonymous.dispose();
})().catch(async e=>{if(global.debugPage){await global.debugPage.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});console.error((await global.debugPage.locator('body').innerText()).slice(-2200));}console.error(e);process.exit(1)});
