/* Real media playback checks against a local server. No student or class writes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const origin = process.env.TEST_ORIGIN || 'http://127.0.0.1:4174';
assert(['127.0.0.1','localhost'].includes(new URL(origin).hostname));
const out = path.resolve('outputs/verification/process-video');
fs.mkdirSync(out, {recursive:true});
(async()=>{
  const { RAMEN_PROCESS_STEPS } = await import('../lib/ramen-process.ts');
  const api = await request.newContext({baseURL:origin});
  assert.equal((await api.post('/api/teacher/login',{data:{password:'3035'}})).status(),200);
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});
  const context = await browser.newContext({storageState:await api.storageState(),viewport:{width:1920,height:1080}});
  const page = await context.newPage();
  global.testPage=page;
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const playing = async tone => {
    await page.waitForFunction(tone=>{
      const v=document.querySelector('.factory-motion-scene video');
      return v?.currentSrc.endsWith('/'+tone+'.mp4') && !v.paused && v.readyState>=2 && v.currentTime>0.12 && v.getVideoPlaybackQuality().totalVideoFrames>0;
    },tone,{timeout:12000});
  };
  await page.goto(origin+'/teacher');
  await page.getByRole('button',{name:'직업소개·공정시연',exact:true}).click();
  await page.getByRole('button',{name:'유탕 영상 바로 보기',exact:true}).click();
  await page.getByRole('dialog',{name:'라면 공정 영상'}).waitFor();
  await playing('dry');
  assert.equal(await page.locator('video').evaluate(v=>v.loop),true);
  await page.locator('video').evaluate(v=>{v.currentTime=2;});
  await page.screenshot({path:path.join(out,'frying-projector.png')});
  await page.getByRole('button',{name:'영상 일시정지',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('video').paused);
  const stopped=await page.locator('video').evaluate(v=>v.currentTime);
  await page.waitForTimeout(300);
  assert(Math.abs(await page.locator('video').evaluate(v=>v.currentTime)-stopped)<0.1);
  await page.getByRole('button',{name:'이 영상 재생',exact:true}).click();
  await playing('dry');
  await page.locator('video').evaluate(v=>{v.currentTime=v.duration-0.2;});
  await page.waitForFunction(()=>{const v=document.querySelector('video');return v.currentTime<1 && !v.paused;});
  assert.match(await page.locator('video').getAttribute('src'),/dry.mp4$/);
  await page.keyboard.press('ArrowRight');
  await playing('cool');
  await page.keyboard.press('ArrowLeft');
  await playing('dry');
  await page.keyboard.press('Escape');
  assert(await page.locator('video').evaluate(v=>v.paused));
  for(const [label,width,height] of [['laptop',1366,768],['tablet',768,1024],['phone',390,844]]){
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'유탕 영상 바로 보기',exact:true}).click();
    await playing('dry');
    assert(await page.locator('.lesson-fullscreen').evaluate(el=>el.scrollWidth<=el.clientWidth+1),label+' overflow');
    await page.screenshot({path:path.join(out,'frying-'+label+'.png')});
    await page.getByRole('button',{name:'닫기 (ESC)',exact:true}).click();
    assert(await page.locator('video').evaluate(v=>v.paused));
  }
  await page.setViewportSize({width:1366,height:768});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.getByRole('button',{name:'공정 영상 바로 보기',exact:true}).click();
  for(let i=0;i<RAMEN_PROCESS_STEPS.length;i++){
    await page.locator('.presenter-timeline button').nth(i).click();
    await playing(RAMEN_PROCESS_STEPS[i].tone);
    assert.equal(await page.locator('.presenter-timeline [aria-current=step]').count(),1);
  }
  // Automatic advancement follows the end of the actual video, and stops at the last.
  await page.locator('.presenter-timeline button').nth(7).click();
  await playing('pack');
  await page.getByRole('button',{name:'전체 공정 자동 넘김',exact:true}).click();
  assert.equal(await page.locator('video').evaluate(v=>v.loop),false);
  await page.locator('video').evaluate(v=>{v.currentTime=v.duration-0.2;});
  await playing('check');
  await page.locator('video').evaluate(v=>{v.currentTime=v.duration-0.2;});
  await page.getByRole('button',{name:'전체 공정 자동 넘김',exact:true}).waitFor();
  assert(await page.locator('video').evaluate(v=>v.paused));
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'직업 소개부터 전체화면',exact:true}).click();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.career-reveal.shown').count(),1);
  assert.equal(await page.locator('video').count(),0);
  await page.keyboard.press('Escape');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:'PASS',videos:9,checks:['direct frying shortcut','real decoded playback','pause and resume','single video loop','previous and next keys','close pauses media','nine original videos','video-ended auto advance','last video stops','explicit playback with reduced motion','projector laptop tablet phone','career slides preserved']},null,2));
  await browser.close();await api.dispose();
  console.log('PASS: original frying video, all nine process clips, playback controls and responsive entry points');
})().catch(async error=>{
  await global.testPage?.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});
  console.error(error);process.exit(1);
});
