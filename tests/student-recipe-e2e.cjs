/* Run against a local Vite/D1 server with RAMEN_API_ORIGIN=local.
   TEST_ORIGIN=http://127.0.0.1:5211 PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/path/to/chrome node tests/student-recipe-e2e.cjs */
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

const origin = process.env.TEST_ORIGIN || "http://127.0.0.1:5211";
assert(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use a local test database");
const groupNumbers = [1, 2, 3, 4, 5, 6, 7];

async function enterClass(page, code) {
  await page.goto(origin);
  await page.waitForLoadState("networkidle");
  await page.getByLabel("수업 코드", { exact: true }).fill(code);
  await page.getByRole("button", { name: "기록 시작하기" }).click();
}

async function verifyFocus(input, message) {
  assert(await input.evaluate((element) => element === document.activeElement), message);
}

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox"] });
  const errors = [];
  try {
    const teacher = await browser.newPage();
    teacher.on("pageerror", (error) => errors.push(error.message));
    await teacher.goto(`${origin}/teacher`);
    const classPicker = teacher.getByRole("combobox", { name: "수업 선택" });
    await classPicker.waitFor();
    const teacherNav = teacher.locator(".teacher-sidebar");
    await teacherNav.getByRole("button", { name: "수업·반 설정" }).click();
    await teacher.getByRole("button", { name: "수업 추가" }).click();
    await teacher.getByLabel("학교 · 반 · 수업일").fill("레시피 입력 검증반");
    await teacher.getByLabel(/^모둠 수/).fill("7");
    const code = await teacher.locator(".class-code strong").innerText();
    assert.match(code, /^\d{6}$/);
    const classId = await classPicker.inputValue();
    await teacher.getByRole("button", { name: "설정 저장" }).click();
    await teacher.getByText("교사 설정을 저장했습니다. 학생 화면에도 반영됩니다.").waitFor();

    const students = await Promise.all(groupNumbers.map(async (group) => {
      const device = group <= 2 ? { viewport: { width: 1366, height: 900 } }
        : group <= 4 ? devices["iPad (gen 7)"] : devices["iPhone 13"];
      const page = await browser.newPage(device);
      page.on("pageerror", (error) => errors.push(error.message));
      await enterClass(page, code);
      const picker = page.getByRole("group", { name: "모둠 고르기" });
      await picker.waitFor();
      assert.deepEqual(await picker.getByRole("button").evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label"))),
        groupNumbers.map((number) => `${number}모둠`));
      await picker.getByRole("button", { name: `${group}모둠`, exact: true }).click();
      await page.getByRole("heading", { name: "내 레시피 기록" }).waitFor();
      await page.getByRole("button", { name: `${group}모둠 · 바꾸기` }).waitFor();
      const amount = page.getByRole("spinbutton", { name: / 양\(g\)$/ }).first();
      const note = page.getByRole("textbox", { name: "맛 느낌 한 줄" });
      const expectedNote = group === 7 ? "매콤해요" : `검증 ${group}모둠`;
      if (group === 7) {
        await note.tap();
        await page.keyboard.insertText("매");
        await verifyFocus(note, "The first Korean character must keep focus on a new recipe");
        await page.keyboard.insertText("콤해요");
        await amount.fill("1.25");
      } else {
        await amount.click();
        await page.keyboard.press("1");
        await verifyFocus(amount, `Group ${group}: the first digit must keep focus on a new recipe`);
        await page.keyboard.type(".25");
        await note.fill(expectedNote);
      }
      assert.equal(await amount.inputValue(), "1.25");
      assert.equal(await note.inputValue(), expectedNote);
      await page.getByText("자동 저장됨", { exact: true }).waitFor();
      return { page, group, expectedNote };
    }));

    const response = await teacher.request.get(`${origin}/api/students`, { params: { classId } });
    assert.equal(response.status(), 200);
    const { projects } = await response.json();
    assert.equal(projects.length, groupNumbers.length);
    assert.equal(new Set(projects.map((project) => project.researcherNumber)).size, groupNumbers.length);
    for (const { group, expectedNote } of students) {
      const project = projects.find((entry) => entry.notebook.comparisons.__group === String(group));
      assert(project, `Group ${group} was saved to the teacher's classroom`);
      assert.equal(project.notebook.base.tasting.note, expectedNote);
      assert.equal(project.notebook.base.tasting.items[0].amount, 1.25);
    }

    await teacherNav.getByRole("button", { name: "학생 레시피 보기" }).click();
    const seventh = projects.find((project) => project.notebook.comparisons.__group === "7");
    const seventhRecipe = teacher.locator(".student-recipe-list")
      .getByRole("button", { name: new RegExp(`^${seventh.researcherNumber}번 연구원`) });
    await seventhRecipe.click();
    await teacher.getByRole("dialog").getByText("매콤해요", { exact: true }).waitFor();

    const { page } = students[6];
    await enterClass(page, code);
    await page.getByRole("button", { name: "7모둠 · 바꾸기" }).waitFor();
    assert.equal(await page.getByRole("textbox", { name: "맛 느낌 한 줄" }).inputValue(), "매콤해요");
    assert.deepEqual(errors, []);
    console.log("PASS: groups 1–7 joined, kept focus while typing, saved recipes, and appeared on the teacher's screen.");
  } finally {
    await browser.close();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
