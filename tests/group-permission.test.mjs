import assert from "node:assert/strict";
import { test } from "node:test";
import { changeProjectGroup, createBlindRound, groupChangeError, groupOf, groupSubmissions, tallyVotes, withVote } from "../lib/groups.ts";

const lesson = { id: "lesson-one", name: "검증반", code: "456789", waterMl: 100, cookMinutes: 3, noodleFraction: .25, groupCount: 7 };
const project = (id, group, shared = false) => ({
  id, classId: lesson.id, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
  notebook: {
    base: { practices: [{ id: "practice", note: "이전 기록" }], tastingHistory: [], tasting: { id: "tasting", note: "고소해요", items: [{ id: "base", amount: 1.25 }] } },
    commercial: { practices: [], tastingHistory: [] },
    comparisons: group ? { __group: String(group), "__vote:old": "B" } : {},
    final: { shared, savedAt: "2026-11-01T00:00:00.000Z", productName: "고소 라면", record: { items: [{ id: "base", amount: 1.25 }] } },
  },
});

test("first group selection is allowed; later changes require the classroom permission", () => {
  assert.equal(groupChangeError(undefined, 7, lesson), undefined);
  assert.equal(groupChangeError(project("new"), 1, lesson), undefined);
  assert.match(groupChangeError(project("saved", 1), 2, lesson), /허용/);
  assert.match(groupChangeError(project("saved", 1), 2, { ...lesson, allowGroupChange: false }), /허용/);
  assert.equal(groupChangeError(project("saved", 1), 2, { ...lesson, allowGroupChange: true }), undefined);
  assert.equal(groupChangeError(project("saved", 7), 7, { ...lesson, groupCount: 4 }), undefined, "existing records still save when group count shrinks");
  assert.match(groupChangeError(project("saved", 1), 8, { ...lesson, allowGroupChange: true }), /모둠 번호/);
  assert.match(groupChangeError(project("saved", 1), undefined, lesson), /모둠 번호/);
});

test("a permitted change preserves recipes and votes, and withdraws an untested submission", () => {
  const before = project("student-one", 1, true);
  const snapshot = structuredClone(before);
  const after = changeProjectGroup(before, 2, { ...lesson, allowGroupChange: true });
  assert.equal(groupOf(after), 2);
  assert.equal(after.notebook.final.shared, false);
  assert.deepEqual(after.notebook.base, before.notebook.base);
  assert.deepEqual(after.notebook.final.record, before.notebook.final.record);
  assert.equal(after.notebook.comparisons["__vote:old"], "B");
  assert.deepEqual(before, snapshot, "the previous saved record remains untouched");
  assert.equal(changeProjectGroup(before, 1, lesson), before, "same group is a no-op");
});

test("teacher-authorized correction keeps the active sample through voting, close and reveal", () => {
  const before = project("student-one", 1, true);
  const round = createBlindRound([before]);
  for (const status of ["voting", "closed", "revealed"]) {
    const current = { ...lesson, allowGroupChange: true, blindRound: { ...round, status } };
    assert.equal(groupChangeError(before, 2, current), undefined);
    const after = changeProjectGroup(before, 2, current);
    assert.equal(groupOf(after), 2);
    assert.deepEqual(after.notebook.final, before.notebook.final);
    assert.deepEqual(after.notebook.base, before.notebook.base);
    assert.equal(current.blindRound.samples[0].projectId, after.id);
    assert.match(groupChangeError(before, 2, { ...current, allowGroupChange: false }), /허용/);
  }
});

test("one submitted group produces sample A and can count its own vote", () => {
  const submitted = project("student-one", 1, true);
  const { latest } = groupSubmissions([submitted, project("student-two", 2)]);
  const round = createBlindRound([...latest.values()]);
  assert.deepEqual(round.samples, [{ label: "A", projectId: submitted.id }]);
  const voter = { ...submitted, notebook: withVote(submitted.notebook, round, "A") };
  const result = tallyVotes([voter], round, false);
  assert.equal(result.voters, 1);
  assert.equal(result.counted(result.rows[0]), 1);
  assert.deepEqual(result.winners, ["A"]);
  const excluded = tallyVotes([voter], round, true);
  assert.equal(excluded.counted(excluded.rows[0]), 0, "normal multi-group counting retains the exclude-own option");
});
