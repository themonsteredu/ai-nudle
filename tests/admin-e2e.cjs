/* 관리자 화면 (/admin) end-to-end checks against a LOCAL Vite/Cloudflare D1 server only.
   PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome TEST_ORIGIN=http://localhost:5221 node tests/admin-e2e.cjs
   Optional SCREENSHOT_DIR (default outputs/verification/admin).
   Covers the screen lock (1003), cost/price/supply editing, the cost-free 교사 화면, and that neither screen's save
   overwrites the other (both directions, plus a blind-vote commit with unsaved teacher edits).
   Writes prices, test ingredients and a test classroom to local D1; the ingredient, topping and supply lists are put
   back at the end so the other e2e scripts keep their fixtures. Never run against production. */
/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test script run directly by node */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4173';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname),'Use a local test database');
const out = path.resolve(process.env.SCREENSHOT_DIR || 'outputs/verification/admin');fs.mkdirSync(out,{recursive:true});
const ADMIN_PIN = '1003';
const POLL = 30000; // the teacher re-reads student projects every 5s
const sleep = ms => new Promise(r => setTimeout(r, ms));
const COST_MENUS = ['원가 자동계산','사리면 설정','시식컵 설정','최종 용기 설정','기타 소모품','수업도구','재료 단가','원가계산표 인쇄','사리면','시식컵','최종 용기'];
const COST_WORDS = ['구입가격','구입중량','단위원가','사용원가','준비비용','1인 예상 재료비','원/g'];
let debugPage = null;
const warnings = [];
const soft = (ok,message) => { if(!ok){warnings.push(message);console.warn('WARN:',message);} };

