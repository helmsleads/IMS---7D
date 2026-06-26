import { createServiceClient } from "@/lib/supabase-service";

export interface DtcClientRecord {
  id: string;
  company_name: string;
  email: string | null;
  active: boolean;
}

export interface DtcAdminUserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export interface DtcPortalAccount {
  company_name: string | null;
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

export async function getActiveClient(clientId: string) {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, email, active")
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

/**
 * Find an active 7D warehouse client by company name (case-insensitive exact match).
 */
export async function findActiveClientByCompanyName(companyName: string) {
  const normalized = companyName.trim();
  if (!normalized) {
    return null;
  }

  const supabase = createServiceClient();
  const target = normalized.toLowerCase();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, email, active")
    .eq("active", true)
    .ilike("company_name", normalized);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    return null;
  }

  const exactMatches = data.filter(
    (row) => row.company_name?.trim().toLowerCase() === target,
  );

  if (exactMatches.length === 1) {
    return exactMatches[0] as DtcClientRecord;
  }

  if (exactMatches.length > 1) {
    const conflict = new Error(
      `Multiple active 7D clients match company name "${normalized}"`,
    );
    (conflict as Error & { status?: number }).status = 409;
    throw conflict;
  }

  return data.length === 1 ? (data[0] as DtcClientRecord) : null;
}

/**
 * Resolve DTC integration: admin user by email + warehouse client by company name.
 */
export async function resolveDtcIntegrationByEmail(
  email: string,
  companyName?: string | null,
) {
  const adminResult = await findActiveAdminByPortalEmail(email);
  if (!adminResult) {
    return null;
  }

  let client: DtcClientRecord | null = null;
  let matchedBy = adminResult.matched_by;

  if (companyName?.trim()) {
    client = await findActiveClientByCompanyName(companyName);
    if (client) {
      matchedBy = "admin_and_company";
    }
  }

  return {
    admin_user: adminResult.admin_user,
    portal_user: adminResult.portal_user,
    client,
    account: {
      company_name: client?.company_name ?? companyName?.trim() ?? null,
      email: adminResult.account?.email ?? null,
      first_name: adminResult.account?.first_name ?? null,
      last_name: adminResult.account?.last_name ?? null,
    },
    matched_by: matchedBy,
  };
}

/**
 * Look up an existing 7D internal admin (staff) user by email.
 * Does not create users or clients — returns null when not found.
 */
export async function findActiveAdminByPortalEmail(email: string) {
  const supabase = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    const error = new Error("email is required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const { data: staffUser, error } = await supabase
    .from("users")
    .select("id, name, email, role, active")
    .ilike("email", normalizedEmail)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!staffUser) {
    return null;
  }

  const nameParts = parsePortalUserName(staffUser.name);

  return {
    admin_user: staffUser as DtcAdminUserRecord,
    portal_user: null,
    client: null,
    account: {
      company_name: null,
      email: staffUser.email,
      first_name: nameParts.first_name,
      last_name: nameParts.last_name,
    },
    matched_by: "internal_admin",
  };
}

/** @deprecated Use findActiveAdminByPortalEmail — lookup only, no provisioning. */
export async function findActiveClientByPortalEmail(email: string) {
  return findActiveAdminByPortalEmail(email);
}
