/**
 * Global US alcohol DTC restricted-state matrix.
 * Stored in system_settings (category=dtc, key=alcohol_restricted_states).
 */

export const DTC_SETTINGS_CATEGORY = "dtc";
export const ALCOHOL_RESTRICTED_STATES_KEY = "alcohol_restricted_states";

/** Default when no system setting exists yet. */
export const DEFAULT_ALCOHOL_RESTRICTED_US_STATES = [
  "AL",
  "AR",
  "DE",
  "HI",
  "MS",
  "RI",
  "SD",
  "UT",
] as const;

export const US_STATE_CODES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
  "DC", "PR",
] as const;

export function normalizeStateCodeList(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : value.split(",");
          } catch {
            return value.split(",");
          }
        })()
      : [];

  const allowed = new Set<string>(US_STATE_CODES);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of raw) {
    const code = String(item || "")
      .trim()
      .toUpperCase();
    if (!code || !allowed.has(code) || seen.has(code)) {
      continue;
    }
    seen.add(code);
    result.push(code);
  }

  return result.sort();
}

export function resolveAlcoholRestrictedStates(value: unknown): {
  restricted_states: string[];
  source: "system_settings" | "default";
} {
  if (value == null) {
    return {
      restricted_states: [...DEFAULT_ALCOHOL_RESTRICTED_US_STATES],
      source: "default",
    };
  }

  const normalized = normalizeStateCodeList(value);
  if (normalized.length === 0 && (Array.isArray(value) ? value.length === 0 : false)) {
    return { restricted_states: [], source: "system_settings" };
  }

  if (normalized.length === 0) {
    return {
      restricted_states: [...DEFAULT_ALCOHOL_RESTRICTED_US_STATES],
      source: "default",
    };
  }

  return { restricted_states: normalized, source: "system_settings" };
}
