import { createServiceClient } from "@/lib/supabase-service";
import {
  getAppUrlForExternalLinks,
  getSupabaseAuthUrlInstructions,
} from "@/lib/server/app-url";
import { ensureSupabaseAuthOtpExpiry } from "@/lib/server/supabase-auth-config";

export type AuthLinkType = "invite" | "recovery" | "magiclink";

/**
 * Build an invite/reset link using a URL hash for the token.
 * Email scanners only prefetch the path (/auth/accept-invite) — not the #fragment —
 * so the one-time token is not consumed before the user opens the link.
 */
export function buildAppAuthLink(
  hashedToken: string,
  type: AuthLinkType
): string {
  const appOrigin = getAppUrlForExternalLinks();
  const params = new URLSearchParams({
    token_hash: hashedToken,
    type,
  });
  return `${appOrigin}/auth/accept-invite#${params.toString()}`;
}

export async function generateAuthEmailLink(
  email: string,
  types: AuthLinkType[],
  metadata?: Record<string, unknown>
): Promise<
  | { userId: string; actionLink: string; linkType: AuthLinkType }
  | { error: string; details?: string }
> {
  const service = createServiceClient();
  const normalizedEmail = email.trim().toLowerCase();
  const appOrigin = getAppUrlForExternalLinks();
  const attemptErrors: string[] = [];

  await ensureSupabaseAuthOtpExpiry();

  for (const type of types) {
    const { data, error } = await service.auth.admin.generateLink({
      type: type === "magiclink" ? "magiclink" : type,
      email: normalizedEmail,
      options: {
        redirectTo: `${appOrigin}/reset-password`,
        ...(metadata ? { data: metadata as { [key: string]: string } } : {}),
      },
    });

    const hashedToken = data?.properties?.hashed_token;
    const verificationType = (data?.properties?.verification_type ||
      type) as AuthLinkType;

    if (!error && hashedToken && data?.user?.id) {
      return {
        userId: data.user.id,
        actionLink: buildAppAuthLink(hashedToken, verificationType),
        linkType: verificationType,
      };
    }

    if (error) {
      const label = type === "invite" ? "Invite link" : "Password reset link";
      attemptErrors.push(`${label}: ${error.message}`);
      const msg = error.message.toLowerCase();
      const retryWithRecovery =
        type === "invite" &&
        (msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists"));
      if (retryWithRecovery) continue;
      return {
        error: error.message,
        details: attemptErrors.join("; "),
      };
    }

    attemptErrors.push(
      `${type === "invite" ? "Invite link" : "Password reset link"}: no link returned from Supabase`
    );
  }

  return {
    error: "Could not create an authentication link for this email.",
    details: [
      ...attemptErrors,
      `App origin used: ${appOrigin}`,
      getSupabaseAuthUrlInstructions(),
    ].join(" "),
  };
}
