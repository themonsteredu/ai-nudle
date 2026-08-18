import type { AppSettings, CostRow, CostSummary } from "./types";

const safeDivide = (value: number, divisor: number) =>
  divisor > 0 ? value / divisor : 0;

export function ingredientUnitCost(price: number, weight: number) {
  return safeDivide(price, weight);
}

export function calculateCosts(
  settings: AppSettings,
  studentCount = settings.studentCount,
): CostSummary {
  const students = Math.max(1, studentCount || 1);
  const finalScale = safeDivide(1, settings.tastingNoodleFraction || 0.25);
  const rows: CostRow[] = [];

  settings.ingredients
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order)
    .forEach((item) => {
      const needed =
        item.defaultAmount * (settings.testCount + finalScale) * students;
      const unitCost = ingredientUnitCost(item.purchasePrice, item.purchaseWeight);
      const packCount = item.purchaseWeight > 0 ? Math.ceil(needed / item.purchaseWeight) : 0;
      rows.push({
        id: item.id,
        category: "식재료",
        name: item.displayName,
        needed,
        unit: "g",
        unitCost,
        usedCost: needed * unitCost,
        packCount,
        purchaseCost: packCount * item.purchasePrice,
      });
    });

  settings.toppings
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order)
    .forEach((item) => {
      const needed = item.amountPerStudent * students;
      const unitCost = ingredientUnitCost(item.purchasePrice, item.purchaseWeight);
      const packCount = item.purchaseWeight > 0 ? Math.ceil(needed / item.purchaseWeight) : 0;
      rows.push({
        id: item.id,
        category: "식재료",
        name: item.displayName,
        needed,
        unit: "g",
        unitCost,
        usedCost: needed * unitCost,
        packCount,
        purchaseCost: packCount * item.purchasePrice,
      });
    });

  settings.supplies
    .filter((item) => item.enabled)
    .sort((a, b) => a.order - b.order)
    .forEach((item) => {
      const needed = item.quantityPerStudent * students + item.fixedQuantity;
      const unitCost = safeDivide(item.purchasePrice, item.purchaseQuantity);
      const packCount =
        item.purchaseQuantity > 0 ? Math.ceil(needed / item.purchaseQuantity) : 0;
      rows.push({
        id: item.id,
        category: item.category === "tool" ? "수업도구" : "용기·소모품",
        name: item.name,
        needed,
        unit: item.unit,
        unitCost,
        usedCost: needed * unitCost,
        packCount,
        purchaseCost: packCount * item.purchasePrice,
      });
    });

  const usedCost = rows.reduce((sum, row) => sum + row.usedCost, 0);
  const purchaseCost = rows.reduce((sum, row) => sum + row.purchaseCost, 0);

  return {
    rows,
    usedCost,
    purchaseCost,
    perStudentCost: usedCost / students,
  };
}

export const roundQuantity = (value: number) =>
  Number.isInteger(value) ? value.toString() : value.toFixed(1);

export const won = (value: number) =>
  `${Math.round(value).toLocaleString("ko-KR")}원`;
