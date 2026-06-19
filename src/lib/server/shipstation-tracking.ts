import { getShipStationAuthHeader } from "@/lib/api/shipstation";

const DELIVERED_STATUS_CODES = new Set(["DE", "SP"]);

export interface ParsedShipStationTrackingEvent {
  trackingNumber: string;
  statusCode?: string;
  statusDescription?: string;
  deliveredAt?: string;
  resourceUrl?: string;
  resourceType?: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function extractFromObject(
  obj: Record<string, unknown> | null
): Omit<ParsedShipStationTrackingEvent, "resourceUrl" | "resourceType"> | null {
  if (!obj) return null;

  const trackingNumber =
    readString(obj.tracking_number) ||
    readString(obj.trackingNumber) ||
    readString(obj.TrackingNumber);

  if (!trackingNumber) return null;

  const statusCode =
    readString(obj.status_code) || readString(obj.statusCode) || readString(obj.StatusCode);

  const statusDescription =
    readString(obj.status_description) ||
    readString(obj.statusDescription) ||
    readString(obj.StatusDescription);

  const deliveredAt =
    readString(obj.actual_delivery_date) ||
    readString(obj.actualDeliveryDate) ||
    readString(obj.delivered_at) ||
    readString(obj.deliveredAt);

  return {
    trackingNumber,
    statusCode,
    statusDescription,
    deliveredAt,
  };
}

/**
 * Parses ShipStation / ShipEngine tracking webhook payloads (TRACK_EVENT_V2, API_TRACK, legacy).
 */
export function parseShipStationTrackingWebhook(
  body: unknown
): ParsedShipStationTrackingEvent | null {
  const root = asRecord(body);
  if (!root) return null;

  const resourceUrl = readString(root.resource_url);
  const resourceType = readString(root.resource_type);

  const fromData = extractFromObject(asRecord(root.data));
  const fromRoot = extractFromObject(root);

  const parsed = fromData || fromRoot;
  if (!parsed) {
    if (resourceUrl) {
      return {
        trackingNumber: "",
        resourceUrl,
        resourceType,
      };
    }
    return null;
  }

  return {
    ...parsed,
    resourceUrl,
    resourceType,
  };
}

export function isShipStationDeliveredStatus(statusCode?: string | null): boolean {
  if (!statusCode) return false;
  return DELIVERED_STATUS_CODES.has(statusCode.trim().toUpperCase());
}

/**
 * Legacy ShipStation webhooks only include resource_url — fetch tracking details with API credentials.
 */
export async function fetchShipStationTrackingFromResourceUrl(
  resourceUrl: string
): Promise<ParsedShipStationTrackingEvent | null> {
  const authHeader = getShipStationAuthHeader();
  if (!authHeader) return null;

  const response = await fetch(resourceUrl, {
    headers: {
      Authorization: authHeader,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `ShipStation resource fetch failed (${response.status}) for ${resourceUrl}`
    );
  }

  const payload = (await response.json()) as unknown;
  const root = asRecord(payload);
  if (!root) return null;

  const direct = extractFromObject(root);
  if (direct) return direct;

  const shipments = Array.isArray(root.shipments) ? root.shipments : null;
  if (shipments && shipments.length > 0) {
    const shipment = asRecord(shipments[0]);
    const fromShipment = extractFromObject(shipment);
    if (fromShipment) return fromShipment;
  }

  return null;
}
