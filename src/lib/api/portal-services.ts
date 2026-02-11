import { createClient } from "@/lib/supabase";

export interface PortalService {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  full_description: string | null;
  icon: string | null;
  features: string[];
  base_price: number | null;
  price_unit: string | null;
  sort_order: number;
  addons: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    price: number | null;
    price_unit: string | null;
  }[];
}

export interface PortalServiceTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  min_volume: number | null;
  max_volume: number | null;
  features: string[];
  is_popular: boolean;
  sort_order: number;
  pricing: {
    service_id: string;
    service_name: string;
    price: number | null;
    price_unit: string | null;
    is_custom: boolean;
  }[];
}

export interface MyService {
  id: string;
  service_id: string;
  service_name: string;
  service_description: string | null;
  tier_id: string | null;
  tier_name: string | null;
  custom_price: number | null;
  custom_price_unit: string | null;
  effective_price: number | null;
  effective_price_unit: string | null;
  is_active: boolean;
  started_at: string | null;
  addons: {
    id: string;
    addon_id: string;
    addon_name: string;
    custom_price: number | null;
    effective_price: number | null;
    is_active: boolean;
  }[];
}

export interface MyPlan {
  tier: {
    id: string;
    name: string;
    description: string | null;
    features: string[];
  } | null;
  services: MyService[];
  totalMonthlyEstimate: number;
}

export async function getPortalServices(): Promise<PortalService[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("services")
    .select(`
      id,
      name,
      slug,
      description,
      full_description,
      icon,
      features,
      base_price,
      price_unit,
      sort_order,
      addons:service_addons (
        id,
        name,
        slug,
        description,
        price,
        price_unit
      )
    `)
    .eq("status", "active")
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  // Filter active addons
  return (data || []).map((service) => ({
    ...service,
    addons: (service.addons || []).filter((addon: any) => addon.status !== "archived"),
  }));
}

export async function getPortalServiceTiers(): Promise<PortalServiceTier[]> {
  const supabase = createClient();

  const { data: tiers, error: tiersError } = await supabase
    .from("service_tiers")
    .select(`
      id,
      name,
      slug,
      description,
      min_volume,
      max_volume,
      features,
      is_popular,
      sort_order
    `)
    .eq("status", "active")
    .order("sort_order");

  if (tiersError) {
    throw new Error(tiersError.message);
  }

  // Get pricing for each tier
  const { data: pricing, error: pricingError } = await supabase
    .from("service_tier_pricing")
    .select(`
      tier_id,
      service_id,
      price,
      price_unit,
      is_custom,
      service:services (id, name)
    `);

  if (pricingError) {
    throw new Error(pricingError.message);
  }

  // Map pricing to tiers
  return (tiers || []).map((tier) => ({
    ...tier,
    pricing: (pricing || [])
      .filter((p) => p.tier_id === tier.id)
      .map((p) => {
        const service = Array.isArray(p.service) ? p.service[0] : p.service;
        return {
          service_id: p.service_id,
          service_name: service?.name || "Unknown",
          price: p.price,
          price_unit: p.price_unit,
          is_custom: p.is_custom,
        };
      }),
  }));
}

export async function getMyServices(clientId: string): Promise<MyService[]> {
  const supabase = createClient();

  // Get client's services
  const { data: clientServices, error: servicesError } = await supabase
    .from("client_services")
    .select(`
      id,
      service_id,
      tier_id,
      custom_price,
      custom_price_unit,
      is_active,
      started_at,
      service:services (id, name, description, base_price, price_unit),
      tier:service_tiers (id, name)
    `)
    .eq("client_id", clientId);

  if (servicesError) {
    throw new Error(servicesError.message);
  }

  // Get client's addons
  const { data: clientAddons, error: addonsError } = await supabase
    .from("client_addons")
    .select(`
      id,
      addon_id,
      custom_price,
      is_active,
      addon:service_addons (id, name, price, service_id)
    `)
    .eq("client_id", clientId);

  if (addonsError) {
    throw new Error(addonsError.message);
  }

  // Get tier pricing for services
  const { data: tierPricing } = await supabase
    .from("service_tier_pricing")
    .select("service_id, tier_id, price, price_unit");

  const tierPricingMap = new Map(
    (tierPricing || []).map((p) => [`${p.service_id}-${p.tier_id}`, p])
  );

  return (clientServices || []).map((cs) => {
    const service = Array.isArray(cs.service) ? cs.service[0] : cs.service;
    const tier = Array.isArray(cs.tier) ? cs.tier[0] : cs.tier;

    // Determine effective price
    let effectivePrice = cs.custom_price;
    let effectivePriceUnit = cs.custom_price_unit;

    if (effectivePrice === null && cs.tier_id) {
      const tierPrice = tierPricingMap.get(`${cs.service_id}-${cs.tier_id}`);
      if (tierPrice) {
        effectivePrice = tierPrice.price;
        effectivePriceUnit = tierPrice.price_unit;
      }
    }

    if (effectivePrice === null) {
      effectivePrice = service?.base_price ?? null;
      effectivePriceUnit = service?.price_unit ?? null;
    }

    // Get addons for this service
    const serviceAddons = (clientAddons || [])
      .filter((ca) => {
        const addon = Array.isArray(ca.addon) ? ca.addon[0] : ca.addon;
        return addon?.service_id === cs.service_id;
      })
      .map((ca) => {
        const addon = Array.isArray(ca.addon) ? ca.addon[0] : ca.addon;
        return {
          id: ca.id,
          addon_id: ca.addon_id,
          addon_name: addon?.name || "Unknown",
          custom_price: ca.custom_price,
          effective_price: ca.custom_price ?? addon?.price ?? null,
          is_active: ca.is_active,
        };
      });

    return {
      id: cs.id,
      service_id: cs.service_id,
      service_name: service?.name || "Unknown",
      service_description: service?.description || null,
      tier_id: cs.tier_id,
      tier_name: tier?.name || null,
      custom_price: cs.custom_price,
      custom_price_unit: cs.custom_price_unit,
      effective_price: effectivePrice,
      effective_price_unit: effectivePriceUnit,
      is_active: cs.is_active,
      started_at: cs.started_at,
      addons: serviceAddons,
    };
  });
}

export async function getMyPlan(clientId: string): Promise<MyPlan> {
  const supabase = createClient();

  // Get client's tier
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("service_tier_id")
    .eq("id", clientId)
    .single();

  if (clientError) {
    throw new Error(clientError.message);
  }

  let tier: MyPlan["tier"] = null;

  if (client.service_tier_id) {
    const { data: tierData } = await supabase
      .from("service_tiers")
      .select("id, name, description, features")
      .eq("id", client.service_tier_id)
      .single();

    if (tierData) {
      tier = tierData;
    }
  }

  // Get services
  const services = await getMyServices(clientId);

  // Calculate total monthly estimate
  const totalMonthlyEstimate = services
    .filter((s) => s.is_active)
    .reduce((total, service) => {
      let serviceTotal = service.effective_price || 0;

      // Add active addons
      service.addons
        .filter((a) => a.is_active)
        .forEach((addon) => {
          serviceTotal += addon.effective_price || 0;
        });

      return total + serviceTotal;
    }, 0);

  return {
    tier,
    services,
    totalMonthlyEstimate,
  };
}
