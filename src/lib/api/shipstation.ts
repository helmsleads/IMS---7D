/**
 * ShipStation API v1 client — server-side only.
 * https://www.shipstation.com/docs/api/
 */

const SHIPSTATION_API_BASE = "https://ssapi.shipstation.com";

export interface ShipStationAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
  residential?: boolean;
}

export interface ShipStationLineItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineItemKey?: string;
}

export interface CreateShipStationLabelRequest {
  orderId: string;
  orderNumber: string;
  orderKey: string;
  shipDate: string;
  packageWeightLbs: number;
  carrierPreference: string;
  shipTo: ShipStationAddress;
  items: ShipStationLineItem[];
  customerEmail?: string | null;
}

export interface CreateShipStationLabelResult {
  trackingNumber: string;
  labelPdfBase64: string;
  shipmentId: number;
  shipStationOrderId: number;
  carrierCode: string;
  serviceCode: string;
  carrier: string;
  actualCost: number | null;
}

export interface ShipStationAccountCarrier {
  code: string;
  name: string;
  requiresFundedAccount?: boolean;
  balance?: number;
}

interface ShipStationService {
  carrierCode: string;
  code: string;
  name: string;
  domestic?: boolean;
}

interface ShipStationCreateOrderResponse {
  orderId: number;
  orderNumber: string;
  orderKey: string;
}

interface ShipStationCreateLabelResponse {
  shipmentId: number;
  trackingNumber: string;
  shipmentCost: number;
  labelData: string;
  carrierCode: string;
  serviceCode: string;
}

interface ShipStationWarehouse {
  warehouseId: number;
  warehouseName: string;
  isDefault?: boolean;
}

interface ShipStationCreateWarehouseResponse {
  warehouseId: number;
}

/** Preference → ShipStation carrier codes to try (first match on account wins). */
const CARRIER_CODE_CANDIDATES: Record<string, string[]> = {
  fedex: ["fedex_walleted", "fedex"],
  ups: ["ups_walleted", "ups"],
  usps: ["stamps_com", "usps_walleted"],
  dhl: ["dhl_express_walleted", "dhl_express_worldwide", "dhl_global_mail"],
  shipstation: ["fedex_walleted", "dhl_express_walleted", "stamps_com", "ups_walleted", "ups"],
};

/** Service code hints when resolving from listservices */
const SERVICE_HINTS: Record<string, string> = {
  fedex: "ground",
  ups: "ground",
  usps: "priority",
  dhl: "worldwide",
  shipstation: "ground",
};

export function isShipStationConfigured(): boolean {
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim();
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim();
  return !!(apiKey && apiSecret);
}

export function getShipStationAuthHeader(): string | null {
  const apiKey = process.env.SHIPSTATION_API_KEY?.trim();
  const apiSecret = process.env.SHIPSTATION_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;
  return `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}`;
}

function readEnv(name: string): string {
  const raw = process.env[name];
  if (!raw) return "";
  // Strip inline comments and trim (some .env files have trailing notes)
  return raw.split("#")[0].trim();
}

export function getShipFromAddress(): ShipStationAddress {
  const company =
    readEnv("SHIPSTATION_SHIPPER_COMPANY") ||
    readEnv("FEDEX_SHIPPER_COMPANY") ||
    "Seven Degrees LLC";
  const street1 =
    readEnv("SHIPSTATION_SHIPPER_STREET") || readEnv("FEDEX_SHIPPER_STREET");
  const city = readEnv("SHIPSTATION_SHIPPER_CITY") || readEnv("FEDEX_SHIPPER_CITY");
  const state =
    readEnv("SHIPSTATION_SHIPPER_STATE") || readEnv("FEDEX_SHIPPER_STATE");
  const postalCode =
    readEnv("SHIPSTATION_SHIPPER_ZIP") || readEnv("FEDEX_SHIPPER_ZIP");
  const country = normalizeCountry(
    readEnv("SHIPSTATION_SHIPPER_COUNTRY") ||
      readEnv("FEDEX_SHIPPER_COUNTRY") ||
      "US"
  );
  const phone =
    readEnv("SHIPSTATION_SHIPPER_PHONE") || readEnv("FEDEX_SHIPPER_PHONE");

  return {
    name: company,
    company,
    street1,
    city,
    state,
    postalCode,
    country,
    phone: phone || undefined,
    residential: false,
  };
}

function normalizeCountry(country: string): string {
  const c = country.trim().toUpperCase();
  if (c === "USA" || c === "UNITED STATES") return "US";
  return c.length === 2 ? c : country;
}

function toShipStationAddress(addr: ShipStationAddress) {
  return {
    name: addr.name,
    company: addr.company || null,
    street1: addr.street1,
    street2: addr.street2 || null,
    street3: null,
    city: addr.city,
    state: addr.state,
    postalCode: addr.postalCode,
    country: normalizeCountry(addr.country),
    phone: addr.phone || "0000000000",
    residential: addr.residential ?? false,
  };
}

