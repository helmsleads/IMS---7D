/**
 * Provision a 7D warehouse client + portal invite for DTC signups.
 */

import { createServiceClient } from "@/lib/supabase-service";
import { sendUserInvitation } from "@/lib/server/invite-user";
import {
  findActiveClientByCompanyName,
  findActiveClientByEmail,
  findActivePortalAccountByEmail,
  type DtcClientRecord,
} from "@/lib/api/dtc/clients";

export type SignupSource = "dtc" | "7d_invitation";

export interface ProvisionDtcClientInput {
  email: string;
  company_name: string;
  contact_name?: string | null;
  /** Funnel reference — which brand the user said they belong to */
  brand_affiliation?: string | null;
  signup_source?: SignupSource;
}

export interface ProvisionDtcClientResult {
  client: DtcClientRecord;
  created_client: boolean;
  portal_invite: {
    sent: boolean;
    user_id?: string;
    invite_link?: string;
    email_warning?: string;
    already_had_portal_access?: boolean;
  };
  signup_source: SignupSource;
  brand_affiliation: string | null;
}

function splitName(fullName: string | null | undefined) {
  const trimmed = fullName?.trim();
  if (!trimmed) {
    return { first_name: null as string | null, last_name: null as string | null };
  }
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: null };
  }
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

/**
 * Create (or reuse) a warehouse client and invite the email to the 7D portal.
 * Used when a brand signs up through DTC and does not yet have a 7D account.
 */
export async function provisionDtcClientAndPortalUser(
  input: ProvisionDtcClientInput,
): Promise<ProvisionDtcClientResult> {
  const email = input.email.trim().toLowerCase();
  const companyName = input.company_name.trim();
  const brandAffiliation = (input.brand_affiliation ?? companyName)?.trim() || null;
  const signupSource: SignupSource = input.signup_source ?? "dtc";
  const contactName = input.contact_name?.trim() || companyName;

  if (!email) {
    const err = new Error("email is required");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
  if (!companyName) {
    const err = new Error("company_name is required");
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  const supabase = createServiceClient();

  let client =
    (await findActiveClientByCompanyName(companyName)) ??
    (await findActiveClientByEmail(email));
  let createdClient = false;

  if (!client) {
    const { data, error } = await supabase
      .from("clients")
      .insert({
        company_name: companyName,
        email,
        contact_name: contactName,
        active: true,
        industries: ["spirits"],
        allow_product_workflow_override: false,
      })
      .select("id, company_name, email, active")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    client = data as DtcClientRecord;
    createdClient = true;
  }

  // Best-effort funnel metadata (columns may not exist until migration runs)
  try {
    await supabase
      .from("clients")
      .update({
        signup_source: signupSource,
        brand_affiliation: brandAffiliation,
        updated_at: new Date().toISOString(),
      })
      .eq("id", client.id);
  } catch {
    /* optional columns */
  }

  const existingPortal = await findActivePortalAccountByEmail(email);
  if (existingPortal?.portal_user || existingPortal?.admin_user) {
    if (existingPortal.portal_user) {
      const { data: membership } = await supabase
        .from("client_users")
        .select("id")
        .eq("user_id", existingPortal.portal_user.id)
        .eq("client_id", client.id)
        .maybeSingle();

      if (!membership) {
        await supabase.from("client_users").insert({
          client_id: client.id,
          user_id: existingPortal.portal_user.id,
          role: "owner",
          is_primary: true,
          invited_at: new Date().toISOString(),
          accepted_at: new Date().toISOString(),
        });
      }
    }

    return {
      client,
      created_client: createdClient,
      portal_invite: {
        sent: false,
        already_had_portal_access: true,
        user_id: existingPortal.portal_user?.id ?? existingPortal.admin_user?.id,
      },
      signup_source: signupSource,
      brand_affiliation: brandAffiliation,
    };
  }

  const { first_name, last_name } = splitName(contactName);
  const invite = await sendUserInvitation({
    email,
    full_name: [first_name, last_name].filter(Boolean).join(" ") || companyName,
    user_type: "portal",
    role: "owner",
    client_id: client.id,
  });

  if (!invite.success) {
    const err = new Error(invite.error || "Failed to invite 7D portal user");
    (err as Error & { status?: number; details?: string }).status = 503;
    (err as Error & { details?: string }).details = invite.details;
    throw err;
  }

  return {
    client,
    created_client: createdClient,
    portal_invite: {
      sent: invite.emailSent,
      user_id: invite.userId,
      invite_link: invite.inviteLink,
      email_warning: invite.emailWarning,
    },
    signup_source: signupSource,
    brand_affiliation: brandAffiliation,
  };
}
