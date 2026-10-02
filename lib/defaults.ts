import type { AppSettings, Experiment, StudentProject } from "./types";
import { createId } from "./ids";

export const TASTE_TAGS = [
  "더 맵게",
  "덜 맵게",
  "더 진하게",
  "더 순하게",
  "향 추가",
  "현재가 좋음",
];

export const defaultSettings: AppSettings = {
  version: 1,
  className: "라면 R&D 연구소",
  studentCount: 30,
  testCount: 4,
  tastingNoodleFraction: 0.25,
  updatedAt: new Date(0).toISOString(),
  notebookVersion: 2,
  classes: [],
  comparisonSoups: [
    { id: "soup-a", name: "오뚜기 쇠고기 스프", enabled: true, allergens: [], allergenChecked: false },
    { id: "soup-b", name: "짬뽕 스프", enabled: true, allergens: [], allergenChecked: false },
    { id: "soup-c", name: "", enabled: false, allergens: [], allergenChecked: false },
  ],
  noodleAllergens: { allergens: [], allergenChecked: false },
  ingredients: [
    ["beef-base", "쇠고기 조미분말", "BASE"],
    ["anchovy-base", "멸치 조미분말", "BASE"],
    ["bone-base", "사골분말", "BASE"],
    ["garlic-powder", "마늘분말", "향"],
    ["onion-powder", "양파분말", "향"],
    ["pepper", "후추", "향"],
    ["sugar", "설탕", "단맛"],
    ["chili", "고춧가루", "매운맛"],
    ["cheese", "치즈분말", "SPECIAL"],
    ["curry", "카레분말", "SPECIAL"],
  ].map(([id, name, category], order) => ({
    id, name, displayName: name, category, imageUrl: "", defaultAmount: 0,
    minAmount: 0, maxAmount: 20, step: 0.1, purchasePrice: 0, purchaseWeight: 100,
    allergen: "", allergens: [], allergenChecked: false, facilityNote: "", enabled: true, order,
  })),
  toppings: [{
    id: "vegetable-flakes", name: "야채 후레이크", displayName: "야채 후레이크", imageUrl: "",
    amountPerStudent: 0, purchasePrice: 0, purchaseWeight: 100, allergen: "",
    allergens: [], allergenChecked: false, facilityNote: "", enabled: true, order: 0,
  }],
  supplies: [
    {
      id: "noodle",
      name: "사리면",
      category: "noodle",
      vendorNote: "",
      purchasePrice: 10000,
      purchaseQuantity: 20,
      unit: "개",
      quantityPerStudent: 2,
      fixedQuantity: 0,
      enabled: true,
      order: 1,
    },
    {
      id: "tasting-cup",
      name: "시식컵",
      category: "tasting",
      vendorNote: "",
      purchasePrice: 5000,
      purchaseQuantity: 100,
      unit: "개",
      quantityPerStudent: 4,
      fixedQuantity: 0,
      enabled: true,
      order: 2,
    },
    {
      id: "final-bowl",
      name: "무지 라면용기",
      category: "container",
      vendorNote: "",
      purchasePrice: 12000,
      purchaseQuantity: 50,
      unit: "개",
      quantityPerStudent: 1,
      fixedQuantity: 0,
      enabled: true,
      order: 3,
    },
    {
      id: "soup-pouch",
      name: "스프 소분팩",
      category: "consumable",
      vendorNote: "",
      purchasePrice: 3000,
      purchaseQuantity: 100,
      unit: "개",
      quantityPerStudent: 1,
      fixedQuantity: 0,
      enabled: true,
      order: 4,
    },
    {
      id: "topping-pouch",
      name: "건더기 소분팩",
      category: "consumable",
      vendorNote: "",
      purchasePrice: 3000,
      purchaseQuantity: 100,
      unit: "개",
      quantityPerStudent: 1,
      fixedQuantity: 0,
      enabled: true,
      order: 5,
    },
    {
      id: "label-paper",
      name: "라벨지",
      category: "consumable",
      vendorNote: "",
      purchasePrice: 5000,
      purchaseQuantity: 100,
      unit: "매",
      quantityPerStudent: 1,
      fixedQuantity: 0,
      enabled: true,
      order: 6,
    },
    {
      id: "gloves",
      name: "위생장갑",
      category: "tool",
      vendorNote: "",
      purchasePrice: 8000,
      purchaseQuantity: 200,
      unit: "장",
      quantityPerStudent: 2,
      fixedQuantity: 0,
      enabled: true,
      order: 7,
    },
    {
      id: "measuring-spoon",
      name: "계량스푼",
      category: "tool",
      vendorNote: "모둠별 1세트",
      purchasePrice: 6000,
      purchaseQuantity: 10,
      unit: "개",
      quantityPerStudent: 0,
      fixedQuantity: 8,
      enabled: true,
      order: 8,
    },
  ],
  safetyChecks: [
    "수업 전 모든 학생의 식품 알레르기를 확인했다.",
    "뜨거운 물은 교사가 제공하고 학생이 직접 운반하지 않는다.",
    "시식 전 손 씻기와 위생장갑 착용을 확인한다.",
    "사용 재료의 소비기한과 보관 상태를 확인한다.",
    "시식컵이 뜨거울 때는 지정된 자리에서 충분히 식힌다.",
  ],
};

export function blankExperiment(settings: AppSettings): Experiment {
  return {
    recipe: Object.fromEntries(
      settings.ingredients.map((ingredient) => [
        ingredient.id,
        ingredient.enabled ? ingredient.defaultAmount : 0,
      ]),
    ),
    note: "",
    tags: [],
    saved: false,
  };
}

export function createStudentProject(
  settings: AppSettings,
  id = createId("student"),
): StudentProject {
  return {
    id,
    studentName: "",
    teamName: "",
    experiments: Array.from({ length: settings.testCount }, () =>
      blankExperiment(settings),
    ),
    bestRecipeIndex: null,
    label: { productName: "", tasteLine: "", developerName: "" },
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeProject(
  project: StudentProject,
  settings: AppSettings,
): StudentProject {
  // Legacy experiments are never resized or stripped when teacher settings change.
  void settings;
  return { ...project, experiments: project.experiments ?? [] };
}
