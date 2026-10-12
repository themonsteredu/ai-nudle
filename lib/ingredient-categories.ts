/**
 * Ingredient kinds (종류). The stored values stay as they are ("BASE", "SPECIAL" or free text):
 * the server, the student 기본 베이스 filter and the SPECIAL tip all read them. Only the labels are friendly.
 */
export const BASE_CATEGORY = "BASE";
export const SPECIAL_CATEGORY = "SPECIAL";
export const ADDITIVE_PRESETS = ["향", "단맛", "매운맛", "짠맛", SPECIAL_CATEGORY, "기타"];

/** Teacher screens. */
export const categoryLabel = (category: string) =>
  category === BASE_CATEGORY ? "기본 스프" : category === SPECIAL_CATEGORY ? "특별 (치즈·카레 등)" : category || "기타";

/** The small tag above each student gram row. */
export const studentCategoryLabel = (category: string) =>
  category === BASE_CATEGORY ? "기본 스프" : category === SPECIAL_CATEGORY ? "특별 재료" : category;
