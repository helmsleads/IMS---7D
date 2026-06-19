const AUTH_HASH_MARKERS = ["access_token", "type=invite", "type=recovery"];
const AUTH_ERROR_HASH_MARKERS = ["error=access_denied", "error_code=otp_expired"];

function parseHashParams(hash: string): URLSearchParams {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(raw);
}

export function getHashSessionTokens(): {
  access_token: string;
  refresh_token: string;
} | null {
  if (typeof window === "undefined") return null;

  const params = parseHashParams(window.location.hash);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");

  if (access_token && refresh_token) {
    return { access_token, refresh_token };
  }

  return null;
}

export function isInviteOrRecoveryHash(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  return hash.includes("type=invite") || hash.includes("type=recovery");
}

export function clearAuthHashFromUrl(): void {
  if (typeof window === "undefined" || !window.location.hash) return;
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}`
  );
}

export function clearAuthCodeFromUrl(): void {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  if (!params.has("code")) return;
  params.delete("code");
  const query = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${query ? `?${query}` : ""}`
  );
}

export function getAuthLinkErrorFromUrl(): string | null {
  if (typeof window === "undefined") return null;

  const hashParams = parseHashParams(window.location.hash);
  const queryParams = new URLSearchParams(window.location.search);

  const errorCode =
    hashParams.get("error_code") || queryParams.get("error_code");
  const errorDescription =
    hashParams.get("error_description") || queryParams.get("error_description");

  if (errorCode === "otp_expired") {
    return "This invitation link has expired. Ask your administrator to send a new one.";
  }

  if (
    hashParams.get("error") === "access_denied" ||
    queryParams.get("error") === "access_denied"
  ) {
    return (
      errorDescription?.replace(/\+/g, " ") ||
      "This invitation link is invalid or has expired."
    );
  }

  return null;
}

export function getPasswordSetupRedirectUrl(): string | null {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (hash && AUTH_ERROR_HASH_MARKERS.some((marker) => hash.includes(marker))) {
    return `/reset-password?expired=1`;
  }

  if (hash && AUTH_HASH_MARKERS.some((marker) => hash.includes(marker))) {
    return `/reset-password${hash}`;
  }

  const params = new URLSearchParams(window.location.search);
  if (
    params.get("code") ||
    params.get("type") === "recovery" ||
    params.get("type") === "invite"
  ) {
    return `/reset-password${window.location.search}`;
  }

  return null;
}

export function hasAuthHashInUrl(): boolean {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash;
  return !!hash && AUTH_HASH_MARKERS.some((marker) => hash.includes(marker));
}

/** Full URL for Supabase resetPasswordForEmail / invite redirectTo. */
export function getPasswordSetupEmailRedirectUrl(): string {
  const origin =
    (typeof window !== "undefined" ? window.location.origin : undefined) ||
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  return `${origin}/reset-password`;
}

/** @deprecated Use getPasswordSetupEmailRedirectUrl */
export function getAuthCallbackUrl(): string {
  return getPasswordSetupEmailRedirectUrl();
}
