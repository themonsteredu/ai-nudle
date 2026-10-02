export type AllergenInfo = {
  allergens?: string[];
  allergenOther?: string;
  allergenChecked?: boolean;
  facilityNote?: string;
};

export type Ingredient = AllergenInfo & {
  id: string;
  name: string;
  displayName: string;
  category: string;
  imageUrl: string;
  defaultAmount: number;
  minAmount: number;
  maxAmount: number;
  step: number;
  purchasePrice: number;
  purchaseWeight: number;
  allergen: string;
  enabled: boolean;
  order: number;
};

export type Topping = AllergenInfo & {
  id: string;
  name: string;
  displayName: string;
  imageUrl: string;
  amountPerStudent: number;
  purchasePrice: number;
  purchaseWeight: number;
  allergen: string;
  enabled: boolean;
  order: number;
};

export type SupplyCategory =
  | "noodle"
  | "tasting"
  | "container"
  | "consumable"
  | "tool";

export type SupplyItem = {
  id: string;
  name: string;
  category: SupplyCategory;
  vendorNote: string;
  purchasePrice: number;
  purchaseQuantity: number;
  unit: string;
  quantityPerStudent: number;
  fixedQuantity: number;
  enabled: boolean;
  order: number;
};

export type AppSettings = {
  version: number;
  notebookVersion?: number;
  classes?: LessonClass[];
  comparisonSoups?: ComparisonSoup[];
  noodleAllergens?: AllergenInfo;
  className: string;
  studentCount: number;
  testCount: number;
  tastingNoodleFraction: number;
  ingredients: Ingredient[];
  toppings: Topping[];
  supplies: SupplyItem[];
  safetyChecks: string[];
  updatedAt: string;
};

export type Experiment = {
  recipe: Record<string, number>;
  note: string;
  tags: string[];
  saved: boolean;
};

export type ProductLabel = {
  productName: string;
  tasteLine: string;
  developerName: string;
};

export type StudentProject = {
  id: string;
  classId?: string;
  researcherNumber?: number;
  revision?: number;
  createdAt?: string;
  notebook?: Notebook;
  studentName: string;
  teamName: string;
  experiments: Experiment[];
  bestRecipeIndex: number | null;
  label: ProductLabel;
  updatedAt: string;
};

export type CostRow = {
  id: string;
  category: "식재료" | "용기·소모품" | "수업도구";
  name: string;
  needed: number;
  unit: string;
  unitCost: number;
  usedCost: number;
  packCount: number;
  purchaseCost: number;
};

export type CostSummary = {
  rows: CostRow[];
  usedCost: number;
  purchaseCost: number;
  perStudentCost: number;
};

export type LessonClass = {
  id: string;
  name: string;
  code: string;
  waterMl: number;
  cookMinutes: number;
  noodleFraction: number;
};
export type ComparisonSoup = AllergenInfo & { id: string; name: string; enabled: boolean };
export type RecipeMethod = "base" | "commercial";
export type RecipeItem = AllergenInfo & { id: string; name: string; amount: number; category: string };
export type RecipeRecord = {
  id: string;
  items: RecipeItem[];
  note: string;
  waterMl: number;
  cookMinutes: number;
  noodleFraction: number;
  createdAt: string;
  updatedAt: string;
};
export type MethodNotebook = {
  practices: RecipeRecord[];
  tasting?: RecipeRecord;
  tastingHistory: RecipeRecord[];
};
export type Notebook = {
  base: MethodNotebook;
  commercial: MethodNotebook;
  comparisons: Record<string, string>;
  final?: {
    method: RecipeMethod;
    record: RecipeRecord;
    productName: string;
    tasteLine: string;
    keywords: string[];
    spicyLevel: number;
    savedAt: string;
    shared: boolean;
  };
};
