import type { AppSettings } from "./types";

/**
 * Cost data belongs to the 관리자 화면: purchase lists (supplies) and the purchase price/weight of
 * ingredients and toppings. Each screen saves on top of the newest server settings, so this copies
 * those fields from `source` into `target` and leaves everything else of `target` alone.
 * Items that only exist in `target` (e.g. an ingredient the teacher just added) keep their own values.
 */
export function copyCostFields(target: AppSettings, source: AppSettings): AppSettings {
  const price = <T extends { id: string; purchasePrice: number; purchaseWeight: number }>(items: T[], from: T[]) =>
    items.map((item) => {
      const saved = from.find((x) => x.id === item.id);
      return saved ? { ...item, purchasePrice: saved.purchasePrice, purchaseWeight: saved.purchaseWeight } : item;
    });
  return {
    ...target,
    supplies: source.supplies,
    ingredients: price(target.ingredients, source.ingredients),
    toppings: price(target.toppings, source.toppings),
  };
}
