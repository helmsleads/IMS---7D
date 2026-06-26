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

export interface DtcClientPortalUserRecord {
  id: string;
  email: string;
  full_name: string | null;
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
 * List all active 7D warehouse clients for DTC connect dropdowns.
 */
export async function listActiveClients() {
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, email, active")
    .eq("active", true)
    .order("company_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as DtcClientRecord[];
}

function uniqueActiveClients(clients: Array<DtcClientRecord | null | undefined>) {
  const byId = new Map<string, DtcClientRecord>();

  for (const client of clients) {
    if (client?.id && client.active) {
      byId.set(client.id, client);
    }
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.company_name.localeCompare(right.company_name),
  );
}

async function portalUserHasClientAccess(userId: string, clientId: string) {
  const supabase = createServiceClient();

  const { data: membership, error: membershipError } = await supabase
    .from("client_users")
    .select("id")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (membership) {
    return true;
  }

  const { data: legacyClient, error: legacyError } = await supabase
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("auth_id", userId)
    .eq("active", true)
    .maybeSingle();

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  return Boolean(legacyClient);
}

async function listActiveClientsForPortalUser(userId: string) {
  const supabase = createServiceClient();

  const { data: memberships, error: membershipError } = await supabase
    .from("client_users")
    .select("client:clients (id, company_name, email, active)")
    .eq("user_id", userId);

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const membershipClients = (memberships ?? []).map((row) => {
    const client = Array.isArray(row.client) ? row.client[0] : row.client;
    return client as DtcClientRecord | null;
  });

  const { data: legacyClients, error: legacyError } = await supabase
    .from("clients")
    .select("id, company_name, email, active")
    .eq("auth_id", userId)
    .eq("active", true);

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  return uniqueActiveClients([...membershipClients, ...(legacyClients ?? [])]);
}

/**
 * List warehouse clients available for DTC connect.
 * Internal admins see all active clients; client portal users see only their assigned clients.
 */
export async function listClientsForDtcConnect(email?: string | null) {
  const normalizedEmail = email?.trim();
  if (!normalizedEmail) {
    return listActiveClients();
  }

  const account = await findActivePortalAccountByEmail(normalizedEmail);
  if (!account) {
    return [];
  }

  if (account.admin_user) {
    return listActiveClients();
  }

  if (account.portal_user) {
    return listActiveClientsForPortalUser(account.portal_user.id);
  }

  return [];
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
 * Find an active 7D warehouse client by contact email (case-insensitive exact match).
 */
export async function findActiveClientByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("clients")
    .select("id, company_name, email, active")
    .eq("active", true)
    .ilike("email", normalized);

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.length) {
    return null;
  }

  const exactMatches = data.filter(
    (row) => row.email?.trim().toLowerCase() === normalized,
  );

  if (exactMatches.length === 1) {
    return exactMatches[0] as DtcClientRecord;
  }

  if (exactMatches.length > 1) {
    const conflict = new Error(`Multiple active 7D clients match email "${email.trim()}"`);
    (conflict as Error & { status?: number }).status = 409;
    throw conflict;
  }

  return data.length === 1 ? (data[0] as DtcClientRecord) : null;
}

/**
 * Resolve DTC integration: 7D portal account by email + warehouse client when available.
 */
export async function resolveDtcIntegrationByEmail(
  email: string,
  companyName?: string | null,
  clientId?: string | null,
) {
  const accountResult = await findActivePortalAccountByEmail(email);
  if (!accountResult) {
    return null;
  }

  let client: DtcClientRecord | null = null;
  let matchedBy = accountResult.matched_by;

  const normalizedClientId = clientId?.trim();
  if (normalizedClientId) {
    client = await getActiveClient(normalizedClientId);
    if (client) {
      if (accountResult.admin_user) {
        matchedBy = "admin_and_client_id";
      } else if (accountResult.portal_user) {
        const hasAccess = await portalUserHasClientAccess(
          accountResult.portal_user.id,
          normalizedClientId,
        );
        if (!hasAccess) {
          const error = new Error(
            "This client portal user does not have access to the selected warehouse client.",
          );
          (error as Error & { status?: number }).status = 403;
          throw error;
        }
        matchedBy = "portal_and_client_id";
      }
    }
  } else if (companyName?.trim()) {
    client = await findActiveClientByCompanyName(companyName);
    if (client) {
      matchedBy = accountResult.admin_user ? "admin_and_company" : "portal_and_company";
    }
  } else if (accountResult.portal_user) {
    const portalClients = await listActiveClientsForPortalUser(accountResult.portal_user.id);
    if (portalClients.length === 1) {
      client = portalClients[0];
      matchedBy = "portal_and_primary_client";
    }
  } else {
    client = await findActiveClientByEmail(email);
    if (client) {
      matchedBy = "admin_and_client_email";
    }
  }

  return {
    admin_user: accountResult.admin_user,
    portal_user: accountResult.portal_user,
    client,
    account: {
      company_name: client?.company_name ?? companyName?.trim() ?? null,
      email: accountResult.account?.email ?? null,
      first_name: accountResult.account?.first_name ?? null,
      last_name: accountResult.account?.last_name ?? null,
    },
    matched_by: matchedBy,
  };
}

/**
 * Resolve an active 7D portal account by email (internal admin or client portal user).
 */
export async function findActivePortalAccountByEmail(email: string) {
  const adminResult = await findActiveAdminByPortalEmail(email);
  if (adminResult) {
    return adminResult;
  }

  return findActiveClientPortalUserByEmail(email);
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

/**
 * Look up an existing 7D client portal user by email.
 */
export async function findActiveClientPortalUserByEmail(email: string) {
  const supabase = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    const error = new Error("email is required");
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  const { data: profiles, error } = await supabase
    .from("user_profiles")
    .select("id, email, full_name")
    .ilike("email", normalizedEmail);

  if (error) {
    throw new Error(error.message);
  }

  const profile = profiles?.find(
    (row) => row.email?.trim().toLowerCase() === normalizedEmail,
  );

  if (!profile) {
    return null;
  }

  const accessibleClients = await listActiveClientsForPortalUser(profile.id);
  if (!accessibleClients.length) {
    return null;
  }

  const nameParts = parsePortalUserName(profile.full_name);

  return {
    admin_user: null,
    portal_user: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
    } as DtcClientPortalUserRecord,
    client: null,
    account: {
      company_name: null,
      email: profile.email,
      first_name: nameParts.first_name,
      last_name: nameParts.last_name,
    },
    matched_by: "client_portal",
  };
}

/** @deprecated Use findActivePortalAccountByEmail — lookup only, no provisioning. */
export async function findActiveClientByPortalEmail(email: string) {
  return findActivePortalAccountByEmail(email);
}
