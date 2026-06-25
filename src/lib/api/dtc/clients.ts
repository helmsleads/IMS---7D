import { createServiceClient } from "@/lib/supabase-service";

export async function getActiveClient(clientId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, active")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || !data.active) {
    return null;
  }

  return data;
}
