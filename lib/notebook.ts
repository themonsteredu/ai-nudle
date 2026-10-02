import { defaultSettings } from "./defaults";
import { createId } from "./ids";
import type { AllergenInfo, AppSettings, LessonClass, Notebook, RecipeItem, RecipeMethod, RecipeRecord, StudentProject } from "./types";

export const ALLERGENS = ["알류", "우유", "메밀", "땅콩", "대두", "밀", "고등어", "게", "새우", "돼지고기", "복숭아", "토마토", "아황산류", "호두", "닭고기", "쇠고기", "오징어", "조개류", "잣"];
export const METHOD_NAMES: Record<RecipeMethod, string> = { base: "기본 베이스", commercial: "시판 스프" };
export const formatGrams = (n: number) => `${Number(n.toFixed(2))}g`;
const emptyMethod = () => ({ practices: [], tastingHistory: [] });
export const emptyNotebook = (): Notebook => ({ base: emptyMethod(), commercial: emptyMethod(), comparisons: {} });
export function normalizeSettings(raw: AppSettings): AppSettings {
  const normalize = <T extends AllergenInfo>(item: T): T => ({ ...item, allergens: item.allergens ?? [], allergenChecked: item.allergenChecked === true, allergenOther: item.allergenOther ?? "", facilityNote: item.facilityNote ?? "" });
  // Historical free-text allergens were prefilled. Keep them for compatibility,
  // but never treat them as verified package information.
  const ingredients = (raw.ingredients ?? []).map(normalize);
  if (!raw.notebookVersion) for (const item of defaultSettings.ingredients) {
    if (!ingredients.some((old) => old.id === item.id || old.name === item.name)) ingredients.push({ ...item, order: ingredients.length });
  }
  return { ...defaultSettings, ...raw, notebookVersion: 2, classes: raw.classes ?? [], ingredients,
    toppings: (raw.toppings ?? defaultSettings.toppings).map(normalize),
    comparisonSoups: (raw.comparisonSoups ?? defaultSettings.comparisonSoups ?? []).map(normalize),
    noodleAllergens: normalize(raw.noodleAllergens ?? {}),
  };
}
export function blankRecord(lesson: LessonClass): RecipeRecord {
  const now = new Date().toISOString();
  return { id: createId("record"), items: [], note: "", waterMl: lesson.waterMl, cookMinutes: lesson.cookMinutes, noodleFraction: lesson.noodleFraction, createdAt: now, updatedAt: now };
}
export function newProject(lesson: LessonClass): StudentProject {
  const now = new Date().toISOString();
  return { id: createId("student"), classId: lesson.id, revision: 0, studentName: "", teamName: "", experiments: [], bestRecipeIndex: null, label: { productName: "", tasteLine: "", developerName: "" }, notebook: emptyNotebook(), createdAt: now, updatedAt: now };
}
export function selectedRecord(project: StudentProject, method: RecipeMethod) {
  const data = project.notebook?.[method];
  return data?.tasting ?? data?.practices[data.practices.length - 1];
}
export function copyToTasting(notebook: Notebook, method: RecipeMethod, source: RecipeRecord): Notebook {
  const previous = notebook[method];
  const copy = structuredClone(source);
  copy.id = createId("record");
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = copy.createdAt;
  return { ...notebook, [method]: { ...previous, tasting: copy, tastingHistory: previous.tasting ? [...previous.tastingHistory, previous.tasting] : previous.tastingHistory } };
}
export function availableItems(settings: AppSettings, method: RecipeMethod, tasting: boolean): RecipeItem[] {
  const base = settings.ingredients.filter((x) => x.enabled && (method === "base" || x.category !== "BASE")).sort((a, b) => a.order - b.order)
    .map((x) => ({ ...x, name: x.displayName || x.name, amount: x.defaultAmount }));
  const soups = method === "commercial" ? (settings.comparisonSoups ?? []).flatMap((x, i) => x.enabled ? [{ ...x, name: `스프 ${String.fromCharCode(65 + i)}`, amount: 0, category: "시판 스프" }] : []) : [];
  const toppings = tasting ? settings.toppings.filter((x) => x.enabled).map((x) => ({ ...x, name: x.displayName || x.name, amount: x.amountPerStudent, category: "건더기" })) : [];
  return [...soups, ...base, ...toppings];
}
export function recipeAllergens(record: RecipeRecord, settings: AppSettings, withNoodles = false) {
  const current = [...settings.ingredients, ...settings.toppings, ...(settings.comparisonSoups ?? [])];
  const selected: AllergenInfo[] = record.items.filter((x) => x.amount > 0).map((x) => current.find((i) => i.id === x.id) ?? x);
  if (withNoodles) selected.push(settings.noodleAllergens ?? {});
  const values = Array.from(new Set(selected.flatMap((x) => x.allergenChecked ? [...(x.allergens ?? []), ...(x.allergenOther?.trim() ? [x.allergenOther.trim()] : [])] : [])));
  return { values, unchecked: selected.some((x) => !x.allergenChecked), notes: Array.from(new Set(selected.map((x) => x.facilityNote?.trim()).filter((x): x is string => Boolean(x)))) };
}
export function studentSettings(settings: AppSettings, lesson: LessonClass): AppSettings {
  return { ...settings, className: lesson.name, classes: [{ ...lesson, code: "" }], comparisonSoups: settings.comparisonSoups?.map((x, i) => ({ ...x, name: `스프 ${String.fromCharCode(65 + i)}` })) };
}