(async()=>{
 const { calculateCosts, won, roundQuantity } = await import('../lib/costs.ts');
 const api = await request.newContext({baseURL:origin});
 assert.equal((await api.post('/api/teacher/login',{data:{password:'3035'}})).status(),200);
 // Local D1 can briefly answer SQLITE_BUSY when another dev server shares it.
 async function putSettings(settings){for(let i=0;;i++){const r=await api.put('/api/settings',{data:{settings}});if(r.status()===200)return (await r.json()).settings;if(i>=5||r.status()!==500)assert.fail(`PUT /api/settings ${r.status()} ${await r.text()}`);await sleep(600);}}
 const serverSettings = async () => (await (await api.get('/api/settings')).json()).settings;
 const original = await serverSettings();
 const restore = async () => { const now = await serverSettings(); await putSettings({...now,ingredients:original.ingredients,toppings:original.toppings,supplies:original.supplies}); };
 for(const id of ['garlic-powder','onion-powder','beef-base','anchovy-base']) assert(original.ingredients.some(x=>x.id===id),`fixture ingredient ${id} missing`);
 assert(original.toppings.some(x=>x.id==='vegetable-flakes'),'fixture topping vegetable-flakes missing');
 assert(original.supplies.some(x=>x.id==='noodle'&&x.name==='사리면'),'fixture supply 사리면 missing');
 const suffix = Date.now().toString(36).slice(-4);
 const ing = (s,id) => s.ingredients.find(x=>x.id===id);
 const top = (s,id) => s.toppings.find(x=>x.id===id);
 const sup = (s,id) => s.supplies.find(x=>x.id===id);
 // Start from known prices so every change below is observable.
 await putSettings({...original,
  ingredients:original.ingredients.map(x=>x.id==='garlic-powder'?{...x,purchasePrice:0,purchaseWeight:100}:x),
  toppings:original.toppings.map(x=>x.id==='vegetable-flakes'?{...x,purchasePrice:0,purchaseWeight:100,amountPerStudent:1,enabled:true}:x),
  supplies:original.supplies.map(x=>x.id==='noodle'?{...x,purchasePrice:10000,purchaseQuantity:20,enabled:true}:x)});

 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
 const errors = [];
 const shot = (p,name,full=true) => p.screenshot({path:path.join(out,`adm-${name}.png`),fullPage:full});
 // clientWidth is the layout viewport: with isMobile a too-wide page zooms out and innerWidth grows with it.
 const overflowFailures = [];
 const noOverflow = async (p,label) => { const r = await p.evaluate(()=>{const cw=document.documentElement.clientWidth;return {sw:document.documentElement.scrollWidth,cw,wide:[...document.querySelectorAll('body *')].filter(e=>{const b=e.getBoundingClientRect();if(!(b.width>0&&b.right>cw+1))return false;for(let a=e.parentElement;a;a=a.parentElement){const o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll'||o==='hidden')return false;}return true;}).slice(0,3).map(e=>e.tagName+'.'+e.className+' width='+Math.round(e.getBoundingClientRect().width)+' right='+Math.round(e.getBoundingClientRect().right))};}); if(r.sw>r.cw+1){const m=`${label} horizontal page scroll: scrollWidth ${r.sw} > ${r.cw}; ${r.wide.join(', ')}`;overflowFailures.push(m);console.error('FAIL:',m);} };
 const newPage = async (name,options={viewport:{width:1366,height:900}}) => { const c = await browser.newContext(options); const p = await c.newPage(); p.on('pageerror',e=>errors.push(`${name}: ${e.message}`)); return p; };
 // ---- admin helpers ----
 const pinInput = p => p.getByLabel('관리자 비밀번호',{exact:true});
 async function openAdmin(p){ await p.goto(origin+'/admin'); await p.waitForLoadState('networkidle'); }
 async function waitLocked(p){ await pinInput(p).waitFor(); assert.equal(await p.locator('.admin-shell').count(),0,'admin content hidden while locked'); assert.equal(await p.getByRole('heading',{name:'원가 자동계산'}).count(),0); }
 async function unlock(p){ await pinInput(p).fill(ADMIN_PIN); await p.getByRole('button',{name:'입장하기',exact:true}).click(); await p.locator('.admin-shell').waitFor(); }
 const adminNav = (p,name) => p.locator('.teacher-sidebar').getByRole('button',{name,exact:true}).click();
 async function saveAdmin(p){
  await p.locator('.save-area').getByText('저장하지 않은 변경',{exact:true}).waitFor();
  await p.locator('.save-area').getByRole('button',{name:'설정 저장',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('.save-area i')&&document.querySelector('.save-area button')?.textContent==='설정 저장',null,{timeout:15000}).catch(async()=>assert.fail('admin save did not finish: '+await p.locator('.toast').allInnerTexts()));
  assert.match(await p.locator('.toast').innerText(),/원가 설정을 저장했어요/);
 }
 const price = (p,name) => p.getByLabel(`${name} 구입가격`,{exact:true});
 const weight = (p,name) => p.getByLabel(`${name} 구입중량`,{exact:true});
 const priceRow = (p,name) => p.locator('.adm-price-table tbody tr').filter({has:price(p,name)});
 async function supplyRow(p,name){ const rows = p.locator('.admin-table tbody tr'); const i = await rows.evaluateAll((trs,n)=>trs.findIndex(tr=>tr.querySelectorAll('input')[1]?.value===n),name); assert(i>=0,`supply row ${name}`); return rows.nth(i); }
 const costHero = p => p.locator('.cost-hero > div strong').allInnerTexts();
 const costTable = p => p.locator('.cost-table tbody tr').evaluateAll(trs=>trs.map(tr=>[...tr.children].map(c=>c.textContent.trim())));
 const expectedTable = (s,count) => calculateCosts(s,count).rows.map(r=>[r.category,r.name,`${roundQuantity(r.needed)}${r.unit}`,won(r.unitCost),won(r.usedCost),`${r.packCount}묶음`,won(r.purchaseCost)]);
 const expectedHero = (s,count) => { const c = calculateCosts(s,count); return [won(c.perStudentCost),won(c.usedCost),won(c.purchaseCost)]; };
 // ---- teacher helpers ----
 const teacherNav = (p,name) => p.locator('.teacher-sidebar').getByRole('button',{name,exact:true}).click();
 async function openTeacher(p){ await p.goto(origin+'/teacher'); await p.waitForLoadState('networkidle'); await p.locator('.teacher-sidebar').waitFor(); }
 const ingRow = (p,name) => p.locator('article.ing-row').filter({has:p.getByRole('button',{name:`${name} 위로`,exact:true})});
 async function saveTeacher(p){
  await p.locator('.save-area').getByText('저장하지 않은 변경',{exact:true}).waitFor();
  await p.locator('.save-area').getByRole('button',{name:'설정 저장',exact:true}).click();
  await p.waitForFunction(()=>!document.querySelector('.save-area i')&&document.querySelector('.save-area button')?.textContent==='설정 저장',null,{timeout:15000}).catch(async()=>assert.fail('teacher save did not finish: '+await p.locator('.toast').allInnerTexts()));
  assert.match(await p.locator('.toast').innerText(),/교사 설정을 저장했습니다/);
 }
 async function addIngredient(p,name,kind){
  await teacherNav(p,'스프·첨가물 관리');await p.getByRole('heading',{name:'스프·첨가물 관리',exact:true}).waitFor();
  const form = p.locator('form.ing-add');await form.locator('input').fill(name);await form.locator('select').selectOption(kind);
  await form.getByRole('button',{name:'＋ 추가',exact:true}).click();await ingRow(p,name).waitFor();
 }
 const toppingCard = (p,name) => p.locator('.ingredient-admin-list article.admin-item').filter({has:p.locator('h3',{hasText:new RegExp(`^${name}$`)})});

 try {
 // ================= 1. Screen lock =================
 const admin = await newPage('admin');debugPage = admin;
 const apiBeforeUnlock = [];
 const trackApi = r => { if(new URL(r.url()).pathname.startsWith('/api/')) apiBeforeUnlock.push(r.method()+' '+new URL(r.url()).pathname); };
 admin.on('request',trackApi);
 await openAdmin(admin);await waitLocked(admin);
 assert.equal(await admin.getByRole('heading',{name:'관리자 화면',exact:true}).count(),1);
 assert(await admin.getByRole('button',{name:'입장하기',exact:true}).isDisabled(),'enter is disabled with no PIN');
 await shot(admin,'desktop-lock');
 for(const wrong of ['0000','3035','10031','1004']){
  await pinInput(admin).fill(wrong);await admin.getByRole('button',{name:'입장하기',exact:true}).click();
  await admin.getByRole('alert').getByText('비밀번호가 맞지 않아요.',{exact:true}).waitFor();
  assert.equal(await pinInput(admin).inputValue(),'',`wrong PIN ${wrong} is cleared`);
  assert.equal(await admin.locator('.admin-shell').count(),0,`wrong PIN ${wrong} is refused`);
 }
 assert.equal(await admin.evaluate(()=>sessionStorage.getItem('ramen-admin-unlocked')),null,'wrong PINs store no unlock');
 admin.off('request',trackApi);
 soft(!apiBeforeUnlock.some(x=>/\/api\/(settings|teacher)/.test(x)),`locked /admin called the API before the PIN: ${apiBeforeUnlock.join(', ')}`);
 await unlock(admin);
 await admin.getByRole('heading',{name:'원가 자동계산',exact:true}).waitFor();
 assert.equal(await admin.getByRole('alert').count(),0,'no error after unlock');
 const adminMenus = await admin.locator('.teacher-sidebar nav button').allInnerTexts();
 assert.deepEqual(adminMenus,['원가 자동계산','재료 단가','원가계산표 인쇄','사리면','시식컵','최종 용기','기타 소모품','수업도구']);
 // Reload in the same tab stays unlocked.
 await admin.reload();await admin.locator('.admin-shell').waitFor();assert.equal(await pinInput(admin).count(),0,'reload keeps the tab unlocked');
 // '잠그고 나가기' locks, and the lock survives a reload.
 await admin.getByRole('button',{name:'잠그고 나가기',exact:true}).click();await waitLocked(admin);
 await admin.reload();await admin.waitForLoadState('networkidle');await waitLocked(admin);
 await unlock(admin);
 // Another browser (context) starts locked.
 const other = await newPage('admin-other');await openAdmin(other);await waitLocked(other);
 // A new tab opened by typing the address in the same browser (shared cookies, fresh sessionStorage) is locked too.
 const sameBrowserNewTab = await admin.context().newPage();await openAdmin(sameBrowserNewTab);await waitLocked(sameBrowserNewTab);await sameBrowserNewTab.close();

 // ================= 4a setup: teacher screen opened BEFORE the admin edits prices =================
 const teacher = await newPage('teacher');
 await openTeacher(teacher);
 const teacherOpenedWith = await serverSettings();
 assert.equal(ing(teacherOpenedWith,'garlic-powder').purchasePrice,0);

 // ================= 2. Admin edits prices and a supply =================
 debugPage = admin;
 const before = await serverSettings();
 await adminNav(admin,'원가 자동계산');
 assert.deepEqual(await costHero(admin),expectedHero(before,before.studentCount),'cost hero before edits');
 const heroBefore = await costHero(admin);
 await adminNav(admin,'재료 단가');await admin.getByRole('heading',{name:'재료 단가',exact:true}).waitFor();
 assert.equal(await admin.locator('.adm-price-table tbody tr').count(),before.ingredients.length+before.toppings.length,'price table lists every ingredient and topping');
 await price(admin,'마늘분말').fill('5000');await weight(admin,'마늘분말').fill('250');
 assert.match(await priceRow(admin,'마늘분말').innerText(),/20\.0원\/g/);
 await price(admin,'야채 후레이크').fill('8000');await weight(admin,'야채 후레이크').fill('400');
 assert.match(await priceRow(admin,'야채 후레이크').innerText(),/20\.0원\/g/);
 // The amount the cost is calculated with is shown next to the price (it is set on the 교사 화면).
 const garlicAmount = ing(before,'garlic-powder').defaultAmount;
 assert.match(await priceRow(admin,'마늘분말').innerText(),garlicAmount>0?new RegExp(`기본 투입량 ${garlicAmount}g`):/기본 투입량 0g[\s\S]*원가 0원/,'마늘분말 row shows the amount its cost uses');
 assert.match(await priceRow(admin,'야채 후레이크').innerText(),new RegExp(`1인 ${top(before,'vegetable-flakes').amountPerStudent}g`),'topping row shows 1인 사용량');
 await noOverflow(admin,'admin prices desktop');await shot(admin,'desktop-prices');
 const priceWraps = await admin.locator('.adm-price-block .supply-table-wrap').evaluateAll(ws=>ws.map(w=>[w.scrollWidth,w.clientWidth]));
 assert(priceWraps.length===2&&priceWraps.every(([sw,cw])=>sw<=cw+1),`price tables fit a 1366px screen without sideways scrolling: ${JSON.stringify(priceWraps)}`);
 await adminNav(admin,'사리면');await admin.getByRole('heading',{name:'사리면 설정',exact:true}).waitFor();
 const noodle = await supplyRow(admin,'사리면');
 assert.equal(await noodle.locator('input').nth(3).inputValue(),'10000');
 await noodle.locator('input').nth(3).fill('12000');
 assert.match(await noodle.innerText(),/600원/,'사리면 unit cost 12000/20');
 await shot(admin,'desktop-supply-noodle');
 // A lost connection shows Korean text (not the browser's 'Failed to fetch') and keeps the edits.
 await admin.route('**/api/settings',r=>r.abort());
 await admin.locator('.save-area').getByRole('button',{name:'설정 저장',exact:true}).click();
 await admin.locator('.toast').getByText('저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.',{exact:true}).waitFor();
 await admin.unroute('**/api/settings');
 assert.equal(await admin.locator('.save-area i').count(),1,'a failed save keeps the unsaved badge');
 // The server's teacher session ends after 8 hours; the save opens a new one by itself.
 await admin.context().clearCookies();
 await saveAdmin(admin);
 let s = await serverSettings();
 assert.deepEqual([ing(s,'garlic-powder').purchasePrice,ing(s,'garlic-powder').purchaseWeight],[5000,250],'garlic price saved');
 assert.deepEqual([top(s,'vegetable-flakes').purchasePrice,top(s,'vegetable-flakes').purchaseWeight],[8000,400],'topping price saved');
 assert.equal(sup(s,'noodle').purchasePrice,12000,'사리면 price saved');
 assert.equal(s.classes.length,before.classes.length,'admin save keeps the classes');
 // 원가 자동계산 follows.
 await adminNav(admin,'원가 자동계산');
 const heroAfter = await costHero(admin);
 assert.deepEqual(heroAfter,expectedHero(s,s.studentCount),'cost hero after edits');
 assert.notDeepEqual(heroAfter,heroBefore,'cost numbers changed');
 assert.deepEqual(await costTable(admin),expectedTable(s,s.studentCount),'cost table rows');
 const tableNow = await costTable(admin);
 assert.deepEqual(tableNow.find(r=>r[1]==='사리면'),['용기·소모품','사리면',`${s.studentCount*2}개`,'600원',won(600*s.studentCount*2),`${Math.ceil(s.studentCount*2/20)}묶음`,won(Math.ceil(s.studentCount*2/20)*12000)]);
 assert.equal(tableNow.find(r=>r[1]==='마늘분말')[3],'20원','마늘분말 unit cost in the cost table');
 assert.equal(tableNow.find(r=>r[1]==='야채 후레이크')[4],won(20*s.studentCount),'야채 후레이크 used cost');
 await admin.locator('.count-picker').getByRole('button',{name:'20명',exact:true}).click();
 assert.deepEqual(await costHero(admin),expectedHero(s,20),'cost hero follows the student count');
 await noOverflow(admin,'admin cost desktop');await shot(admin,'desktop-cost');
 // 원가계산표 인쇄
 await adminNav(admin,'원가계산표 인쇄');
 await admin.locator('.print-document h1',{hasText:'원가계산표'}).waitFor();
 const summary = calculateCosts(s);
 assert.equal(await admin.locator('.print-cost-summary').innerText().then(t=>t.replace(/\s+/g,' ').trim()),`1인 ${won(summary.perStudentCost)} 사용원가 ${won(summary.usedCost)} 준비비용 ${won(summary.purchaseCost)}`);
 assert.deepEqual(await costTable(admin),expectedTable(s,s.studentCount),'print table rows');
 assert.equal(await admin.getByRole('button',{name:'인쇄 / PDF',exact:true}).count(),1);
 await shot(admin,'desktop-print');
 await admin.emulateMedia({media:'print'});await shot(admin,'desktop-print-media');await admin.emulateMedia({media:'screen'});

 // ================= 4a. Teacher (opened before the price change) saves: admin prices stay =================
 debugPage = teacher;
 const additive = `검증첨가물${suffix}`;
 await addIngredient(teacher,additive,'향');
 await saveTeacher(teacher);
 s = await serverSettings();
 assert(s.ingredients.some(x=>x.name===additive),'teacher additive saved');
 assert.deepEqual([ing(s,'garlic-powder').purchasePrice,ing(s,'garlic-powder').purchaseWeight],[5000,250],'4a: teacher save keeps the admin ingredient price');
 assert.deepEqual([top(s,'vegetable-flakes').purchasePrice,top(s,'vegetable-flakes').purchaseWeight],[8000,400],'4a: teacher save keeps the admin topping price');
 assert.equal(sup(s,'noodle').purchasePrice,12000,'4a: teacher save keeps the admin supply');

 // ================= 4b. Admin (opened before the teacher change) saves: teacher changes stay =================
 const added = `검증추가${suffix}`;const renamed = `양파분말 검증${suffix}`;
 await addIngredient(teacher,added,'짠맛');
 await ingRow(teacher,'양파분말').locator('.ing-name input').fill(renamed);
 await teacherNav(teacher,'건더기 관리');
 await toppingCard(teacher,'야채 후레이크').getByLabel('1인 사용량 (g)',{exact:true}).fill('2');
 await saveTeacher(teacher);
 s = await serverSettings();
 assert(s.ingredients.some(x=>x.name===added),'teacher ingredient saved');assert.equal(ing(s,'onion-powder').displayName,renamed);assert.equal(top(s,'vegetable-flakes').amountPerStudent,2);
 debugPage = admin;
 assert(await admin.locator('.save-area button').isDisabled(),'admin has nothing unsaved');
 await adminNav(admin,'재료 단가');
 assert.equal(await price(admin,added).count(),0,'admin screen is stale (opened before the teacher change)');
 await price(admin,'마늘분말').fill('6000');
 await saveAdmin(admin);
 s = await serverSettings();
 assert(s.ingredients.some(x=>x.name===added),'4b: admin save keeps the teacher\'s new ingredient');
 assert(s.ingredients.some(x=>x.name===additive),'4b: admin save keeps the earlier additive');
 assert.equal(ing(s,'onion-powder').displayName,renamed,'4b: admin save keeps the teacher\'s rename');
 assert.equal(top(s,'vegetable-flakes').amountPerStudent,2,'4b: admin save keeps the teacher\'s topping amount');
 assert.deepEqual([ing(s,'garlic-powder').purchasePrice,ing(s,'garlic-powder').purchaseWeight],[6000,250],'4b: admin price saved');
 assert.equal(top(s,'vegetable-flakes').purchasePrice,8000);assert.equal(sup(s,'noodle').purchasePrice,12000);
 await price(admin,added).waitFor();await price(admin,renamed).waitFor(); // the admin screen picked up the newest list
 // A delete on the teacher screen is not undone by a stale admin save.
 debugPage = teacher;
 await teacherNav(teacher,'스프·첨가물 관리');
 teacher.once('dialog',d=>void d.accept());
 await ingRow(teacher,added).getByRole('button',{name:'삭제',exact:true}).click();await ingRow(teacher,added).waitFor({state:'detached'});
 await saveTeacher(teacher);
 debugPage = admin;
 await price(admin,added).fill('777');await price(admin,'야채 후레이크').fill('8500');
 await saveAdmin(admin);
 s = await serverSettings();
 assert(!s.ingredients.some(x=>x.name===added),'4b: a stale admin save does not bring back a deleted ingredient');
 assert.equal(top(s,'vegetable-flakes').purchasePrice,8500);
 assert.equal(await price(admin,added).count(),0,'deleted ingredient leaves the admin price table after saving');

 // ================= 3. 교사 화면 has no cost data =================
 const t2 = await newPage('teacher2');debugPage = t2;
 await openTeacher(t2);
 const menus = await t2.locator('.teacher-sidebar nav button').allInnerTexts();
 for(const m of COST_MENUS) assert(!menus.includes(m),`teacher menu must not have ${m}`);
 assert(!(await t2.locator('.teacher-sidebar nav > div > span').allInnerTexts()).includes('원가'),'no 원가 menu group');
 // Every teacher section: no prices, no cost words.
 const moneyLike = /\d[\d,]*\s?원(?![가-힣])/;
 for(const m of menus){
  await teacherNav(t2,m);await t2.waitForTimeout(250);
  // Panel descriptions may point to the admin screen ("구입가격은 관리자 화면 '재료 단가'에서 적어요"); everything else must be cost-free.
  const text = await t2.locator('.teacher-main').evaluate(main=>{const c=main.cloneNode(true);c.querySelectorAll('.teacher-panel-head p').forEach(x=>x.remove());c.querySelectorAll('*').forEach(x=>x.append(' '));return c.textContent;});
  const head = await t2.locator('.teacher-panel-head p').allInnerTexts();
  for(const h of head) assert(!COST_WORDS.some(w=>h.includes(w))||h.includes('관리자 화면'),`teacher '${m}' description mentions cost: ${h}`);
  for(const w of COST_WORDS) assert(!text.includes(w),`teacher '${m}' shows '${w}'`);
  assert(!moneyLike.test(text),`teacher '${m}' shows a money amount: ${text.match(moneyLike)?.[0]}`);
 }
 await teacherNav(t2,'스프·첨가물 관리');
 await ingRow(t2,'마늘분말').getByRole('button',{name:'자세히',exact:true}).click();
 const detail = ingRow(t2,'마늘분말').locator('.ing-detail');await detail.waitFor();
 const fieldLabels = await detail.locator('.admin-field > span').allInnerTexts();
 assert(fieldLabels.length>0&&!fieldLabels.some(x=>/구입가격|구입중량|\(원\)/.test(x)),`ingredient detail fields: ${fieldLabels}`);
 assert.equal(await detail.locator('.calculated-field').count(),0,'no 자동계산 unit cost in the ingredient detail');
 assert(!/원\/g|구입가격|구입중량/.test(await detail.innerText()));
 await shot(t2,'teacher-ingredient-detail',false);
 await teacherNav(t2,'건더기 관리');
 const toppingLabels = await t2.locator('.ingredient-admin-list .admin-field > span').allInnerTexts();
 assert(toppingLabels.length>0&&!toppingLabels.some(x=>/구입가격|구입중량|\(원\)/.test(x)),`topping fields: ${[...new Set(toppingLabels)]}`);
 assert.equal(await t2.locator('.ingredient-admin-list .calculated-field').count(),0);
 await teacherNav(t2,'교사용 PDF');
 assert.deepEqual(await t2.locator('.document-tabs button').allInnerTexts(),['수업지도안','준비물 체크리스트','학생 실험 기록지'],'no 원가계산표 tab');
 for(const tab of ['수업지도안','준비물 체크리스트','학생 실험 기록지']){
  await t2.locator('.document-tabs').getByRole('button',{name:tab,exact:true}).click();
  const text = await t2.locator('.print-document').innerText();
  assert(!moneyLike.test(text)&&!text.includes('원가계산표'),`PDF '${tab}' has cost data`);
 }
 // Sidebar link leads to the lock.
 const adminLink = t2.locator('.teacher-sidebar').getByRole('link',{name:'관리자 화면 (원가) →',exact:true});
 assert.equal(await adminLink.count(),1,'teacher sidebar links to the admin screen');
 await adminLink.click();await t2.waitForURL(/\/admin$/);await waitLocked(t2);
 await t2.getByRole('link',{name:'← 교사 화면',exact:true}).click();await t2.waitForURL(/\/teacher$/);await t2.locator('.teacher-sidebar').waitFor();
 // With unsaved teacher edits the link asks first (cancel keeps the screen).
 await teacherNav(t2,'스프·첨가물 관리');
 await ingRow(t2,'설탕').locator('.switch-label').click();
 let leaveText='';t2.once('dialog',d=>{leaveText=d.message();void d.dismiss();});
 await adminLink.click();await t2.waitForTimeout(400);
 assert(leaveText,'unsaved teacher edits: the admin link asks before leaving');
 assert(/\/teacher$/.test(t2.url()),'cancel stays on the teacher screen');
 assert(/관리자 화면으로 갈까요/.test(leaveText)&&!/학생 화면/.test(leaveText),`teacher admin-link confirm names the admin screen: "${leaveText.replace(/\n/g,' ')}"`);
 await t2.context().close();

 // Admin-side leave: unsaved prices and '← 교사 화면으로'.
 debugPage = admin;
 await adminNav(admin,'재료 단가');
 await price(admin,'마늘분말').fill('6100');
 const adminToTeacher = admin.getByRole('link',{name:'← 교사 화면으로',exact:true});
 let adminLeave='';admin.once('dialog',d=>{adminLeave=d.message();void d.dismiss();});
 await adminToTeacher.click();await admin.waitForTimeout(800);
 assert.match(adminLeave,/저장하지 않은 변경이 있어요[\s\S]*교사 화면으로 갈까요/,'unsaved admin prices: the link asks before leaving');
 assert(/\/admin$/.test(admin.url()),'cancel stays on the admin screen');
 assert.equal(await price(admin,'마늘분말').inputValue(),'6100','cancel keeps the typed price');
 // Accepting leaves without saving, and leaving locks the screen: the 교사 화면 link asks for the PIN again.
 admin.once('dialog',d=>void d.accept());
 await adminToTeacher.click();await admin.waitForURL(/\/teacher$/);await admin.locator('.teacher-sidebar').waitFor();
 assert.equal(await admin.evaluate(()=>sessionStorage.getItem('ramen-admin-unlocked')),null,'leaving clears the unlock');
 const teacherToAdmin = admin.locator('.teacher-sidebar').getByRole('link',{name:'관리자 화면 (원가) →',exact:true});
 await teacherToAdmin.click();await admin.waitForURL(/\/admin$/);await waitLocked(admin);
 await unlock(admin);await adminNav(admin,'재료 단가');
 assert.equal(await price(admin,'마늘분말').inputValue(),'6000','unsaved 6100 was not saved');
 // The browser's back button returns to the lock, not to the open screen.
 await adminToTeacher.click();await admin.waitForURL(/\/teacher$/);await admin.locator('.teacher-sidebar').waitFor();
 await admin.goBack();await admin.waitForURL(/\/admin$/);await waitLocked(admin);
 // Leaving an open admin screen with the back button locks it as well (forward shows the lock).
 await unlock(admin);
 await admin.goBack();await admin.waitForURL(/\/teacher$/);await admin.locator('.teacher-sidebar').waitFor();
 await admin.goForward();await admin.waitForURL(/\/admin$/);await waitLocked(admin);
 await unlock(admin);await adminNav(admin,'재료 단가');
 assert.equal(ing(await serverSettings(),'garlic-powder').purchasePrice,6000);

 // ================= 4c. Blind-vote commit with unsaved teacher edits keeps admin prices =================
 const settings = await serverSettings();
 const used = new Set(settings.classes.map(c=>c.code));
 let code; do code = String(100000 + Math.floor(Math.random()*900000)); while (used.has(code));
 const lesson = { id:crypto.randomUUID(), name:`관리자 검증반 ${code}`, code, waterMl:110, cookMinutes:3, noodleFraction:.25, groupCount:4 };
 settings.classes.push(lesson);await putSettings(settings);
 const anonymous = await request.newContext({baseURL:origin});
 const enabled = (await serverSettings()).ingredients.filter(x=>x.enabled).sort((a,b)=>a.order-b.order).map(x=>x.displayName||x.name);
 const local = p => p.evaluate(id=>{const pid=localStorage.getItem('ramen-active:'+id);return JSON.parse(localStorage.getItem('ramen-notebook:'+pid));},lesson.id);
 async function serverProject(p,check,label){const st=await local(p);const deadline=Date.now()+POLL;for(;;){const r=await anonymous.get('/api/students?id='+st.project.id,{headers:{'x-class-code':code,'x-student-key':st.key}});const project=r.status()===200?(await r.json()).project:null;if(project&&check(project))return project;if(Date.now()>deadline)assert.fail(`server record never matched: ${label}`);await sleep(500);}}
 const nav = (p,name) => p.locator('.student-nav').getByRole('button',{name,exact:true});
 async function submitGroup(group,grams){
  const p = await newPage('student'+group,{viewport:{width:390,height:844},isMobile:true,hasTouch:true});debugPage = p;
  await p.goto(origin);await p.waitForLoadState('networkidle');
  await p.getByLabel('수업 코드',{exact:true}).fill(code);await p.getByRole('button',{name:'기록 시작하기',exact:true}).click();
  await p.getByRole('heading',{name:'우리 모둠은 몇 모둠인가요?',exact:true}).waitFor();await p.getByRole('button',{name:`${group}모둠`,exact:true}).click();
  await p.getByRole('button',{name:'국물 연습 추가',exact:true}).waitFor();
  await nav(p,'레시피 기록').click();await p.getByRole('button',{name:'라면 기록 쓰기',exact:true}).click();
  await p.getByLabel(`${enabled[group-1]} 양(g)`,{exact:true}).fill(grams);await p.getByLabel('맛 느낌 한 줄',{exact:true}).fill(`검증 노트 ${group}`);
  await nav(p,'모둠 베스트 제출').click();await p.getByText('미제출',{exact:true}).waitFor();
  // The class uses the 기본 베이스 only: no record picker, the 라면 시식 record is submitted.
  assert.equal(await p.getByLabel('제출할 라면 기록',{exact:true}).count(),0,'no 제출할 라면 기록 picker');
  await p.getByLabel('라면 이름',{exact:true}).fill(`검증 라면 ${group}`);await p.getByLabel('한 줄 소개',{exact:true}).fill(`검증 소개 ${group}`);await p.getByLabel('맵기 단계',{exact:true}).selectOption('1');
  p.once('dialog',d=>void d.accept());
  await p.getByRole('button',{name:'모둠 베스트 레시피 제출',exact:true}).click();
  await p.locator('.gb-sub-status.done').getByText('제출 완료',{exact:true}).waitFor();
  const saved = await serverProject(p,x=>x.notebook?.final?.shared===true,`group ${group} submission`);
  assert.equal(saved.notebook.final.method,'base');assert.equal(saved.notebook.final.record.id,saved.notebook.base.tasting.id,'the 기본 베이스 라면 시식 record is submitted');
  return saved;
 }
 await submitGroup(1,'1.2');await submitGroup(2,'0.9');
 const t3 = await newPage('teacher3');debugPage = t3;
 await openTeacher(t3);
 await t3.getByLabel('수업 선택',{exact:true}).selectOption(lesson.id);
 // Unsaved teacher edits made on a screen that still has the old prices.
 await teacherNav(t3,'건더기 관리');
 await toppingCard(t3,'야채 후레이크').getByLabel('1인 사용량 (g)',{exact:true}).fill('3');
 await teacherNav(t3,'스프·첨가물 관리');
 await ingRow(t3,'마늘분말').locator('.ing-name input').fill(`마늘분말 투표${suffix}`);
 await t3.locator('.save-area').getByText('저장하지 않은 변경',{exact:true}).waitFor();
 // Admin changes prices now.
 debugPage = admin;
 await adminNav(admin,'재료 단가');
 await price(admin,'야채 후레이크').fill('9000');await weight(admin,'마늘분말').fill('300');
 await adminNav(admin,'시식컵');await admin.getByRole('heading',{name:'시식컵 설정',exact:true}).waitFor();
 const cup = await supplyRow(admin,'시식컵');await cup.locator('input').nth(3).fill('5500');
 await saveAdmin(admin);
 s = await serverSettings();
 assert.equal(top(s,'vegetable-flakes').purchasePrice,9000);assert.equal(ing(s,'garlic-powder').purchaseWeight,300);assert.equal(sup(s,'tasting-cup').purchasePrice,5500);
 // Teacher starts the blind vote with those unsaved edits.
 debugPage = t3;
 await teacherNav(t3,'모둠 베스트·블라인드 투표');
 await t3.waitForFunction(()=>document.querySelector('.gb-count')?.textContent==='2 / 4 모둠 제출',null,{timeout:POLL});
 t3.once('dialog',d=>void d.accept());
 await t3.getByRole('button',{name:'블라인드 테스트 시작',exact:true}).click();
 await t3.locator('.gb-status.voting').waitFor();
 await t3.getByText(/저장하지 않았던 설정도 함께 저장했어요/).waitFor();
 s = await serverSettings();
 const round = s.classes.find(c=>c.id===lesson.id).blindRound;
 assert.equal(round?.status,'voting','blind round saved');assert.equal(round.samples.length,2);
 assert.equal(top(s,'vegetable-flakes').amountPerStudent,3,'4c: unsaved topping edit saved with the vote');
 assert.equal(ing(s,'garlic-powder').displayName,`마늘분말 투표${suffix}`,'4c: unsaved rename saved with the vote');
 assert.equal(top(s,'vegetable-flakes').purchasePrice,9000,'4c: blind-vote commit keeps the admin topping price');
 assert.deepEqual([ing(s,'garlic-powder').purchasePrice,ing(s,'garlic-powder').purchaseWeight],[6000,300],'4c: blind-vote commit keeps the admin ingredient price');
 assert.equal(sup(s,'tasting-cup').purchasePrice,5500,'4c: blind-vote commit keeps the admin supply');
 assert.equal(sup(s,'noodle').purchasePrice,12000);
 assert.equal(await t3.locator('.save-area i').count(),0,'teacher edits are saved');
 // Vote commit without local edits (close) also keeps prices.
 await adminNav(admin,'재료 단가');await price(admin,'야채 후레이크').fill('9100');await saveAdmin(admin);
 t3.once('dialog',d=>void d.accept());
 await t3.getByRole('button',{name:'투표 마감',exact:true}).click();await t3.locator('.gb-status.closed').waitFor({timeout:10000});
 await t3.getByText('투표를 마감했어요.',{exact:true}).waitFor();
 s = await serverSettings();
 assert.equal(s.classes.find(c=>c.id===lesson.id).blindRound.status,'closed');
 assert.equal(top(s,'vegetable-flakes').purchasePrice,9100,'4c: later vote change keeps the newer admin price');
 // The admin screen reloads to show what the teacher saved.
 await admin.reload();await admin.locator('.admin-shell').waitFor();await adminNav(admin,'재료 단가');
 await price(admin,`마늘분말 투표${suffix}`).waitFor();

 // ================= 5. Phone layout =================
 const phone = await newPage('phone',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});debugPage = phone;
 await openAdmin(phone);await waitLocked(phone);
 await noOverflow(phone,'phone admin lock');await shot(phone,'phone-lock');
 await unlock(phone);await phone.getByRole('heading',{name:'원가 자동계산',exact:true}).waitFor();
 await noOverflow(phone,'phone admin cost');await shot(phone,'phone-cost');
 await adminNav(phone,'재료 단가');await phone.getByRole('heading',{name:'재료 단가',exact:true}).waitFor();
 await noOverflow(phone,'phone admin prices');await shot(phone,'phone-prices');
 const box = await price(phone,'쇠고기 조미분말').boundingBox();
 assert(box&&box.x>=0&&box.x<390,'price input reachable on a phone (horizontal table scroll)');
 await adminNav(phone,'사리면');await phone.getByRole('heading',{name:'사리면 설정',exact:true}).waitFor();
 await noOverflow(phone,'phone admin supplies');await shot(phone,'phone-supply');
 await adminNav(phone,'원가계산표 인쇄');await phone.locator('.print-document').waitFor();
 await noOverflow(phone,'phone admin print');await shot(phone,'phone-print');
 for(const btn of await phone.locator('.teacher-sidebar nav button').all()){const b=await btn.boundingBox();soft(b&&b.height>=40,`phone admin menu button height ${b?.height}`);}
 const toTeacher = await phone.getByRole('link',{name:'← 교사 화면으로',exact:true}).boundingBox();
 soft(toTeacher&&toTeacher.height>=44,`phone '← 교사 화면으로' height ${toTeacher?.height}`);
 const lockBtn = await phone.getByRole('button',{name:'잠그고 나가기',exact:true}).boundingBox();
 soft(lockBtn&&lockBtn.height>=40,`phone '잠그고 나가기' height ${lockBtn?.height}`);
 await shot(phone,'phone-admin-sidebar',false);
 const tp = await newPage('phone-teacher',{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});debugPage = tp;
 await openTeacher(tp);
 const link = tp.locator('.teacher-sidebar').getByRole('link',{name:'관리자 화면 (원가) →',exact:true});
 await link.scrollIntoViewIfNeeded();
 const lb = await link.boundingBox();
 assert(lb&&lb.width>0&&lb.x>=0&&lb.x+lb.width<=391,'teacher admin link visible on a phone');
 soft(lb.height>=44,`phone teacher admin link height ${lb.height}`);
 await noOverflow(tp,'phone teacher');await shot(tp,'phone-teacher-sidebar',false);await shot(tp,'phone-teacher-full');
 await link.tap();await tp.waitForURL(/\/admin$/);await waitLocked(tp);await noOverflow(tp,'phone teacher->admin lock');

 assert.deepEqual(overflowFailures,[],'No horizontal page scroll');
 assert.deepEqual(errors,[],'Browser errors');
 fs.writeFileSync(path.join(out,'admin-results.json'),JSON.stringify({status:'PASS',warnings,screenshots:fs.readdirSync(out).filter(x=>x.startsWith('adm-'))},null,2));
 console.log(`PASS: admin lock, prices/supplies/cost, cost-free teacher screen, overwrite safety (4a/4b/4c), phone layout${warnings.length?`; ${warnings.length} warning(s):\n - `+warnings.join('\n - '):''}`);
 } catch(e) {
  if(debugPage){await debugPage.screenshot({path:path.join(out,'adm-failure.png'),fullPage:true}).catch(()=>{});console.error((await debugPage.locator('body').innerText().catch(()=>'')).slice(-2200));}
  throw e;
 } finally {
  await restore().catch(e=>console.error('restore failed',e));
  await browser.close();await api.dispose();
 }
})().catch(e=>{console.error(e);if(warnings.length)console.error('warnings:\n - '+warnings.join('\n - '));process.exit(1);});
