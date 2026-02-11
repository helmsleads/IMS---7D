import { createClient } from "@/lib/supabase";
import { ProductCategory, ProductSubcategory } from "@/types/database";

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string | null; // Legacy field - kept for backwards compatibility
  category_id: string | null;
  subcategory_id: string | null;
  client_id: string | null;
  unit_cost: number;
  base_price: number;
  reorder_point: number;
  barcode: string | null;
  image_url: string | null;
  active: boolean;
  created_at: string;
  workflow_profile_id: string | null; // Product-level workflow override
}

export interface ProductClient {
  id: string;
  company_name: string;
}

export interface ProductWithCategory extends Product {
  product_category: ProductCategory | null;
  product_subcategory: ProductSubcategory | null;
  client: ProductClient | null;
}

export async function getProducts(clientId?: string): Promise<ProductWithCategory[]> {
  const supabase = createClient();

  let query = supabase
    .from("products")
    .select(`
      *,
      product_category:product_categories (id, name, slug, icon, color),
      product_subcategory:product_subcategories (id, name, slug),
      client:clients (id, company_name)
    `)
    .order("name");

  if (clientId) {
    query = query.eq("client_id", clientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function getProduct(id: string): Promise<ProductWithCategory | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .select(`
      *,
      product_category:product_categories (id, name, slug, icon, color),
      product_subcategory:product_subcategories (id, name, slug),
      client:clients (id, company_name)
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

export async function createProduct(
  product: Partial<Product>
): Promise<Product> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .insert(product)
    .select()
    .single();

  if (error) {
    // Provide user-friendly message for duplicate SKU
    if (error.code === "23505" && error.message.includes("products_sku_key")) {
      throw new Error(`A product with SKU "${product.sku}" already exists. Please use a different SKU.`);
    }
    throw new Error(error.message);
  }

  return data;
}

export async function updateProduct(
  id: string,
  product: Partial<Product>
): Promise<Product> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("products")
    .update(product)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Provide user-friendly message for duplicate SKU
    if (error.code === "23505" && error.message.includes("products_sku_key")) {
      throw new Error(`A product with SKU "${product.sku}" already exists. Please use a different SKU.`);
    }
    throw new Error(error.message);
  }

  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