function extractErrorMessage(data: unknown): string {
  if (!data) return "ShipStation API request failed";
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.ExceptionMessage === "string" && obj.ExceptionMessage.trim()) {
      parts.push(obj.ExceptionMessage.trim());
    }
    if (
      typeof obj.Message === "string" &&
      obj.Message.trim() &&
      obj.Message.trim() !== "An error has occurred."
    ) {
      parts.push(obj.Message.trim());
    }
    if (parts.length > 0) return parts.join(" — ");

    if (typeof obj.Message === "string" && obj.Message.trim()) {
      return obj.Message.trim();
    }
    if (typeof obj.message === "string") return obj.message;
    if (typeof obj.error === "string") return obj.error;
  }
  return "ShipStation API request failed";
}

class ShipStationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "ShipStationApiError";
  }
}

async function shipStationRequest<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const auth = getShipStationAuthHeader();
  if (!auth) {
    throw new Error("ShipStation is not configured");
  }

  const res = await fetch(`${SHIPSTATION_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message = extractErrorMessage(data);
    throw new ShipStationApiError(message, res.status, data);
  }

  return data as T;
}

export async function listAccountCarriers(): Promise<ShipStationAccountCarrier[]> {
  const data = await shipStationRequest<ShipStationAccountCarrier[]>("/carriers");
  return Array.isArray(data) ? data : [];
}

export async function listWarehouses(): Promise<ShipStationWarehouse[]> {
  const data = await shipStationRequest<ShipStationWarehouse[]>("/warehouses");
  return Array.isArray(data) ? data : [];
}

/** Resolve Ship From Location (warehouse) required for label purchase. */
async function getOrCreateWarehouseId(): Promise<number> {
  const envId = readEnv("SHIPSTATION_WAREHOUSE_ID");
  if (envId) {
    const parsed = Number(envId);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  const warehouses = await listWarehouses();
  if (warehouses.length > 0) {
    const defaultWarehouse = warehouses.find((w) => w.isDefault) || warehouses[0];
    return defaultWarehouse.warehouseId;
  }

  const shipFrom = getShipFromAddress();
  if (!shipFrom.street1 || !shipFrom.city || !shipFrom.postalCode || !shipFrom.state) {
    throw new Error(
      "ShipStation has no Ship From Location. Add one in ShipStation → Settings → Shipping → Ship From Locations, or set FEDEX_SHIPPER_* / SHIPSTATION_SHIPPER_* env vars."
    );
  }

  const created = await shipStationRequest<ShipStationCreateWarehouseResponse>(
    "/warehouses/createwarehouse",
    {
      method: "POST",
      body: JSON.stringify({
        warehouseName: shipFrom.company || shipFrom.name,
        originAddress: toShipStationAddress(shipFrom),
        returnAddress: null,
        isDefault: true,
      }),
    }
  );

  if (!created.warehouseId) {
    throw new Error("Failed to create ShipStation Ship From Location");
  }

  return created.warehouseId;
}

/** Carriers the UI can offer for ShipStation label purchase on this account. */
export async function listShipStationServiceCarrierOptions(): Promise<
  { value: string; label: string; carrierCode: string }[]
> {
  const accountCarriers = await listAccountCarriers();
  const options: { value: string; label: string; carrierCode: string }[] = [];

  const add = (value: string, label: string, codes: string[]) => {
    const match = accountCarriers.find((c) =>
      codes.some((code) => c.code.toLowerCase() === code.toLowerCase())
    );
    if (match) {
      options.push({ value, label, carrierCode: match.code });
    }
  };

  add("FedEx", "FedEx", CARRIER_CODE_CANDIDATES.fedex);
  add("DHL", "DHL", CARRIER_CODE_CANDIDATES.dhl);
  add("UPS", "UPS", CARRIER_CODE_CANDIDATES.ups);
  add("USPS", "USPS", CARRIER_CODE_CANDIDATES.usps);

  if (options.length === 0 && accountCarriers.length > 0) {
    for (const c of accountCarriers) {
      options.push({ value: c.code, label: c.name, carrierCode: c.code });
    }
  }

  return options;
}

async function listCarrierServices(carrierCode: string): Promise<ShipStationService[]> {
  try {
    const data = await shipStationRequest<ShipStationService[]>(
      `/carriers/listservices?carrierCode=${encodeURIComponent(carrierCode)}`
    );
    return Array.isArray(data) ? data : [];
  } catch (err) {
    if (err instanceof ShipStationApiError) {
      throw new Error(
        `ShipStation carrier "${carrierCode}" is not available on your account. ${err.message}`
      );
    }
    throw err;
  }
}

function resolveCarrierOnAccount(
  preference: string,
  accountCarriers: ShipStationAccountCarrier[]
): { carrierCode: string; displayName: string } {
  const key = preference.trim().toLowerCase();
  if (key === "freight" || key.includes("freight")) {
    throw new Error(
      "Freight/LTL labels are not supported via ShipStation API. Use Manual Entry instead."
    );
  }

  const carrierCodes = new Map(
    accountCarriers.map((c) => [c.code.toLowerCase(), c] as const)
  );

  const candidates =
    CARRIER_CODE_CANDIDATES[key] ||
    (carrierCodes.has(key) ? [key] : []);

  for (const code of candidates) {
    const found = carrierCodes.get(code.toLowerCase());
    if (found) {
      return {
        carrierCode: found.code,
        displayName: preferenceLabelForCarrier(key, found.name),
      };
    }
  }

  if (accountCarriers.length > 0) {
    const fallback = accountCarriers[0];
    return {
      carrierCode: fallback.code,
      displayName: fallback.name,
    };
  }

  throw new Error(
    "No shipping carriers are connected in ShipStation. Connect FedEx, DHL, or USPS in ShipStation Settings → Carriers."
  );
}

function preferenceLabelForCarrier(key: string, accountName: string): string {
  const labels: Record<string, string> = {
    fedex: "FedEx",
    ups: "UPS",
    usps: "USPS",
    dhl: "DHL",
    shipstation: "ShipStation",
  };
  return labels[key] || accountName;
}

async function resolveServiceCode(
  carrierCode: string,
  preferenceKey: string
): Promise<string> {
  const services = await listCarrierServices(carrierCode);
  if (services.length === 0) {
    throw new Error(
      `No ShipStation services found for carrier "${carrierCode}". Verify the carrier is connected in ShipStation.`
    );
  }

  const hint = (SERVICE_HINTS[preferenceKey.toLowerCase()] || "ground").toLowerCase();

  const ground = services.find(
    (s) =>
      s.code.toLowerCase().includes("ground") ||
      s.name.toLowerCase().includes("ground")
  );
  if (ground) return ground.code;

  const hinted = services.find(
    (s) =>
      s.code.toLowerCase().includes(hint) ||
      s.name.toLowerCase().includes(hint)
  );
  if (hinted) return hinted.code;

  return services[0].code;
}

async function createOrUpdateOrder(
  request: CreateShipStationLabelRequest,
  shipTo: ShipStationAddress,
  warehouseId: number
): Promise<number> {
  const shipFrom = getShipFromAddress();
  if (!shipFrom.street1 || !shipFrom.city || !shipFrom.postalCode || !shipFrom.state) {
    throw new Error(
      "Warehouse ship-from address is not configured. Set FEDEX_SHIPPER_* or SHIPSTATION_SHIPPER_* env vars."
    );
  }

  const orderDate = new Date().toISOString();
  const payload = {
    orderNumber: request.orderNumber,
    orderKey: request.orderKey,
    orderDate,
    orderStatus: "awaiting_shipment",
    customerEmail: request.customerEmail || "orders@7degreesco.com",
    billTo: toShipStationAddress(shipTo),
    shipTo: toShipStationAddress(shipTo),
    items: request.items.map((item, index) => ({
      lineItemKey: item.lineItemKey || `${request.orderKey}-${index}`,
      sku: item.sku || `ITEM-${index + 1}`,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice > 0 ? item.unitPrice : 1,
      weight: {
        value: Math.max(request.packageWeightLbs / request.items.length, 0.1),
        units: "pounds",
      },
    })),
    amountPaid: 1,
    taxAmount: 0,
    shippingAmount: 0,
    paymentMethod: "Other",
    advancedOptions: {
      warehouseId,
    },
  };

  const result = await shipStationRequest<ShipStationCreateOrderResponse>(
    "/orders/createorder",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );

  if (!result.orderId) {
    throw new Error("ShipStation did not return an order ID");
  }

  return result.orderId;
}

/**
 * Push order to ShipStation and create a shipping label.
 */
export async function createShipStationLabel(
  request: CreateShipStationLabelRequest
): Promise<CreateShipStationLabelResult> {
  const accountCarriers = await listAccountCarriers();
  const carrier = resolveCarrierOnAccount(request.carrierPreference, accountCarriers);
  const preferenceKey = request.carrierPreference.trim().toLowerCase();
  const serviceCode = await resolveServiceCode(carrier.carrierCode, preferenceKey);
  const warehouseId = await getOrCreateWarehouseId();

  const shipStationOrderId = await createOrUpdateOrder(
    request,
    request.shipTo,
    warehouseId
  );

  const labelPayload = {
    orderId: shipStationOrderId,
    carrierCode: carrier.carrierCode,
    serviceCode,
    packageCode: "package",
    confirmation: "none",
    shipDate: request.shipDate,
    weight: {
      value: request.packageWeightLbs,
      units: "pounds",
    },
    dimensions: null,
    insuranceOptions: null,
    internationalOptions: null,
    advancedOptions: null,
    testLabel: false,
  };

  const label = await shipStationRequest<ShipStationCreateLabelResponse>(
    "/orders/createlabelfororder",
    {
      method: "POST",
      body: JSON.stringify(labelPayload),
    }
  );

  if (!label.trackingNumber || !label.labelData) {
    throw new Error("ShipStation did not return a tracking number or label");
  }

  return {
    trackingNumber: label.trackingNumber,
    labelPdfBase64: label.labelData,
    shipmentId: label.shipmentId,
    shipStationOrderId,
    carrierCode: label.carrierCode || carrier.carrierCode,
    serviceCode: label.serviceCode || serviceCode,
    carrier: carrier.displayName,
    actualCost: label.shipmentCost ?? null,
  };
}
