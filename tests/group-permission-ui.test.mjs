// Render the actual controls locally without starting a preview or making network requests.
import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

registerHooks({
  resolve(specifier, context, nextResolve) {
    let url;
    if (specifier.startsWith("@/")) url = new URL(`../${specifier.slice(2)}`, import.meta.url);
    else if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) url = new URL(specifier, context.parentURL);
    if (url) for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      const target = new URL(`${url.href}${suffix}`);
      if (existsSync(fileURLToPath(target))) return { url: target.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (/\.tsx?$/.test(url)) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
      fileName: fileURLToPath(url), compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
    }).outputText };
    return nextLoad(url, context);
  },
});
const { ClassPanel } = await import("../components/teacher/ClassPanel.tsx");
const { GroupBestPanel } = await import("../components/teacher/GroupBestPanel.tsx");
const { BlindVote } = await import("../components/student/BlindVote.tsx");
const { defaultSettings } = await import("../lib/defaults.ts");
const { newProject, blankRecord } = await import("../lib/notebook.ts");
const { createBlindRound, withVote } = await import("../lib/groups.ts");
const lesson = { id: "lesson-one", name: "검증반", code: "456789", waterMl: 100, cookMinutes: 3, noodleFraction: .25, groupCount: 7 };
const settings = { ...defaultSettings, classes: [lesson] };
const student = newProject(lesson);
student.notebook.comparisons.__group = "1";
student.notebook.final = { method: "base", record: blankRecord(lesson), productName: "고소 라면", shared: true, spicyLevel: 0, savedAt: new Date().toISOString() };
const noop = () => {};
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));
const panel = (projects, current = settings) => render(GroupBestPanel, { settings: current, classId: lesson.id, projects, commit: noop, refresh: noop, busy: false, loading: false, error: "" });
const button = (html, text) => [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map(([value]) => value).find((value) => value.includes(text));

test("teacher permission control reflects the selected classroom", () => {
  const props = { settings, classId: lesson.id, setSettings: noop, selectClass: noop };
  assert.match(button(render(ClassPanel, props), "모둠 변경 허용"), /aria-pressed="false"/);
  assert.match(button(render(ClassPanel, { ...props, settings: { ...settings, classes: [{ ...lesson, allowGroupChange: true }] } }), "모둠 변경 허용"), /aria-pressed="true"/);
});

test("start stays disabled with zero submissions and becomes enabled with just one", () => {
  assert.match(button(panel([]), "블라인드 테스트 시작"), /disabled/);
  assert.doesNotMatch(button(panel([student]), "블라인드 테스트 시작"), /disabled/);
  assert.match(panel([student]), /1개 모둠 레시피로 시작할 수 있어요/);
});

test("single-sample result counts an own-group ballot and student sees the matching instruction", () => {
  const round = { ...createBlindRound([student]), status: "closed" };
  const voter = { ...student, notebook: withVote(student.notebook, round, "A") };
  const current = { ...settings, classes: [{ ...lesson, blindRound: round }] };
  const html = panel([voter], current);
  assert.match(html, /반영한 표 1표/);
  assert.match(html, /자기 모둠 표 1표 포함/);
  assert.match(button(html, "자기 모둠 표 빼고 세기"), /disabled/);
  const ballot = render(BlindVote, { project: voter, round: { ...round, status: "voting" }, refresh: noop, patch: noop, onBack: noop });
  assert.match(ballot, /레시피 A를 누르면 우리 모둠 표도 함께 세어요/);
  assert.equal((ballot.match(/aria-label="레시피 [A-Z]"/g) || []).length, 1);
});

test("normal multiple-group test keeps own-group exclusion available", () => {
  const second = structuredClone(student);
  second.id = "second-student";
  second.notebook.comparisons.__group = "2";
  const round = { ...createBlindRound([student, second], () => .99), status: "closed" };
  const voter = { ...student, notebook: withVote(student.notebook, round, "A") };
  const html = panel([voter, second], { ...settings, classes: [{ ...lesson, blindRound: round }] });
  assert.match(html, /반영한 표 0표/);
  assert.doesNotMatch(button(html, "자기 모둠 표 빼고 세기"), /disabled/);
  assert.match(button(html, "자기 모둠 표 빼고 세기"), /aria-pressed="true"/);
});
