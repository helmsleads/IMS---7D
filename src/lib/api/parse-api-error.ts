/** Shape returned by API routes on failure */
export interface ApiErrorBody {
  error?: string;
  message?: string;
  notice?: string;
  details?: string;
  step?: string;
}

export function formatApiError(
  data: ApiErrorBody | null | undefined,
  fallback: string,
  status?: number
): string {
  const main = data?.error ?? data?.message ?? data?.notice;
  const parts: string[] = [];

  if (typeof main === "string" && main.trim()) {
    parts.push(main.trim());
  }
  if (typeof data?.details === "string" && data.details.trim()) {
    parts.push(data.details.trim());
  }
  if (typeof data?.step === "string" && data.step.trim()) {
    parts.push(`Step: ${data.step}`);
  }

  if (parts.length > 0) {
    return parts.join(" — ");
  }

  if (status) {
    return `${fallback} (HTTP ${status})`;
  }

  return fallback;
}

/** Read a failed fetch response and return a user-visible message */
export async function parseFetchError(
  res: Response,
  fallback: string
): Promise<string> {
  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;
    return formatApiError(data, fallback, res.status);
  }

  const text = (await res.text().catch(() => "")).trim();
  if (text) {
    const snippet = text.length > 280 ? `${text.slice(0, 280)}…` : text;
    return `${fallback} (HTTP ${res.status}): ${snippet}`;
  }

  return formatApiError(undefined, fallback, res.status);
}
