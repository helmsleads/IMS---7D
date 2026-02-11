import { createClient } from "@/lib/supabase";
import {
  WorkflowProfile,
  ProfileSupply,
  ClientIndustry,
  ContainerType,
  PortalFeatures,
  WorkflowCustomField,
  WorkflowAutomation,
  WorkflowNotification,
  WorkflowDocument,
  PickStrategy,
  BillingModel
} from "@/types/database";

export interface WorkflowProfileWithSupplies extends WorkflowProfile {
  profile_supplies: Array<ProfileSupply & {
    supply: {
      id: string;
      sku: string;
      name: string;
      category: string;
    };
  }>;
}

export interface WorkflowProfileWithRelations extends WorkflowProfileWithSupplies {
  custom_fields?: WorkflowCustomField[];
  automations?: WorkflowAutomation[];
  notifications?: WorkflowNotification[];
  documents?: WorkflowDocument[];
}

/**
 * Default portal features - all disabled by default
 */
export const DEFAULT_PORTAL_FEATURES: PortalFeatures = {
  can_view_inventory: true,
  can_request_shipments: true,
  can_view_lot_details: false,
  can_request_returns: false,
  can_view_invoices: false,
  can_manage_addresses: true,
  can_use_order_templates: false,
  can_view_profitability: false,
  can_send_messages: true,
  can_view_tracking: true,
};

/**
 * Default workflow profile values - used when creating new profiles
 * All features default to disabled/off so admin must explicitly enable
 */
export const DEFAULT_WORKFLOW_PROFILE: Omit<WorkflowProfile, 'id' | 'code' | 'name' | 'industry' | 'created_at' | 'updated_at'> = {
  description: null,
  icon: null,
  color: null,
  sort_order: 0,

  // Compliance - all off by default
  requires_lot_tracking: false,
  requires_expiration_dates: false,
  requires_age_verification: false,
  requires_ttb_compliance: false,
  has_state_restrictions: false,
  restricted_states: [],
  track_serial_numbers: false,
  quality_inspection_required: false,
  quarantine_days: 0,

  // Inbound - disabled by default
  inbound_enabled: false,
  inbound_requires_po: false,
  inbound_requires_appointment: false,
  inbound_auto_create_lots: false,
  inbound_lot_format: null,
  inbound_require_inspection: false,

  // Outbound - disabled by default
  outbound_enabled: false,
  outbound_requires_approval: false,
  outbound_auto_allocate: false,
  outbound_pick_strategy: 'FIFO' as PickStrategy,
  outbound_allow_partial_shipment: false,
  outbound_allow_backorder: false,
  outbound_packing_slip_template: null,
  default_requires_repack: false,

  // Inventory - disabled by default
  inventory_enabled: false,
  inventory_allow_negative: false,
  inventory_cycle_count_frequency: null,
  inventory_reorder_alerts: false,

  // Shipping - disabled by default
  shipping_enabled: false,
  shipping_allowed_carriers: [],
  shipping_default_service: null,
  shipping_requires_signature: false,
  shipping_insurance_threshold: null,
  shipping_hazmat_enabled: false,

  // Returns - disabled by default
  returns_enabled: false,
  returns_allowed: false,
  returns_window_days: 30,
  returns_requires_rma: false,
  returns_auto_restock: false,

  // Billing - disabled by default
  billing_enabled: false,
  billing_model: 'per_order' as BillingModel,
  billing_storage_rate: null,
  billing_pick_rate: null,
  billing_pack_rate: null,
  billing_minimum_monthly: null,

  // Integration - disabled by default
  integration_auto_import_orders: false,
  integration_auto_sync_inventory: false,
  integration_auto_fulfill: false,
  integration_hold_for_review: false,

  // Container types - default to common types
  allowed_container_types: ['bottle', 'can', 'keg', 'bag_in_box', 'gift_box', 'other'] as ContainerType[],

  // Portal features
  portal_features: DEFAULT_PORTAL_FEATURES,

  is_active: true,
};

/**
 * Get all workflow profiles
 */
export async function getWorkflowProfiles(): Promise<WorkflowProfile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_profiles")
    .select("*")
    .eq("is_active", true)
    .order("industry")
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get workflow profiles filtered by industry
 */
