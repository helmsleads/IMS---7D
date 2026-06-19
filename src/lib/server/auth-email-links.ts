import { createServiceClient } from "@/lib/supabase-service";
import {
  getAppUrlForExternalLinks,
  getSupabaseAuthUrlInstructions,
} from "@/lib/server/app-url";

export type AuthLinkType = "invite" | "recovery";

export function buildAppAuthLink(
  hashedToken: string,
  type: AuthLinkType
): string {
  const appOrigin = getAppUrlForExternalLinks();
  const url = new URL("/auth/accept-invite", appOrigin);
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", type);
  return url.toString();
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

  for (const type of types) {
    const { data, error } = await service.auth.admin.generateLink({
      type,
      email: normalizedEmail,
      options: {
        redirectTo: `${appOrigin}/reset-password`,
        ...(metadata ? { data: metadata as { [key: string]: string } } : {}),
      },
    });

    const hashedToken = data?.properties?.hashed_token;

    if (!error && hashedToken && data?.user?.id) {
      return {
        userId: data.user.id,
        actionLink: buildAppAuthLink(hashedToken, type),
        linkType: type,
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
