/* Read-only presentation checks against a LOCAL server. No classroom/student writes.
   PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome node tests/career-e2e.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium, request } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");
const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:4173";
assert(["127.0.0.1", "localhost"].includes(new URL(origin).hostname), "Local server only");
const out = path.resolve("outputs/verification/career");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { CAREER_SLIDES, CAREER_DURATION_SECONDS } = await import("../lib/career-slides.ts");
  assert.equal(CAREER_DURATION_SECONDS, 600);
  assert.equal(CAREER_SLIDES.length, 13);
  const api = await request.newContext({ baseURL: origin });
  assert.equal((await api.post("/api/teacher/login", { data: { password: "3035" } })).status(), 200);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ storageState: await api.storageState(), viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  global.testPage = page;
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(origin + "/teacher");
  await page.getByRole("button", { name: "직업소개·공정시연", exact: true }).click();
  assert.equal(await page.getByLabel("발표 장면", { exact: true }).locator("option").count(), 22);
  await page.getByRole("button", { name: "직업 소개부터 전체화면", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(await page.locator(".career-reveal.shown").count(), 0);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelectorAll(".career-reveal.shown").length === 1);
  assert.equal(await page.locator(".career-reveal[aria-hidden=true]").count(), 3);
  await page.keyboard.press("ArrowLeft");
  await page.waitForFunction(() => document.querySelectorAll(".career-reveal.shown").length === 0);
  for (let n = 0; n < 4; n++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForFunction(n => document.querySelectorAll(".career-reveal.shown").length === n, n + 1);
  }
  assert(await page.locator(".career-slide blockquote").isVisible());
  await page.waitForFunction(() => [...document.querySelectorAll(".career-reveal.shown, .career-title-enter")].every(e => getComputedStyle(e).opacity === "1"));
  await page.screenshot({ path: path.join(out, "career-projector.png") });
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector(".career-slide h2")?.textContent.includes("무슨 일"));
  assert.equal(await page.locator(".career-reveal.shown").count(), 0);
  await page.getByRole("button", { name: "내용 모두 보기", exact: true }).click();
  assert.equal(await page.locator(".career-reveal.shown").count(), 4);
  await page.getByRole("button", { name: "내용 다시 펼치기", exact: true }).click();
  assert.equal(await page.locator(".career-reveal.shown").count(), 0);
  await page.locator(".career-slide h2").dispatchEvent("touchstart", { touches: [{ identifier: 1, clientX: 600, clientY: 180 }] });
  await page.locator(".career-slide h2").dispatchEvent("touchend", { changedTouches: [{ identifier: 1, clientX: 200, clientY: 180 }] });
  assert.equal(await page.locator(".career-reveal.shown").count(), 1);
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");

  // Every career scene has readable material, a working image and a speaker note.
  for (let i = 0; i < CAREER_SLIDES.length; i++) {
    await page.getByLabel("발표 장면", { exact: true }).selectOption(String(i));
    await page.getByRole("button", { name: "내용 모두 보기", exact: true }).click();
    assert.equal(await page.locator(".career-slide h2").innerText(), CAREER_SLIDES[i].title);
    assert.equal(await page.locator(".career-reveal.shown").count(), 4);
    await page.locator(".career-speaking-notes summary").click();
    assert.equal(await page.locator(".career-speaking-notes p").count(), 2);
    await page.waitForFunction(() => [...document.querySelectorAll(".career-slide img")].every(i => i.complete && i.naturalWidth > 0));
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Desktop overflow on slide " + i);
  }
  // The player must not load before teacher action; it must be destroyed on close/navigation.
  await page.getByLabel("발표 장면", { exact: true }).selectOption("7");
  assert.equal(await page.locator(".career-video-frame iframe").count(), 0);
  await page.getByRole("button", { name: "현재 장면 전체화면", exact: true }).click();
  await page.getByRole("button", { name: "영상 불러오기", exact: true }).click();
  const iframe = page.locator(".career-video-frame iframe");
  assert.match(await iframe.getAttribute("src"), /youtube-nocookie.com\/embed\/OFZiLFj4dSk/);
  assert(!(await iframe.getAttribute("src")).includes("autoplay=1"));
  await page.screenshot({ path: path.join(out, "career-video.png") });
  await page.getByRole("button", { name: "다음 장", exact: true }).click();
  assert.equal(await page.locator(".career-video-frame iframe").count(), 0);
  await page.keyboard.press("Escape");
  await page.getByLabel("발표 장면", { exact: true }).selectOption("7");
  await page.getByRole("button", { name: "현재 장면 전체화면", exact: true }).click();
  await page.getByRole("button", { name: "영상 불러오기", exact: true }).click();
  await page.getByRole("button", { name: "닫기 (ESC)", exact: true }).click();
  assert.equal(await page.locator(".career-video-frame iframe").count(), 0);
  await page.locator(".career-video-fallback summary").click();
  assert(await page.getByText(/한국형 우주식품 같은 연구 성과/).isVisible());

  for (const [label, width, height] of [["laptop", 1366, 768], ["tablet", 768, 1024], ["phone", 390, 844]]) {
    await page.setViewportSize({ width, height });
    await page.getByLabel("발표 장면", { exact: true }).selectOption("9");
    await page.getByRole("button", { name: "현재 장면 전체화면", exact: true }).click();
    await page.getByRole("button", { name: "내용 모두 보기", exact: true }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.querySelectorAll(".career-reveal.shown, .career-title-enter")].every(e => getComputedStyle(e).opacity === "1"));
    assert(await page.locator(".career-photo img").isVisible(), label + " image hidden");
    assert(await page.evaluate(() => {
      const d = document.querySelector(".lesson-fullscreen");
      return d.scrollWidth <= d.clientWidth + 1;
    }), label + " dialog overflow");
    await page.screenshot({ path: path.join(out, "career-" + label + ".png"), fullPage: true });
    await page.getByRole("button", { name: "닫기 (ESC)", exact: true }).click();
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.getByLabel("발표 장면", { exact: true }).selectOption("0");
  assert.equal(await page.locator(".career-title-enter").evaluate(e => getComputedStyle(e).animationName), "none");
  assert.equal(await page.locator(".career-reveal").first().evaluate(e => getComputedStyle(e).transitionDuration), "0s");
  // Existing nine factory scenes and timed video demonstration still work.
  await page.getByLabel("발표 장면", { exact: true }).selectOption("13");
  await page.getByRole("button", { name: "자동 시연 시작", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".presenter-script>span")?.textContent === "공정 2", { timeout: 8000 });
  await page.getByRole("button", { name: "시연 일시정지", exact: true }).click();
  await page.getByLabel("발표 장면", { exact: true }).selectOption("21");
  assert(await page.getByRole("button", { name: "다음 장", exact: true }).isDisabled());
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ status: "PASS", slides: 13, durationSeconds: 600, checks: ["manual reveal and back", "show all and replay", "swipe and ESC", "all scenes, notes and images", "on-demand official player and teardown", "video fallback", "projector/laptop/tablet/phone", "reduced motion", "existing factory autoplay"], note: "External streaming availability depends on school network; no claim of verifying the full remote video." }, null, 2));
  await browser.close();
  await api.dispose();
  console.log("PASS: career presentation interactions, media lifecycle, responsive layout and factory regression");
})().catch(async error => {
  if (global.testPage) await global.testPage.screenshot({ path: path.join(out, "failure.png"), fullPage: true }).catch(() => {});
  console.error(error);
  process.exit(1);
});
