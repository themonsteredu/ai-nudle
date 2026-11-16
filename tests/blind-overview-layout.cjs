/* Offline browser check: no preview server, production records, or network requests.
   PLAYWRIGHT_MODULE_PATH=/path/to/playwright CHROME_PATH=/usr/bin/chromium node tests/blind-overview-layout.cjs */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { build } = require("esbuild");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE_PATH || "playwright");

async function run() {
  const bundled = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React, { useState } from "react";
      import { createRoot } from "react-dom/client";
      import { GroupBestPanel } from "./components/teacher/GroupBestPanel";
      import { defaultSettings } from "./lib/defaults";
      import { newProject, blankRecord } from "./lib/notebook";
      const count = window.testCount;
      const lesson = { id: "offline-class", name: "블라인드 화면 검증", code: "456789", groupCount: count, waterMl: 100, cookMinutes: 3, noodleFraction: .25 };
      const projects = Array.from({length: count}, (_, i) => {
        const project = newProject(lesson);
        project.notebook.comparisons.__group = String(i + 1);
        const record = blankRecord(lesson);
        record.items = Array.from({length: window.ingredientCount}, (_, j) => ({ id: "ingredient-" + j, name: j === 0 ? "기본 베이스" : "추가 재료 " + j, amount: (i + j + 1) / 4, category: "첨가물" }));
        project.notebook.final = { method: "base", record, productName: "비밀라면-" + i, tasteLine: "비밀소개", keywords: [], spicyLevel: i % 4, shared: true, savedAt: new Date().toISOString() };
        return project;
      });
      function Fixture() {
        const [settings, setSettings] = useState({...defaultSettings, classes: [lesson]});
        const commit = async (patch) => {
          const change = typeof patch === "function" ? patch(settings.classes[0]) : patch;
          if (!change) return false;
          setSettings(s => ({...s, classes: [{...s.classes[0], ...change}]}));
          return true;
        };
        return <GroupBestPanel settings={settings} classId={lesson.id} projects={projects} commit={commit} busy={false} refresh={() => {}} loading={false} error="" />;
      }
      createRoot(document.getElementById("root")).render(<Fixture />);
    ` },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const css = ["app/globals.css", "app/group-teacher.css"].map(file => fs.readFileSync(file, "utf8")).join("\n");
  if (process.env.OVERVIEW_FIXTURE_PATH) {
    fs.writeFileSync(process.env.OVERVIEW_FIXTURE_PATH, `<html lang="ko"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'"><style>${css}</style></head><body><div id="root"></div><script>window.testCount=7;window.ingredientCount=12;</script><script>${bundled.outputFiles[0].text}</script></body></html>`);
    console.log("Created offline fixture with all network requests blocked by CSP.");
    return;
  }
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, args: ["--no-sandbox", "--disable-background-networking"] });
  const checks = [];
  try {
    for (const [width, height, count, ingredients] of [
      [1366, 768, 1, 10], [1366, 768, 7, 12], [1920, 1080, 7, 12],
      [1366, 768, 12, 12], [1024, 768, 7, 12], [768, 1024, 7, 12],
      [390, 844, 7, 12], [1366, 768, 12, 30],
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, offline: true });
      await context.route("**/*", route => route.abort());
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("dialog", dialog => dialog.accept());
      await page.setContent(`<html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div><script>window.testCount=${count};window.ingredientCount=${ingredients};</script><script>${bundled.outputFiles[0].text}</script></body></html>`);
      await page.getByRole("button", { name: "블라인드 테스트 시작", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await dialog.getByRole("heading", { name: "전체 레시피 한눈에", exact: true }).waitFor();
      await page.waitForFunction(() => {
        const stage = document.querySelector(".gb-overview-viewport").getBoundingClientRect();
        const table = document.querySelector(".gb-overview-table").getBoundingClientRect();
        return table.width > 0 && table.left >= stage.left - 2 && table.right <= stage.right + 2 && table.top >= stage.top - 2 && table.bottom <= stage.bottom + 2;
      });
      assert.equal(await dialog.getByRole("button", { name: /^레시피 [A-Z] 크게 보기$/ }).count(), count);
      assert.equal(await dialog.locator("tbody tr").count(), ingredients + 5);
      assert.doesNotMatch(await dialog.innerText(), /비밀라면|비밀소개|\d+모둠/);
      const metrics = await page.locator(".gb-overview-table").evaluate(table => ({ scale: table.getBoundingClientRect().height / table.offsetHeight, width: table.getBoundingClientRect().width, height: table.getBoundingClientRect().height }));
      checks.push({ width, height, count, ingredients, ...metrics });
      if (width === 1366 && height === 768 && count === 7) {
        fs.mkdirSync("outputs", { recursive: true });
        await page.screenshot({ path: path.resolve("outputs/blind-overview-7groups.png") });
        await dialog.getByRole("button", { name: "레시피 A 크게 보기", exact: true }).click();
        await dialog.getByRole("button", { name: "전체 레시피로 돌아가기", exact: true }).click();
        await dialog.getByRole("heading", { name: "전체 레시피 한눈에", exact: true }).waitFor();
        await dialog.getByRole("button", { name: "화면에 맞추기", exact: true }).click();
        assert.equal(await dialog.getByRole("button", { name: "화면에 맞추기", exact: true }).getAttribute("aria-pressed"), "false");
        await dialog.getByRole("button", { name: "화면에 맞추기", exact: true }).click();
        await page.keyboard.press("Escape");
        await dialog.waitFor({ state: "detached" });
      }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(JSON.stringify({ status: "PASS", checks }, null, 2));
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
