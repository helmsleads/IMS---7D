import { createClient } from "@/lib/supabase";
import { ProductCategory, ProductSubcategory } from "@/types/database";

// ============================================
// Category Types
// ============================================

export interface CategoryWithSubcategories extends ProductCategory {
  subcategories: ProductSubcategory[];
}

export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface CreateSubcategoryData {
  category_id: string;
  name: string;
  slug?: string;
  description?: string | null;
  sort_order?: number;
}

export interface UpdateSubcategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

// ============================================
// Helper Functions
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ============================================
// Category Functions
// ============================================

export async function getCategories(
  includeInactive: boolean = false
): Promise<ProductCategory[]> {
  const supabase = createClient();

  let query = supabase
    .from("product_categories")
    .select("*")
    .order("sort_order")
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getCategoriesWithSubcategories(
  includeInactive: boolean = false
): Promise<CategoryWithSubcategories[]> {
  const supabase = createClient();

  let query = supabase
    .from("product_categories")
    .select(`
      *,
      subcategories:product_subcategories (*)
    `)
    .order("sort_order")
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  // Sort subcategories within each category
  return (data || []).map((category) => ({
    ...category,
    subcategories: (category.subcategories || [])
      .filter((sub: ProductSubcategory) => includeInactive || sub.is_active)
      .sort((a: ProductSubcategory, b: ProductSubcategory) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name);
      }),
  }));
}

export async function getCategory(id: string): Promise<ProductCategory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_categories")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function getCategoryBySlug(
  slug: string
): Promise<CategoryWithSubcategories | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_categories")
    .select(`
      *,
      subcategories:product_subcategories (*)
    `)
    .eq("slug", slug)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return {
    ...data,
    subcategories: (data.subcategories || []).sort(
      (a: ProductSubcategory, b: ProductSubcategory) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return a.name.localeCompare(b.name);
      }
    ),
  };
}

export async function createCategory(
  data: CreateCategoryData
): Promise<ProductCategory> {
  const supabase = createClient();

  const slug = data.slug || generateSlug(data.name);

  const { data: category, error } = await supabase
    .from("product_categories")
    .insert({
      name: data.name,
      slug,
      description: data.description || null,
      icon: data.icon || null,
      color: data.color || null,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this name or slug already exists");
    }
    throw new Error(error.message);
  }

  return category;
}

export async function updateCategory(
  id: string,
  data: UpdateCategoryData
): Promise<ProductCategory> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
    // Auto-update slug if name changes and slug not explicitly provided
    if (data.slug === undefined) {
      updateData.slug = generateSlug(data.name);
    }
  }
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.icon !== undefined) updateData.icon = data.icon;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const { data: category, error } = await supabase
    .from("product_categories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A category with this name or slug already exists");
    }
    throw new Error(error.message);
  }

  return category;
}

export async function deleteCategory(id: string): Promise<void> {
  const supabase = createClient();

  // Check if any products are using this category
  const { count, error: countError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);

  if (countError) {
    throw new Error(countError.message);
  }

  if (count && count > 0) {
    throw new Error(
      `Cannot delete category: ${count} product(s) are using this category. Please reassign them first.`
    );
  }

  const { error } = await supabase
    .from("product_categories")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// Subcategory Functions
// ============================================

export async function getSubcategories(
  categoryId?: string,
  includeInactive: boolean = false
): Promise<ProductSubcategory[]> {
  const supabase = createClient();

  let query = supabase
    .from("product_subcategories")
    .select(`
      *,
      category:product_categories (id, name, slug)
    `)
    .order("sort_order")
    .order("name");

  if (categoryId) {
    query = query.eq("category_id", categoryId);
  }

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getSubcategory(
  id: string
): Promise<ProductSubcategory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("product_subcategories")
    .select(`
      *,
      category:product_categories (id, name, slug)
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

export async function createSubcategory(
  data: CreateSubcategoryData
): Promise<ProductSubcategory> {
  const supabase = createClient();

  const slug = data.slug || generateSlug(data.name);

  const { data: subcategory, error } = await supabase
    .from("product_subcategories")
    .insert({
      category_id: data.category_id,
      name: data.name,
      slug,
      description: data.description || null,
      sort_order: data.sort_order ?? 0,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "A subcategory with this name already exists in this category"
      );
    }
    throw new Error(error.message);
  }

  return subcategory;
}

export async function updateSubcategory(
  id: string,
  data: UpdateSubcategoryData
): Promise<ProductSubcategory> {
  const supabase = createClient();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (data.name !== undefined) {
    updateData.name = data.name;
    if (data.slug === undefined) {
      updateData.slug = generateSlug(data.name);
    }
  }
  if (data.slug !== undefined) updateData.slug = data.slug;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sort_order !== undefined) updateData.sort_order = data.sort_order;
  if (data.is_active !== undefined) updateData.is_active = data.is_active;

  const { data: subcategory, error } = await supabase
    .from("product_subcategories")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "A subcategory with this name already exists in this category"
      );
    }
    throw new Error(error.message);
  }

  return subcategory;
}

export async function deleteSubcategory(id: string): Promise<void> {
  const supabase = createClient();

  // Check if any products are using this subcategory
  const { count, error: countError } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("subcategory_id", id);

  if (countError) {
    throw new Error(countError.message);
  }

  if (count && count > 0) {
    throw new Error(
      `Cannot delete subcategory: ${count} product(s) are using this subcategory. Please reassign them first.`
    );
  }

  const { error } = await supabase
    .from("product_subcategories")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// Product Category Assignment
// ============================================

export async function assignProductCategory(
  productId: string,
  categoryId: string | null,
  subcategoryId: string | null = null
): Promise<void> {
  const supabase = createClient();

  // Validate that subcategory belongs to category if both are provided
  if (categoryId && subcategoryId) {
    const { data: subcategory, error: subError } = await supabase
      .from("product_subcategories")
      .select("category_id")
      .eq("id", subcategoryId)
      .single();

    if (subError) {
      throw new Error("Subcategory not found");
    }

    if (subcategory.category_id !== categoryId) {
      throw new Error("Subcategory does not belong to the selected category");
    }
  }

  const { error } = await supabase
    .from("products")
    .update({
      category_id: categoryId,
      subcategory_id: subcategoryId,
    })
    .eq("id", productId);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// Category Statistics
// ============================================

export async function getCategoryStats(): Promise<
  Array<{
    category_id: string;
    category_name: string;
    product_count: number;
    subcategory_count: number;
  }>
> {
  const supabase = createClient();

  const { data: categories, error: catError } = await supabase
    .from("product_categories")
    .select(`
      id,
      name,
      subcategories:product_subcategories (count)
    `)
    .eq("is_active", true);

  if (catError) {
    throw new Error(catError.message);
  }

  // Get product counts per category
  const { data: productCounts, error: prodError } = await supabase
    .from("products")
    .select("category_id")
    .not("category_id", "is", null);

  if (prodError) {
    throw new Error(prodError.message);
  }

  // Count products per category
  const countMap = new Map<string, number>();
  for (const product of productCounts || []) {
    const current = countMap.get(product.category_id) || 0;
    countMap.set(product.category_id, current + 1);
  }

  return (categories || []).map((cat) => ({
    category_id: cat.id,
    category_name: cat.name,
    product_count: countMap.get(cat.id) || 0,
    subcategory_count: cat.subcategories?.[0]?.count || 0,
  }));
}
