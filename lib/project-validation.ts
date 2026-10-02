import type { Notebook, RecipeRecord, StudentProject } from "./types";
const string = (v: unknown, max = 500): v is string => typeof v === "string" && v.length <= max;
const number = (v: unknown, max = 10000): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max;
function record(value: RecipeRecord) {
  return value && string(value.id, 100) && string(value.note) && number(value.waterMl) && value.waterMl > 0 && number(value.cookMinutes, 120) && number(value.noodleFraction, 1) && string(value.createdAt, 40) && string(value.updatedAt, 40) && Array.isArray(value.items) && value.items.length <= 100 && value.items.every((x) => string(x.id, 100) && string(x.name, 100) && string(x.category, 100) && number(x.amount, 1000));
}
export function validNotebook(n: Notebook) {
  if (!n || !n.base || !n.commercial || !n.comparisons || typeof n.comparisons !== "object") return false;
  for (const method of [n.base, n.commercial]) {
    if (!Array.isArray(method.practices) || !Array.isArray(method.tastingHistory) || method.practices.length > 500 || method.tastingHistory.length > 500 || !method.practices.every(record) || !method.tastingHistory.every(record) || (method.tasting && !record(method.tasting))) return false;
  }
  if (!Object.entries(n.comparisons).every(([k,v]) => string(k, 100) && string(v))) return false;
  const f = n.final;
  return !f || ((f.method === "base" || f.method === "commercial") && record(f.record) && string(f.productName, 24) && string(f.tasteLine, 60) && Array.isArray(f.keywords) && f.keywords.length <= 3 && f.keywords.every((x) => string(x, 40)) && number(f.spicyLevel, 3) && Number.isInteger(f.spicyLevel) && typeof f.shared === "boolean");
}
export function sanitizeProject(p: StudentProject): StudentProject {
  // Never accept student health profiles, print names or arbitrary root fields.
  const cleanRecord = (r: RecipeRecord): RecipeRecord => ({ id: r.id, note: r.note, waterMl: r.waterMl, cookMinutes: r.cookMinutes, noodleFraction: r.noodleFraction, createdAt: r.createdAt, updatedAt: r.updatedAt, items: r.items.map((i) => ({ id: i.id, name: i.name, amount: i.amount, category: i.category })) });
  const n = p.notebook!;
  const method = (m: Notebook["base"]) => ({ practices: m.practices.map(cleanRecord), tastingHistory: m.tastingHistory.map(cleanRecord), ...(m.tasting ? { tasting: cleanRecord(m.tasting) } : {}) });
  return { id: p.id, classId: p.classId, studentName: "", teamName: "", experiments: [], bestRecipeIndex: null, label: { productName: "", tasteLine: "", developerName: "" }, updatedAt: p.updatedAt, notebook: { base: method(n.base), commercial: method(n.commercial), comparisons: Object.fromEntries(Object.entries(n.comparisons)), ...(n.final ? { final: { method: n.final.method, record: cleanRecord(n.final.record), productName: n.final.productName, tasteLine: n.final.tasteLine, keywords: n.final.keywords, spicyLevel: n.final.spicyLevel, savedAt: n.final.savedAt, shared: n.final.shared } } : {}) } };
}
