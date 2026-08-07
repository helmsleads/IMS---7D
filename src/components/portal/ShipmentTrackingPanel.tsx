"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, RefreshCw, Truck } from "lucide-react";

type TrackEvent = {
  statusCode: string;
  statusDescription: string;
  timestamp?: string;
  city?: string;
  state?: string;
  country?: string;
};

type TrackingPayload = {
  trackingNumber: string | null;
  carrier?: string | null;
  statusDescription: string;
  estimatedDelivery?: string;
  actualDelivery?: string;
  events: TrackEvent[];
  map: {
    query: string;
    lat: number | null;
    lng: number | null;
    label: string;
    kind: "current" | "destination";
  } | null;
  source: string;
  googleMapsKey?: string | null;
  error?: string;
};

function formatWhen(value?: string) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function mapEmbedUrl(payload: TrackingPayload): string | null {
  const map = payload.map;
  if (!map) return null;

  if (payload.googleMapsKey) {
    const params = new URLSearchParams({
      key: payload.googleMapsKey,
      q: map.query,
      zoom: "10",
    });
    return `https://www.google.com/maps/embed/v1/place?${params.toString()}`;
  }

  if (map.lat != null && map.lng != null) {
    const delta = 0.08;
    const left = map.lng - delta;
    const right = map.lng + delta;
    const top = map.lat + delta;
    const bottom = map.lat - delta;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${map.lat}%2C${map.lng}`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(map.query)}&z=10&output=embed`;
}

export function ShipmentTrackingPanel({ orderId }: { orderId: string }) {
  const [data, setData] = useState<TrackingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/orders/${orderId}/tracking`, {
        credentials: "include",
      });
      const json = (await res.json()) as TrackingPayload & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Could not load tracking");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load tracking");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const embedUrl = data ? mapEmbedUrl(data) : null;

  return (
    <div className="mt-5 border-t border-cyan-200 pt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-cyan-700" />
          <h4 className="font-semibold text-cyan-900">Where is my package?</h4>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300 bg-white px-3 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh status
        </button>
      </div>

      {loading && !data ? (
        <p className="mt-3 text-sm text-cyan-700">Loading tracking…</p>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}. You can still use Track Package on the carrier site.
        </p>
      ) : null}

      {data ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-200 bg-white px-4 py-3">
              <div className="flex items-start gap-2">
                <Truck className="mt-0.5 h-4 w-4 text-cyan-600" />
                <div>
                  <p className="text-sm font-semibold text-cyan-950">{data.statusDescription}</p>
                  {data.map ? (
                    <p className="mt-1 text-xs text-cyan-700">
                      {data.map.kind === "current" ? "Latest scan near" : "Ship-to"}:{" "}
                      <span className="font-medium text-cyan-900">{data.map.query}</span>
                    </p>
                  ) : null}
                  {data.estimatedDelivery ? (
                    <p className="mt-1 text-xs text-cyan-700">
                      ETA: {formatWhen(data.estimatedDelivery)}
                    </p>
                  ) : null}
                  {data.actualDelivery ? (
                    <p className="mt-1 text-xs text-cyan-700">
                      Delivered: {formatWhen(data.actualDelivery)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {data.events?.length ? (
              <ol className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-cyan-200 bg-white p-3">
                {data.events.map((event, index) => {
                  const place = [event.city, event.state, event.country].filter(Boolean).join(", ");
                  return (
                    <li
                      key={`${event.timestamp || "e"}-${index}`}
                      className="border-b border-slate-100 pb-2 last:border-0 last:pb-0"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {event.statusDescription || event.statusCode || "Update"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {[formatWhen(event.timestamp), place].filter(Boolean).join(" · ")}
                      </p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-xs text-cyan-700">
                Status updates will appear here once the carrier scans the package.
              </p>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border border-cyan-200 bg-white">
            {embedUrl ? (
              <iframe
                title="Shipment location map"
                src={embedUrl}
                className="h-64 w-full border-0 lg:h-full min-h-[16rem]"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-slate-500">
                Map will show once we have a city or delivery address.
              </div>
            )}
            {data.map ? (
              <p className="border-t border-cyan-100 bg-cyan-50 px-3 py-2 text-xs text-cyan-800">
                {data.map.kind === "current"
                  ? "Map shows the latest known scan location."
                  : "Map shows the delivery address until carrier scans start."}
                {!data.googleMapsKey ? " (OpenStreetMap)" : " (Google Maps)"}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
