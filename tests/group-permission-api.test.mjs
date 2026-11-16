// Run with node --experimental-test-module-mocks --experimental-transform-types --test tests/group-permission-api.test.mjs.
// Exercise the real request handlers with an in-memory database; no production or network access.
import assert from "node:assert/strict";
import { beforeEach, mock, test } from "node:test";
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({ resolve(specifier, context, nextResolve) {
  let url;
  if (specifier.startsWith("@/")) url = new URL(`../${specifier.slice(2)}`, import.meta.url);
  else if (specifier.startsWith(".") && !/\.[a-z]+$/.test(specifier)) url = new URL(specifier, context.parentURL);
  if (url) {
    const target = [new URL(`${url.href}.ts`), new URL(`${url.href}/index.ts`)].find((candidate) => existsSync(fileURLToPath(candidate)));
    if (target) return { url: target.href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });

let stored;
let settings;
let teacher = true;
const key = "test-owner-key-for-group-change-12345";
const lesson = { id: "lesson-one", name: "검증반", code: "456789", waterMl: 100, cookMinutes: 3, noodleFraction: .25, groupCount: 7, allowGroupChange: false };
const projectsTable = { id: "id", dataJson: "dataJson" };
const settingsTable = { key: "key", valueJson: "valueJson" };
const db = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => stored ? [{ id: stored.id, dataJson: JSON.stringify(stored) }] : [] }) }) }),
  update: () => ({ set: (values) => ({ where: () => ({ returning: async () => { stored = JSON.parse(values.dataJson); return [{ id: stored.id }]; } }) }) }),
  insert: (table) => ({ values: (values) => ({
    onConflictDoUpdate: () => table === settingsTable && values.key === "class-settings"
      ? Promise.resolve(settings = JSON.parse(values.valueJson))
      : { returning: async () => [{ valueJson: "1" }] },
    onConflictDoNothing: () => ({ returning: async () => { stored = JSON.parse(values.dataJson); return [{ id: stored.id }]; } }),
  }) }),
};
mock.module("../db/index.ts", { namedExports: { getDb: async () => db } });
mock.module("../db/schema.ts", { namedExports: { studentProjects: projectsTable, appData: settingsTable } });
mock.module("../lib/settings-store.ts", { namedExports: { readSettings: async () => structuredClone(settings) } });
mock.module("../lib/teacher-auth.ts", { namedExports: { isTeacherRequest: async () => teacher } });
mock.module("drizzle-orm", { namedExports: { and: (...x) => x, asc: (x) => x, eq: (...x) => x, sql: (...x) => x } });
const { POST } = await import("../app/api/students/route.ts");
const { GET: getSettings, PUT: putSettings } = await import("../app/api/settings/route.ts");
const { defaultSettings } = await import("../lib/defaults.ts");
const { newProject, blankRecord } = await import("../lib/notebook.ts");

beforeEach(async () => {
  teacher = true;
  settings = structuredClone({ ...defaultSettings, classes: [lesson] });
  stored = newProject(lesson);
  stored.researcherNumber = 1;
  stored.revision = 3;
  stored.ownerHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key))).toString("hex");
  stored.notebook.comparisons = { __group: "1", "__vote:earlier": "A" };
  const record = blankRecord(lesson);
  record.note = "기존 레시피";
  stored.notebook.base.tasting = record;
  stored.notebook.final = { method: "base", record: structuredClone(record), productName: "고소 라면", tasteLine: "고소해요", keywords: [], spicyLevel: 0, savedAt: record.updatedAt, shared: true };
});
const save = async (project) => {
  const response = await POST(new Request("http://localhost/api/students", { method: "POST", headers: { "content-type": "application/json", "x-class-code": lesson.code, "x-student-key": key }, body: JSON.stringify({ project }) }));
  return { status: response.status, ...await response.json() };
};

test("server rejects a revoked group change while saving the latest recipe and preserving submission", async () => {
  const originalFinal = structuredClone(stored.notebook.final);
  const request = structuredClone(stored);
  request.notebook.comparisons.__group = "2";
  request.notebook.base.tasting.note = "권한 취소 직전 적은 맛 기록";
  request.notebook.final.shared = false;
  const response = await save(request);
  assert.equal(response.status, 200);
  assert.match(response.groupChangeRejected, /허용/);
  assert.equal(response.project.notebook.comparisons.__group, "1");
  assert.equal(response.project.notebook.base.tasting.note, "권한 취소 직전 적은 맛 기록");
  assert.deepEqual(response.project.notebook.final, originalFinal);
  assert.equal(response.project.ownerHash, undefined);
  assert.equal(stored.revision, 4);
});

test("authorized correction during voting keeps the active recipe and existing vote", async () => {
  settings.classes[0].allowGroupChange = true;
  settings.classes[0].blindRound = { id: "round-one", status: "voting", samples: [{ label: "A", projectId: stored.id }], startedAt: new Date().toISOString() };
  const originalFinal = structuredClone(stored.notebook.final);
  const request = structuredClone(stored);
  request.notebook.comparisons.__group = "7";
  request.notebook.final.shared = false;
  const response = await save(request);
  assert.equal(response.status, 200);
  assert.equal(response.groupChangeRejected, undefined);
  assert.equal(stored.notebook.comparisons.__group, "7");
  assert.equal(stored.notebook.comparisons["__vote:earlier"], "A");
  assert.deepEqual(stored.notebook.final, originalFinal);
});

test("first-time group selection is accepted with permission off", async () => {
  stored = undefined;
  const request = newProject(lesson);
  request.notebook.comparisons.__group = "3";
  const response = await save(request);
  assert.equal(response.status, 200);
  assert.equal(response.groupChangeRejected, undefined);
  assert.equal(stored.notebook.comparisons.__group, "3");
});

test("permission is saved per class, reaches students, and needs a teacher session", async () => {
  const other = { ...lesson, id: "lesson-two", code: "987654" };
  settings.classes.push(other);
  const incoming = structuredClone(settings);
  incoming.classes[0].allowGroupChange = true;
  let response = await putSettings(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ settings: incoming }) }));
  assert.equal(response.status, 200);
  assert.equal(settings.classes[0].allowGroupChange, true);
  assert.equal(settings.classes[1].allowGroupChange, false);
  teacher = false;
  response = await getSettings(new Request(`http://localhost/api/settings?code=${lesson.code}`));
  assert.equal((await response.json()).settings.classes[0].allowGroupChange, true);
  response = await putSettings(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ settings: incoming }) }));
  assert.equal(response.status, 401);
});

test("invalid group numbers and non-boolean permission are rejected without losing recipes", async () => {
  settings.classes[0].allowGroupChange = true;
  const request = structuredClone(stored);
  request.notebook.comparisons.__group = "12";
  const response = await save(request);
  assert.equal(response.status, 200);
  assert.match(response.groupChangeRejected, /모둠 번호/);
  assert.equal(stored.notebook.comparisons.__group, "1");
  settings.classes[0].allowGroupChange = "true";
  const invalid = await putSettings(new Request("http://localhost/api/settings", { method: "PUT", body: JSON.stringify({ settings }) }));
  assert.equal(invalid.status, 400);
});
