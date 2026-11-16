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
const { BlindRecipeOverview } = await import("../components/teacher/BlindRecipeOverview.tsx");
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

test("overview shows all 1, 7 and 12 samples with every ingredient while preserving blind identities", () => {
  for (const count of [1, 7, 12]) {
    const projects = Array.from({ length: count }, (_, index) => {
      const project = structuredClone(student);
      project.id = `overview-${index}`;
      project.notebook.comparisons.__group = String(index + 1);
      project.notebook.final.productName = `비밀라면-${index}`;
      project.notebook.final.tasteLine = `비밀소개-${index}`;
      project.notebook.final.record.note = `비밀메모-${index}`;
      project.notebook.final.record.items = [
        { id: "base", name: "기본 베이스", category: "BASE", amount: index + .25 },
        { id: `ingredient-${index}`, name: `추가 재료 ${index}`, category: "첨가물", amount: index + 1 },
      ];
      return project;
    });
    const round = createBlindRound(projects, () => .99);
    const html = render(BlindRecipeOverview, { samples: round.samples, projects, settings, revealed: false, onOpen: noop });
    assert.equal((html.match(/aria-label="레시피 [A-Z] 크게 보기"/g) || []).length, count);
    assert.doesNotMatch(html, /비밀라면-|비밀소개-|비밀메모-|\d+모둠/);
    for (let index = 0; index < count; index++) {
      assert.match(html, new RegExp(`추가 재료 ${index}<`));
      assert(html.includes(`${index + .25}g`));
    }
    assert.match(html, /조리 시간/);
    assert.match(html, /알레르기 확인/);
    const revealed = render(BlindRecipeOverview, { samples: round.samples, projects, settings, revealed: true, onOpen: noop });
    for (let index = 0; index < count; index++) {
      assert(revealed.includes(`비밀라면-${index}`));
      assert(revealed.includes(`${index + 1}모둠`));
    }
  }
});

test("overview excludes late submissions and keeps a missing sample visible", () => {
  const late = structuredClone(student);
  late.id = "late-student";
  late.notebook.final.record.items = [{ id: "late", name: "늦게 제출한 재료", amount: 9, category: "첨가물" }];
  const samples = [{ label: "A", projectId: student.id }, { label: "B", projectId: "missing-student" }];
  const html = render(BlindRecipeOverview, { samples, projects: [student, late], settings, revealed: false, onOpen: noop });
  assert.equal((html.match(/aria-label="레시피 [AB] 크게 보기"/g) || []).length, 2);
  assert.match(html, /레시피 불러오는 중/);
  assert.doesNotMatch(html, /늦게 제출한 재료/);
});
