/**
 * Alcohol classification from product categories (Products → Categories).
 * Beer, Wine, Spirits, and RTD are alcohol; all other categories are non-alcoholic.
 */

export const ALCOHOL_CATEGORY_SLUGS = ["beer", "wine", "spirits", "rtd"] as const;

export type AlcoholCategorySlug = (typeof ALCOHOL_CATEGORY_SLUGS)[number];

export interface ProductCategoryRef {
  name?: string | null;
  slug?: string | null;
}

function normalizeCategoryKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function getCategoryKey(
  category: ProductCategoryRef | string | null | undefined
): string {
  if (!category) return "";
  if (typeof category === "string") return normalizeCategoryKey(category);
  return normalizeCategoryKey(category.slug || category.name || "");
}

export function isAlcoholCategory(
  category: ProductCategoryRef | string | null | undefined
): boolean {
  const key = getCategoryKey(category);
  if (!key) return false;
  return (ALCOHOL_CATEGORY_SLUGS as readonly string[]).includes(key);
}

export function orderContainsAlcohol(
  categories: Array<ProductCategoryRef | string | null | undefined>
): boolean {
  return categories.some((category) => isAlcoholCategory(category));
}

export function selectedProductsContainAlcohol<
  T extends { product_id: string },
  I extends { product_id: string; product_category?: ProductCategoryRef | null }
>(selectedProducts: T[], inventoryItems: I[]): boolean {
  const categories = selectedProducts.map((selected) => {
    const item = inventoryItems.find((inv) => inv.product_id === selected.product_id);
    return item?.product_category;
  });
  return orderContainsAlcohol(categories);
}
