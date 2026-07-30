/**
 * Frontend API client for cross-login between 7D and DTC platforms.
 */

export async function generateDtcCrossLoginUrl(): Promise<string> {
  const res = await fetch("/api/cross-login/generate", { method: "POST" });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to generate cross-login URL");
  }

  const { redirect_url } = await res.json();
  return redirect_url;
}

export async function getDtcEnabledStatus(
  clientId: string,
): Promise<boolean> {
  const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/dtc`);

  if (!res.ok) {
    return false;
  }

  const { client } = await res.json();
  return client?.dtc_enabled ?? false;
}

export async function setClientDtcEnabled(
  clientId: string,
  dtcEnabled: boolean,
): Promise<{ id: string; company_name: string; dtc_enabled: boolean }> {
  const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/dtc`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dtc_enabled: dtcEnabled }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update DTC access");
  }

  const { client } = await res.json();
  return client;
}