export async function getWorkflowProfilesByIndustry(
  industry: ClientIndustry
): Promise<WorkflowProfile[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_profiles")
    .select("*")
    .eq("industry", industry)
    .eq("is_active", true)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get a single workflow profile with its associated supplies
 */
export async function getWorkflowProfile(id: string): Promise<WorkflowProfileWithSupplies | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_profiles")
    .select(`
      *,
      profile_supplies (
        *,
        supply:supplies (id, sku, name, category)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get workflow profile by code
 */
export async function getWorkflowProfileByCode(
  code: string
): Promise<WorkflowProfile | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_profiles")
    .select("*")
    .eq("code", code)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get allowed container types for a client based on their workflow profile
 */
export async function getClientAllowedContainerTypes(
  clientId: string
): Promise<ContainerType[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select(`
      workflow_profile:workflow_profiles (
        allowed_container_types
      )
    `)
    .eq("id", clientId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const profile = Array.isArray(data?.workflow_profile)
    ? data.workflow_profile[0]
    : data?.workflow_profile;

  return profile?.allowed_container_types || ['bottle', 'can', 'keg', 'bag_in_box', 'other'];
}

/**
 * Get supplies available for a client based on their workflow profile
 */
export async function getClientAvailableSupplies(clientId: string): Promise<Array<{
  id: string;
  sku: string;
  name: string;
  category: string;
  is_default: boolean;
}>> {
  const supabase = createClient();

  // Get client's workflow profile
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("workflow_profile_id")
    .eq("id", clientId)
    .single();

  if (clientError) {
    throw new Error(clientError.message);
  }

  if (!client.workflow_profile_id) {
    // No profile assigned, return all supplies
    const { data: allSupplies, error: suppliesError } = await supabase
      .from("supplies")
      .select("id, sku, name, category")
      .eq("active", true)
      .order("category")
      .order("name");

    if (suppliesError) {
      throw new Error(suppliesError.message);
    }

    return (allSupplies || []).map(s => ({ ...s, is_default: false }));
  }

  // Get supplies linked to the profile
  const { data: profileSupplies, error: profileError } = await supabase
    .from("profile_supplies")
    .select(`
      is_default,
      supply:supplies (id, sku, name, category)
    `)
    .eq("profile_id", client.workflow_profile_id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (!profileSupplies || profileSupplies.length === 0) {
    // No supplies linked to profile, return all supplies
    const { data: allSupplies, error: suppliesError } = await supabase
      .from("supplies")
      .select("id, sku, name, category")
      .eq("active", true)
      .order("category")
      .order("name");

    if (suppliesError) {
      throw new Error(suppliesError.message);
    }

    return (allSupplies || []).map(s => ({ ...s, is_default: false }));
  }

  return profileSupplies.map(ps => {
    const supply = Array.isArray(ps.supply) ? ps.supply[0] : ps.supply;
    return {
      id: supply?.id || "",
      sku: supply?.sku || "",
      name: supply?.name || "",
      category: supply?.category || "",
      is_default: ps.is_default,
    };
  }).filter(s => s.id);
}

/**
 * Link supplies to a workflow profile
 */
export async function linkSupplyToProfile(
  profileId: string,
  supplyId: string,
  isDefault: boolean = false
): Promise<ProfileSupply> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("profile_supplies")
    .upsert({
      profile_id: profileId,
      supply_id: supplyId,
      is_default: isDefault,
    }, {
      onConflict: "profile_id,supply_id",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Unlink a supply from a workflow profile
 */
export async function unlinkSupplyFromProfile(
  profileId: string,
  supplyId: string
): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("profile_supplies")
    .delete()
    .eq("profile_id", profileId)
    .eq("supply_id", supplyId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Update workflow profile settings
 */
export async function updateWorkflowProfile(
  id: string,
  updates: Partial<Omit<WorkflowProfile, "id" | "created_at">>
): Promise<WorkflowProfile> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_profiles")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Create a new workflow profile
 */
export async function createWorkflowProfile(
  profile: Omit<WorkflowProfile, "id" | "created_at" | "updated_at">
): Promise<WorkflowProfile> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_profiles")
    .insert(profile)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Get industry display name
 */
export function getIndustryDisplayName(industry: ClientIndustry): string {
  const names: Record<ClientIndustry, string> = {
    spirits: "Spirits",
    wine: "Wine",
    beer: "Beer",
    rtd: "RTD (Ready-to-Drink)",
    beverage_non_alc: "Non-Alcoholic Beverages",
    food: "Food Products",
    cosmetics: "Cosmetics & Beauty",
    apparel: "Apparel & Merch",
    supplements: "Supplements & Health",
    general_merchandise: "General Merchandise",
  };
  return names[industry] || industry;
}

/**
 * Get all industries with their display names
 * Grouped by category for better organization
 */
export function getAllIndustries(): Array<{ value: ClientIndustry; label: string; category: string }> {
  return [
    // Alcoholic beverages
    { value: "spirits", label: "Spirits", category: "Alcoholic Beverages" },
    { value: "wine", label: "Wine", category: "Alcoholic Beverages" },
    { value: "beer", label: "Beer", category: "Alcoholic Beverages" },
    { value: "rtd", label: "RTD (Ready-to-Drink)", category: "Alcoholic Beverages" },
    // Non-alcoholic
    { value: "beverage_non_alc", label: "Non-Alcoholic Beverages", category: "Beverages" },
    // Consumer goods
    { value: "food", label: "Food Products", category: "Consumer Goods" },
    { value: "cosmetics", label: "Cosmetics & Beauty", category: "Consumer Goods" },
    { value: "supplements", label: "Supplements & Health", category: "Consumer Goods" },
    { value: "apparel", label: "Apparel & Merch", category: "Consumer Goods" },
    { value: "general_merchandise", label: "General Merchandise", category: "Other" },
  ];
}

/**
 * Get industries that require alcohol compliance (TTB, age verification, etc.)
 */
export function getAlcoholIndustries(): ClientIndustry[] {
  return ["spirits", "wine", "beer", "rtd"];
}

/**
 * Check if any of the industries require alcohol compliance
 */
export function requiresAlcoholCompliance(industries: ClientIndustry[]): boolean {
  const alcoholIndustries = getAlcoholIndustries();
  return industries.some(ind => alcoholIndustries.includes(ind));
}

// ============================================
// CLIENT WORKFLOW ENFORCEMENT FUNCTIONS
// ============================================

/**
 * Get the full workflow profile for a client - used for enforcement
 */
export async function getClientWorkflowProfile(
  clientId: string
): Promise<WorkflowProfile | null> {
  if (!clientId || clientId === "staff-preview") {
    return null;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select(`
      workflow_profile:workflow_profiles (*)
    `)
    .eq("id", clientId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    throw new Error(error.message);
  }

  const profile = Array.isArray(data?.workflow_profile)
    ? data.workflow_profile[0]
    : data?.workflow_profile;

  return profile || null;
}

/**
 * Get the workflow profile for a specific product (if product-level override is enabled)
 * Returns null if:
 * - Product doesn't exist
 * - Client doesn't allow product workflow override
 * - Product has no workflow_profile_id set
 */
export async function getProductWorkflowProfile(
  productId: string
): Promise<WorkflowProfile | null> {
  if (!productId) {
    return null;
  }

  const supabase = createClient();

  // First check if product has a workflow_profile_id and if client allows override
  const { data: product, error: productError } = await supabase
    .from("products")
    .select(`
      workflow_profile_id,
      client:clients (
        allow_product_workflow_override
      )
    `)
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return null;
  }

  const client = Array.isArray(product.client) ? product.client[0] : product.client;

  // If client doesn't allow override or product has no override set, return null
  if (!client?.allow_product_workflow_override || !product.workflow_profile_id) {
    return null;
  }

  // Fetch the workflow profile
  const { data: profile, error: profileError } = await supabase
    .from("workflow_profiles")
    .select("*")
    .eq("id", product.workflow_profile_id)
    .single();

  if (profileError) {
    return null;
  }

  return profile;
}

/**
 * Get the effective workflow profile for a product or client
 * Priority: Product workflow override > Client workflow > null
 *
 * @param clientId - The client ID (required)
 * @param productId - The product ID (optional - if provided, checks for product override first)
 */
export async function getEffectiveWorkflowProfile(
  clientId: string,
  productId?: string
): Promise<WorkflowProfile | null> {
  // First check product-level override if productId provided
  if (productId) {
    const productProfile = await getProductWorkflowProfile(productId);
    if (productProfile) {
      return productProfile;
    }
  }

  // Fall back to client workflow
  return getClientWorkflowProfile(clientId);
}

/**
 * Check if a specific workflow rule is enabled for a client
 * Returns false if the feature is disabled or client has no workflow
 */
export async function isWorkflowRuleEnabled(
  clientId: string,
  rule: keyof WorkflowProfile
): Promise<boolean> {
  const profile = await getClientWorkflowProfile(clientId);
  if (!profile) return false;

  const value = profile[rule];
  return typeof value === "boolean" ? value : false;
}

/**
 * Get inbound rules for a client (or specific product if productId provided)
 * If productId is provided and the client allows product workflow overrides,
 * the product's workflow profile will be used if set.
 */
export async function getClientInboundRules(clientId: string, productId?: string): Promise<{
  enabled: boolean;
  requiresPo: boolean;
  requiresAppointment: boolean;
  autoCreateLots: boolean;
  lotFormat: string | null;
  requiresInspection: boolean;
  requiresLotTracking: boolean;
  requiresExpirationDates: boolean;
}> {
  const profile = await getEffectiveWorkflowProfile(clientId, productId);

  // If no profile or inbound disabled, return all rules as false/disabled
  if (!profile || !profile.inbound_enabled) {
    return {
      enabled: false,
      requiresPo: false,
      requiresAppointment: false,
      autoCreateLots: false,
      lotFormat: null,
      requiresInspection: false,
      requiresLotTracking: false,
      requiresExpirationDates: false,
    };
  }

  return {
    enabled: true,
    requiresPo: profile.inbound_requires_po,
    requiresAppointment: profile.inbound_requires_appointment,
    autoCreateLots: profile.inbound_auto_create_lots,
    lotFormat: profile.inbound_lot_format,
    requiresInspection: profile.inbound_require_inspection || profile.quality_inspection_required,
    requiresLotTracking: profile.requires_lot_tracking,
    requiresExpirationDates: profile.requires_expiration_dates,
  };
}

/**
 * Get outbound rules for a client (or specific product if productId provided)
 * If productId is provided and the client allows product workflow overrides,
 * the product's workflow profile will be used if set.
 */
export async function getClientOutboundRules(clientId: string, productId?: string): Promise<{
  enabled: boolean;
  requiresApproval: boolean;
  autoAllocate: boolean;
  pickStrategy: PickStrategy;
  allowPartialShipment: boolean;
  allowBackorder: boolean;
  packingSlipTemplate: string | null;
  requiresRepack: boolean;
  requiresAgeVerification: boolean;
  hasStateRestrictions: boolean;
  restrictedStates: string[];
}> {
  const profile = await getEffectiveWorkflowProfile(clientId, productId);

  if (!profile || !profile.outbound_enabled) {
    return {
      enabled: false,
      requiresApproval: false,
      autoAllocate: false,
      pickStrategy: 'FIFO',
      allowPartialShipment: true,
      allowBackorder: false,
      packingSlipTemplate: null,
      requiresRepack: false,
      requiresAgeVerification: false,
      hasStateRestrictions: false,
      restrictedStates: [],
    };
  }

  return {
    enabled: true,
    requiresApproval: profile.outbound_requires_approval,
    autoAllocate: profile.outbound_auto_allocate,
    pickStrategy: profile.outbound_pick_strategy,
    allowPartialShipment: profile.outbound_allow_partial_shipment,
    allowBackorder: profile.outbound_allow_backorder,
    packingSlipTemplate: profile.outbound_packing_slip_template,
    requiresRepack: profile.default_requires_repack,
    requiresAgeVerification: profile.requires_age_verification,
    hasStateRestrictions: profile.has_state_restrictions,
    restrictedStates: profile.restricted_states || [],
  };
}

/**
 * Get inventory rules for a client (or specific product if productId provided)
 */
export async function getClientInventoryRules(clientId: string, productId?: string): Promise<{
  enabled: boolean;
  allowNegative: boolean;
  cycleCountFrequency: number | null;
  reorderAlerts: boolean;
  trackSerialNumbers: boolean;
}> {
  const profile = await getEffectiveWorkflowProfile(clientId, productId);

  if (!profile || !profile.inventory_enabled) {
    return {
      enabled: false,
      allowNegative: false,
      cycleCountFrequency: null,
      reorderAlerts: false,
      trackSerialNumbers: false,
    };
  }

  return {
    enabled: true,
    allowNegative: profile.inventory_allow_negative,
    cycleCountFrequency: profile.inventory_cycle_count_frequency,
    reorderAlerts: profile.inventory_reorder_alerts,
    trackSerialNumbers: profile.track_serial_numbers,
  };
}

/**
 * Get shipping rules for a client (or specific product if productId provided)
 */
export async function getClientShippingRules(clientId: string, productId?: string): Promise<{
  enabled: boolean;
  allowedCarriers: string[];
  defaultService: string | null;
  requiresSignature: boolean;
  insuranceThreshold: number | null;
  hazmatEnabled: boolean;
}> {
  const profile = await getEffectiveWorkflowProfile(clientId, productId);

  if (!profile || !profile.shipping_enabled) {
    return {
      enabled: false,
      allowedCarriers: [],
      defaultService: null,
      requiresSignature: false,
      insuranceThreshold: null,
      hazmatEnabled: false,
    };
  }

  return {
    enabled: true,
    allowedCarriers: profile.shipping_allowed_carriers || [],
    defaultService: profile.shipping_default_service,
    requiresSignature: profile.shipping_requires_signature,
    insuranceThreshold: profile.shipping_insurance_threshold,
    hazmatEnabled: profile.shipping_hazmat_enabled,
  };
}

/**
 * Get returns rules for a client (or specific product if productId provided)
 */
export async function getClientReturnsRules(clientId: string, productId?: string): Promise<{
  enabled: boolean;
  allowed: boolean;
  windowDays: number;
  requiresRma: boolean;
  autoRestock: boolean;
}> {
  const profile = await getEffectiveWorkflowProfile(clientId, productId);

  if (!profile || !profile.returns_enabled) {
    return {
      enabled: false,
      allowed: false,
      windowDays: 30,
      requiresRma: false,
      autoRestock: false,
    };
  }

  return {
    enabled: true,
    allowed: profile.returns_allowed,
    windowDays: profile.returns_window_days,
    requiresRma: profile.returns_requires_rma,
    autoRestock: profile.returns_auto_restock,
  };
}

/**
 * Get portal features for a client
 */
export async function getClientPortalFeatures(clientId: string): Promise<PortalFeatures> {
  const profile = await getClientWorkflowProfile(clientId);

  if (!profile) {
    return DEFAULT_PORTAL_FEATURES;
  }

  // Merge with defaults in case some fields are missing
  return {
    ...DEFAULT_PORTAL_FEATURES,
    ...(profile.portal_features as Partial<PortalFeatures>),
  };
}

/**
 * Validate if a state is allowed for shipping based on workflow restrictions
 */
export async function isStateAllowedForShipping(
  clientId: string,
  stateCode: string
): Promise<boolean> {
  const profile = await getClientWorkflowProfile(clientId);

  if (!profile || !profile.has_state_restrictions) {
    return true; // No restrictions
  }

  const restrictedStates = profile.restricted_states || [];
  return !restrictedStates.includes(stateCode.toUpperCase());
}

// ============================================
// CUSTOM FIELDS CRUD
// ============================================

export async function getWorkflowCustomFields(
  workflowProfileId: string
): Promise<WorkflowCustomField[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_custom_fields")
    .select("*")
    .eq("workflow_profile_id", workflowProfileId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createWorkflowCustomField(
  field: Omit<WorkflowCustomField, "id" | "created_at">
): Promise<WorkflowCustomField> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_custom_fields")
    .insert(field)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateWorkflowCustomField(
  id: string,
  updates: Partial<Omit<WorkflowCustomField, "id" | "created_at" | "workflow_profile_id">>
): Promise<WorkflowCustomField> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_custom_fields")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteWorkflowCustomField(id: string): Promise<void> {
  const supabase = createClient();

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from("workflow_custom_fields")
    .update({ is_active: false })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// AUTOMATIONS CRUD
// ============================================

export async function getWorkflowAutomations(
  workflowProfileId: string
): Promise<WorkflowAutomation[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_automations")
    .select("*")
    .eq("workflow_profile_id", workflowProfileId)
    .order("name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createWorkflowAutomation(
  automation: Omit<WorkflowAutomation, "id" | "created_at">
): Promise<WorkflowAutomation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_automations")
    .insert(automation)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateWorkflowAutomation(
  id: string,
  updates: Partial<Omit<WorkflowAutomation, "id" | "created_at" | "workflow_profile_id">>
): Promise<WorkflowAutomation> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_automations")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteWorkflowAutomation(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("workflow_automations")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// NOTIFICATIONS CRUD
// ============================================

export async function getWorkflowNotifications(
  workflowProfileId: string
): Promise<WorkflowNotification[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_notifications")
    .select("*")
    .eq("workflow_profile_id", workflowProfileId)
    .order("event_type");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function upsertWorkflowNotification(
  notification: Omit<WorkflowNotification, "id" | "created_at">
): Promise<WorkflowNotification> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_notifications")
    .upsert(notification, {
      onConflict: "workflow_profile_id,event_type",
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

// ============================================
// DOCUMENTS CRUD
// ============================================

export async function getWorkflowDocuments(
  workflowProfileId: string
): Promise<WorkflowDocument[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_documents")
    .select("*")
    .eq("workflow_profile_id", workflowProfileId)
    .order("document_type")
    .order("template_name");

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

export async function createWorkflowDocument(
  doc: Omit<WorkflowDocument, "id" | "created_at">
): Promise<WorkflowDocument> {
  const supabase = createClient();

  // If setting as default, unset other defaults of same type
  if (doc.is_default) {
    await supabase
      .from("workflow_documents")
      .update({ is_default: false })
      .eq("workflow_profile_id", doc.workflow_profile_id)
      .eq("document_type", doc.document_type);
  }

  const { data, error } = await supabase
    .from("workflow_documents")
    .insert(doc)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateWorkflowDocument(
  id: string,
  updates: Partial<Omit<WorkflowDocument, "id" | "created_at" | "workflow_profile_id">>
): Promise<WorkflowDocument> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("workflow_documents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function deleteWorkflowDocument(id: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase
    .from("workflow_documents")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ============================================
// WORKFLOW DUPLICATION
// ============================================

/**
 * Duplicate a workflow profile with all its related data
 */
export async function duplicateWorkflowProfile(
  sourceId: string,
  newCode: string,
  newName: string
): Promise<WorkflowProfile> {
  const source = await getWorkflowProfile(sourceId);
  if (!source) {
    throw new Error("Source workflow profile not found");
  }

  // Create new profile without id and timestamps
  const { id, created_at, updated_at, profile_supplies, ...profileData } = source;

  const newProfile = await createWorkflowProfile({
    ...profileData,
    code: newCode,
    name: newName,
  });

  // Duplicate supplies
  if (profile_supplies && profile_supplies.length > 0) {
    const supabase = createClient();
    for (const ps of profile_supplies) {
      await supabase.from("profile_supplies").insert({
        profile_id: newProfile.id,
        supply_id: ps.supply_id,
        is_default: ps.is_default,
      });
    }
  }

  // Duplicate custom fields
  const customFields = await getWorkflowCustomFields(sourceId);
  for (const field of customFields) {
    const { id: fieldId, created_at: fieldCreated, ...fieldData } = field;
    await createWorkflowCustomField({
      ...fieldData,
      workflow_profile_id: newProfile.id,
    });
  }

  // Duplicate automations
  const automations = await getWorkflowAutomations(sourceId);
  for (const auto of automations) {
    const { id: autoId, created_at: autoCreated, ...autoData } = auto;
    await createWorkflowAutomation({
      ...autoData,
      workflow_profile_id: newProfile.id,
    });
  }

  // Duplicate notifications
  const notifications = await getWorkflowNotifications(sourceId);
  for (const notif of notifications) {
    const { id: notifId, created_at: notifCreated, ...notifData } = notif;
    await upsertWorkflowNotification({
      ...notifData,
      workflow_profile_id: newProfile.id,
    });
  }

  // Duplicate documents
  const documents = await getWorkflowDocuments(sourceId);
  for (const doc of documents) {
    const { id: docId, created_at: docCreated, ...docData } = doc;
    await createWorkflowDocument({
      ...docData,
      workflow_profile_id: newProfile.id,
    });
  }

  return newProfile;
}

/**
 * Delete a workflow profile (soft delete)
 */
export async function deleteWorkflowProfile(id: string): Promise<void> {
  const supabase = createClient();

  // Check if any clients are using this profile
  const { count, error: countError } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("workflow_profile_id", id);

  if (countError) {
    throw new Error(countError.message);
  }

  if (count && count > 0) {
    throw new Error(`Cannot delete workflow profile: ${count} client(s) are currently using it`);
  }

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from("workflow_profiles")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Get all workflow profiles including inactive (for admin view)
 */
export async function getAllWorkflowProfiles(includeInactive = false): Promise<WorkflowProfile[]> {
  const supabase = createClient();

  let query = supabase
    .from("workflow_profiles")
    .select("*")
    .order("sort_order")
    .order("industry")
    .order("name");

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get count of clients using each workflow profile
 */
export async function getWorkflowProfileClientCounts(): Promise<Record<string, number>> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("clients")
    .select("workflow_profile_id")
    .not("workflow_profile_id", "is", null);

  if (error) {
    throw new Error(error.message);
  }

  const counts: Record<string, number> = {};
  for (const client of data || []) {
    if (client.workflow_profile_id) {
      counts[client.workflow_profile_id] = (counts[client.workflow_profile_id] || 0) + 1;
    }
  }

  return counts;
}
