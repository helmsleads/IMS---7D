/**
 * Best-effort geocode for "City, ST, Country" using OpenStreetMap Nominatim.
 * No API key required. Respect Nominatim usage: identify app + cache results.
 */

export type GeocodedPlace = {
  lat: number;
  lng: number;
  label: string;
};

const cache = new Map<string, GeocodedPlace | null>();

export function formatPlaceLabel(parts: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
}): string | null {
  const bits = [parts.city, parts.state, parts.zip, parts.country]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  if (bits.length === 0) return null;
  return bits.join(", ");
}

export async function geocodePlaceLabel(label: string): Promise<GeocodedPlace | null> {
  const key = label.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", label);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "SevenDegreesIMS/1.0 (portal shipment tracking)",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      cache.set(key, null);
      return null;
    }

    const data = (await res.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const hit = data[0];
    const lat = hit?.lat != null ? Number(hit.lat) : NaN;
    const lng = hit?.lon != null ? Number(hit.lon) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      cache.set(key, null);
      return null;
    }

    const place: GeocodedPlace = {
      lat,
      lng,
      label: hit.display_name || label,
    };
    cache.set(key, place);
    return place;
  } catch {
    cache.set(key, null);
    return null;
  }
}
