import type { BlindRound, BlindSample, LessonClass, Notebook, StudentProject } from "./types";

// The storage server keeps notebook.comparisons as free string pairs, so group and
// vote data live there under reserved keys. Soup ids never start with "__".
export const GROUP_KEY = "__group";
export const voteKey = (roundId: string) => `__vote:${roundId}`;
export const isReservedKey = (key: string) => key.startsWith("__");

export const DEFAULT_GROUP_COUNT = 6;
export const MAX_GROUP_COUNT = 12;
export const groupCountOf = (lesson?: LessonClass) => Math.min(MAX_GROUP_COUNT, Math.max(2, Math.round(lesson?.groupCount ?? DEFAULT_GROUP_COUNT)));
export const groupLabel = (group: number) => `${group}모둠`;

export function groupOf(project?: StudentProject | null): number | undefined {
  const value = Number(project?.notebook?.comparisons?.[GROUP_KEY]);
  return Number.isInteger(value) && value >= 1 && value <= MAX_GROUP_COUNT ? value : undefined;
}
export const withGroup = (notebook: Notebook, group: number): Notebook => ({ ...notebook, comparisons: { ...notebook.comparisons, [GROUP_KEY]: String(group) } });

export function voteOf(project: StudentProject | null | undefined, round?: BlindRound): string | undefined {
  if (!round) return undefined;
  const label = project?.notebook?.comparisons?.[voteKey(round.id)];
  return label && round.samples.some((x) => x.label === label) ? label : undefined;
}
export const withVote = (notebook: Notebook, round: BlindRound, label: string): Notebook => ({ ...notebook, comparisons: { ...notebook.comparisons, [voteKey(round.id)]: label } });

/** A submitted best recipe is a final recipe the device shared with the class. */
export const isSubmitted = (project: StudentProject) => Boolean(project.notebook?.final?.shared);

/** Latest submission per group. Several devices of one group may submit; the newest wins. */
export function groupSubmissions(projects: StudentProject[]) {
  const latest = new Map<number, StudentProject>();
  const counts = new Map<number, number>();
  for (const project of projects) {
    const group = groupOf(project);
    if (!group || !isSubmitted(project)) continue;
    counts.set(group, (counts.get(group) ?? 0) + 1);
    const current = latest.get(group);
    if (!current || submittedAt(project) > submittedAt(current)) latest.set(group, project);
  }
  return { latest, counts };
}
/** savedAt comes from the student device clock; the server's updatedAt caps a clock that runs ahead. */
function submittedAt(project: StudentProject) {
  const saved = project.notebook?.final?.savedAt ?? "";
  return project.updatedAt && saved > project.updatedAt ? project.updatedAt : saved;
}

export const sampleLetter = (index: number) => String.fromCharCode(65 + index);

/** Shuffles the submissions so the letter order never follows the group order. */
export function createBlindRound(submissions: StudentProject[], random: () => number = Math.random): BlindRound {
  const shuffled = [...submissions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const samples: BlindSample[] = shuffled.map((project, index) => ({ label: sampleLetter(index), projectId: project.id }));
  return { id: createRoundId(), status: "voting", samples, startedAt: new Date().toISOString() };
}
function createRoundId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (x) => x.toString(16).padStart(2, "0")).join("");
}

/** Grace for clock differences between the teacher device (startedAt) and the server (createdAt). */
export const VOTE_GRACE_MS = 60_000;
/**
 * True when the record existed before the round started (createdAt is set by the server).
 * Records made later may still vote (a student can join just to vote), but "다른 학생 시작" could also
 * add extra votes, so the teacher sees these votes separately and can leave them out.
 */
export function joinedBeforeRound(project: StudentProject | null | undefined, round: BlindRound) {
  const created = Date.parse(project?.createdAt ?? "");
  const started = Date.parse(round.startedAt);
  return !Number.isFinite(created) || !Number.isFinite(started) || created <= started + VOTE_GRACE_MS;
}

export type TallyRow = { label: string; projectId: string; group?: number; votes: number; ownVotes: number };
/**
 * Counts one vote per record. Own-group votes are reported separately, and votes from records made after
 * the round started are counted in `late`, so the teacher can leave either out.
 */
export function tallyVotes(projects: StudentProject[], round: BlindRound, excludeOwnGroup: boolean, excludeLate = false) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const rows: TallyRow[] = round.samples.map((sample) => ({ label: sample.label, projectId: sample.projectId, group: groupOf(byId.get(sample.projectId)), votes: 0, ownVotes: 0 }));
  let voters = 0;
  let late = 0;
  for (const project of projects) {
    const label = voteOf(project, round);
    if (!label) continue;
    if (!joinedBeforeRound(project, round)) { late++; if (excludeLate) continue; }
    voters++;
    const row = rows.find((x) => x.label === label)!;
    const voterGroup = groupOf(project);
    if (voterGroup && row.group && voterGroup === row.group) row.ownVotes++;
    else row.votes++;
  }
  const counted = (row: TallyRow) => row.votes + (excludeOwnGroup ? 0 : row.ownVotes);
  const top = Math.max(0, ...rows.map(counted));
  return { rows, voters, late, counted, winners: top > 0 ? rows.filter((row) => counted(row) === top).map((row) => row.label) : [] };
}
