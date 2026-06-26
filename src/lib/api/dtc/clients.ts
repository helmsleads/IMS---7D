import { createServiceClient } from "@/lib/supabase-service";

export interface DtcClientRecord {
  id: string;
  company_name: string;
  email: string | null;
  active: boolean;
}

export interface DtcPortalAccount {
  company_name: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

function parsePortalUserName(fullName: string | null | undefined) {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return { first_name: null, last_name: null };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

function buildPortalAccount(
  client: DtcClientRecord & { contact_name?: string | null },
  portalUser?: { email?: string | null; full_name?: string | null } | null,
): DtcPortalAccount {
  const nameParts = portalUser?.full_name
    ? parsePortalUserName(portalUser.full_name)
    : parsePortalUserName(client.contact_name);

  return {
    company_name: client.company_name,
    email: portalUser?.email ?? client.email ?? null,
    first_name: nameParts.first_name,
    last_name: nameParts.last_name,
  };
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

export async function findActiveClientByPortalEmail(email: string) {
  const supabase = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    const error = new Error("email is required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (profile) {
    const { data: clientUsers, error: clientUsersError } = await supabase
      .from("client_users")
      .select("client_id, is_primary, client:clients(id, company_name, email, contact_name, active)")
      .eq("user_id", profile.id)
      .order("is_primary", { ascending: false });

    if (clientUsersError) {
      throw new Error(clientUsersError.message);
    }

    for (const row of clientUsers ?? []) {
      const client = Array.isArray(row.client) ? row.client[0] : row.client;
      if (client?.active) {
        return {
          client: client as DtcClientRecord,
          portal_user: {
            id: profile.id,
            email: profile.email,
            full_name: profile.full_name,
          },
          account: buildPortalAccount(client as DtcClientRecord, profile),
          matched_by: "portal_user",
        };
      }
    }

    const { data: legacyClient, error: legacyError } = await supabase
      .from("clients")
      .select("id, company_name, email, contact_name, active")
      .eq("auth_id", profile.id)
      .eq("active", true)
      .maybeSingle();

    if (legacyError) {
      throw new Error(legacyError.message);
    }

    if (legacyClient) {
      return {
        client: legacyClient as DtcClientRecord,
        portal_user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
        },
        account: buildPortalAccount(legacyClient as DtcClientRecord, profile),
        matched_by: "legacy_auth_id",
      };
    }
  }

  const { data: clientByEmail, error: clientEmailError } = await supabase
    .from("clients")
    .select("id, company_name, email, active")
    .eq("email", normalizedEmail)
    .eq("active", true)
    .maybeSingle();

  if (clientEmailError) {
    throw new Error(clientEmailError.message);
  }

  if (clientByEmail) {
    return {
      client: clientByEmail as DtcClientRecord,
      portal_user: null,
      account: buildPortalAccount(clientByEmail),
      matched_by: "client_email",
    };
  }

  return null;
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
