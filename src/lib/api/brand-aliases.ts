import { createClient } from "@/lib/supabase";

export interface BrandAliasRow {
  id: string;
  alias: string;
  client_id: string;
  created_at: string;
  client_name?: string;
}

export async function getBrandAliases(): Promise<BrandAliasRow[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("brand_aliases")
    .select("id, alias, client_id, created_at, clients(company_name)")
    .order("alias");

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: Record<string, unknown>) => {
    const client = row.clients as { company_name: string } | null;
    return {
      id: row.id as string,
      alias: row.alias as string,
      client_id: row.client_id as string,
      created_at: row.created_at as string,
      client_name: client?.company_name || "Unknown",
    };
  });
}

export async function deleteBrandAlias(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("brand_aliases")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAllBrandAliases(): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("brand_aliases")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) {
    throw new Error(error.message);
  }
}
