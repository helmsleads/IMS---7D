import { createServiceClient } from "@/lib/supabase-service";

export interface DtcClientRecord {
  id: string;
  company_name: string;
  email: string | null;
  active: boolean;
}

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

export interface CreateDtcClientInput {
  company_name: string;
  email: string;
  contact_name?: string | null;
  dtc_portal_user_id?: string | null;
}

export async function createDtcClient(input: CreateDtcClientInput) {
  const supabase = createServiceClient();
  const normalizedEmail = input.email.trim().toLowerCase();
  const companyName = input.company_name.trim();
  const portalUserId = input.dtc_portal_user_id?.trim() || null;

  if (!companyName) {
    const error = new Error("company_name is required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  if (!normalizedEmail) {
    const error = new Error("email is required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      company_name: companyName,
      email: normalizedEmail,
      contact_name: input.contact_name?.trim() || null,
      active: true,
      industries: ["wine", "spirits"],
      allow_product_workflow_override: false,
    })
    .select("id, company_name, email, active")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return { client: data as DtcClientRecord, created: true, dtc_portal_user_id: portalUserId };
}
