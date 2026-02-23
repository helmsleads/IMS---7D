export type InboundStatus = 'ordered' | 'in_transit' | 'arrived' | 'received'
export type OutboundStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered'
export type UserRole = 'admin' | 'warehouse' | 'viewer'

// V2.2.1.1 Service Types
export type ServiceStatus = 'draft' | 'active' | 'archived'

export interface Service {
  id: string
  name: string
  slug: string
  description: string | null
  full_description: string | null
  icon: string | null
  features: string[]
  base_price: number | null
  price_unit: string | null
  status: ServiceStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceAddon {
  id: string
  service_id: string
  name: string
  slug: string
  description: string | null
  price: number | null
  price_unit: string | null
  status: ServiceStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceTier {
  id: string
  name: string
  slug: string
  description: string | null
  min_volume: number | null
  max_volume: number | null
  features: string[]
  is_popular: boolean
  status: ServiceStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ServiceTierPricing {
  id: string
  service_id: string
  tier_id: string
  price: number | null
  price_unit: string | null
  is_custom: boolean
  created_at: string
  updated_at: string
}

// V2.2.1.2 Client Service Types
export interface ClientService {
  id: string
  client_id: string
  service_id: string
  tier_id: string | null
  custom_price: number | null
  custom_price_unit: string | null
  is_active: boolean
  started_at: string | null
  ended_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Optional expanded references
  service?: Service
  tier?: ServiceTier
}

export interface ClientAddon {
  id: string
  client_id: string
  addon_id: string
  custom_price: number | null
  is_active: boolean
  started_at: string | null
  ended_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Optional expanded references
  addon?: ServiceAddon
}

// V2.2.1.3 Billing Types
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'

export interface Invoice {
  id: string
  client_id: string
  invoice_number: string
  period_start: string
  period_end: string
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  status: InvoiceStatus
  due_date: string | null
  sent_at: string | null
  paid_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // Optional expanded references
  client?: Client
  items?: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  total: number
  service_id: string | null
  addon_id: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface UsageRecord {
  id: string
  client_id: string
  service_id: string | null
  addon_id: string | null
  usage_type: string
  quantity: number
  unit_price: number
  total: number
  reference_type: string | null
  reference_id: string | null
  usage_date: string
  invoiced: boolean
  invoice_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// V2.2.1.4 Lot Types
export type LotStatus = 'active' | 'expired' | 'recalled' | 'depleted'

export interface Lot {
  id: string
  product_id: string
  lot_number: string
  batch_number: string | null
  manufacture_date: string | null
  expiration_date: string | null
  received_date: string | null
  supplier: string | null
  notes: string | null
  status: LotStatus
  created_at: string
  updated_at: string
  // Optional expanded references
  product?: Product
}

export interface LotInventory {
  id: string
  lot_id: string
  location_id: string
  sublocation_id: string | null
  qty_on_hand: number
  qty_reserved: number
  created_at: string
  updated_at: string
  // Optional expanded references
  lot?: Lot
  location?: Location
  sublocation?: Sublocation
}

// V2.2.1.5 Return Types
export type ReturnStatus = 'requested' | 'approved' | 'denied' | 'shipped' | 'received' | 'processing' | 'completed' | 'cancelled'
export type ItemCondition = 'good' | 'damaged' | 'defective' | 'expired' | 'other'
export type ItemDisposition = 'restock' | 'discard' | 'return_to_vendor' | 'pending'

export interface Return {
  id: string
  return_number: string
  client_id: string
  original_order_id: string | null
  status: ReturnStatus
  reason: string | null
  reason_details: string | null
  requested_at: string | null
  approved_at: string | null
  approved_by: string | null
  received_at: string | null
  received_by: string | null
  processed_at: string | null
  credit_amount: number | null
  notes: string | null
  created_at: string
  updated_at: string
  // Optional expanded references
  client?: Client
  original_order?: OutboundOrder
  items?: ReturnItem[]
}

export interface ReturnItem {
  id: string
  return_id: string
  product_id: string
  qty_requested: number
  qty_received: number | null
  condition: ItemCondition | null
  disposition: ItemDisposition
  notes: string | null
  created_at: string
  updated_at: string
}

// V2.2.1.6 Message Types
export type ConversationStatus = 'open' | 'closed' | 'archived'
export type SenderType = 'client' | 'user'

export interface Conversation {
  id: string
  client_id: string
  subject: string
  status: ConversationStatus
  last_message_at: string | null
  created_at: string
  // Optional expanded references
  client?: Client
  messages?: Message[]
}

export interface Message {
  id: string
  conversation_id: string
  sender_type: SenderType
  sender_id: string
  content: string
  read_at: string | null
  created_at: string
}

// V2.2.1.7 Client Extended Types
export interface ClientAddress {
  id: string
  client_id: string
  label: string | null
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip: string
  country: string
  is_default: boolean
  is_billing: boolean
  created_at: string
  updated_at: string
}

export interface OrderTemplate {
  id: string
  client_id: string
  name: string
  description: string | null
  address_id: string | null
  created_at: string
  // Optional expanded references
  items?: OrderTemplateItem[]
  address?: ClientAddress
}

export interface OrderTemplateItem {
  id: string
  template_id: string
  product_id: string
  quantity: number
  created_at: string
}

// V2.2.1.8 Supply Types
export interface Supply {
  id: string
  sku: string
  name: string
  description: string | null
  category: string | null
  base_price: number
  cost: number
  unit: string
  is_standard: boolean
  is_active: boolean
  sort_order: number
  industries: ClientIndustry[]
  created_at: string
  updated_at: string
}

export interface SupplyInventory {
  id: string
  supply_id: string
  location_id: string | null
  qty_on_hand: number
  reorder_point: number
  created_at: string
  updated_at: string
  // Optional expanded references
  supply?: Supply
}

export interface SupplyUsage {
  id: string
  supply_id: string
  client_id: string
  order_id: string | null
  quantity: number
  unit_price: number
  total: number
  billing_method: string
  invoiced: boolean
  invoice_id: string | null
  created_at: string
  // Optional expanded references
  supply?: Supply
  client?: Client
  order?: OutboundOrder
}

// V2.2.1.9 Profitability Types
export interface ClientProductValue {
  id: string
  client_id: string
  product_id: string
  sale_price: number | null
  cost: number | null
  created_at: string
  updated_at: string
  // Optional expanded references
  product?: Product
}

// V2.2.1.10 Configuration Types
export interface SystemSetting {
  id: string
  category: string
  setting_key: string
  setting_value: unknown
  description: string | null
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface ClientSetting {
  id: string
  client_id: string
  category: string
  setting_key: string
  setting_value: unknown
  created_at: string
  updated_at: string
  updated_by: string | null
}

export interface PortalSetting {
  id: string
  setting_key: string
  setting_value: unknown
  created_at: string
  updated_at: string
  updated_by: string | null
}

// V2.2.1.11 SOP Types
export type LocationType = 'primary_storage' | 'pick_location' | 'damaged_goods' | 'quarantine' | 'returns_processing' | 'staging' | 'receiving'
export type InventoryStatus = 'available' | 'damaged' | 'quarantine' | 'reserved' | 'returned'
export type DamageResolution = 'pending' | 'credit_requested' | 'credit_received' | 'replaced' | 'written_off' | 'restocked'
export type CountType = 'cycle' | 'full' | 'spot'
export type CountStatus = 'pending' | 'in_progress' | 'pending_approval' | 'completed' | 'cancelled'
export type ChecklistFrequency = 'daily' | 'weekly' | 'monthly' | 'as_needed'

export interface Sublocation {
  id: string
  location_id: string
  code: string
  name: string | null
  zone: string | null
  aisle: string | null
  rack: string | null
  shelf: string | null
  bin: string | null
  barcode: string | null
  capacity: number | null
  is_pickable: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DamageReport {
  id: string
  reference_type: string
  reference_id: string | null
  product_id: string
  quantity: number
  damage_type: string | null
  description: string | null
  photo_urls: string[]
  reported_by: string | null
  reported_at: string
  resolution: DamageResolution
  resolution_notes: string | null
  credit_amount: number | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface CycleCount {
  id: string
  count_number: string
  count_type: CountType
  location_id: string | null
  status: CountStatus
  scheduled_date: string | null
  started_at: string | null
  completed_at: string | null
  assigned_to: string | null
  created_by: string | null
  approved_by: string | null
  approved_at: string | null
  blind_count: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CycleCountItem {
  id: string
  count_id: string
  product_id: string
  sublocation_id: string | null
  expected_qty: number
  counted_qty: number | null
  variance: number | null
  variance_percent: number | null
  counted_by: string | null
  counted_at: string | null
  adjustment_approved: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ChecklistTemplate {
  id: string
  name: string
  description: string | null
  frequency: ChecklistFrequency
  items: unknown[]
  is_active: boolean
  created_at: string
  created_by: string | null
}

export interface ChecklistCompletion {
  id: string
  template_id: string
  location_id: string | null
  completed_items: unknown[]
  notes: string | null
  completed_by: string | null
  completed_at: string
  supervisor_approved: boolean
  supervisor_id: string | null
  approved_at: string | null
  created_at: string
}

export type ContainerType = 'bottle' | 'can' | 'keg' | 'bag_in_box' | 'other';

// Client Industry and Workflow Profiles
// Expanded to support more specific product types - clients can have multiple
export type ClientIndustry =
  | 'spirits'           // Distilled spirits (whiskey, vodka, rum, etc.)
  | 'wine'              // Wine products
  | 'beer'              // Beer and malt beverages
  | 'rtd'               // Ready-to-drink cocktails/beverages
  | 'beverage_non_alc'  // Non-alcoholic beverages (water, soda, juice)
  | 'food'              // Food products
  | 'cosmetics'         // Cosmetics & beauty products
  | 'apparel'           // Clothing, brand merch
  | 'supplements'       // Vitamins, supplements, health products
  | 'general_merchandise'; // General merchandise, other

// Pick strategy for outbound orders
export type PickStrategy = 'FEFO' | 'FIFO' | 'LIFO'

// Billing model types
export type BillingModel = 'per_order' | 'per_unit' | 'monthly' | 'custom'

// Portal feature toggles - structured instead of generic JSON
export interface PortalFeatures {
  can_view_inventory: boolean
  can_request_shipments: boolean
  can_view_lot_details: boolean
  can_request_returns: boolean
  can_view_invoices: boolean
  can_manage_addresses: boolean
  can_use_order_templates: boolean
  can_view_profitability: boolean
  can_send_messages: boolean
  can_view_tracking: boolean
}

export interface WorkflowProfile {
  id: string
  code: string
  name: string
  description: string | null
  industry: ClientIndustry

  // UI Settings
  icon: string | null
  color: string | null
  sort_order: number

  // === COMPLIANCE & TRACKING (all toggleable) ===
  requires_lot_tracking: boolean
  requires_expiration_dates: boolean
  requires_age_verification: boolean
  requires_ttb_compliance: boolean
  has_state_restrictions: boolean
  restricted_states: string[] // Array of state codes
  track_serial_numbers: boolean
  quality_inspection_required: boolean
  quarantine_days: number

  // === INBOUND SETTINGS ===
  inbound_enabled: boolean // Master toggle for inbound rules
  inbound_requires_po: boolean
  inbound_requires_appointment: boolean
  inbound_auto_create_lots: boolean
  inbound_lot_format: string | null // e.g., 'LOT-{YYYY}{MM}{DD}-{SEQ}'
  inbound_require_inspection: boolean

  // === OUTBOUND SETTINGS ===
  outbound_enabled: boolean // Master toggle for outbound rules
  outbound_requires_approval: boolean
  outbound_auto_allocate: boolean
  outbound_pick_strategy: PickStrategy
  outbound_allow_partial_shipment: boolean
  outbound_allow_backorder: boolean
  outbound_packing_slip_template: string | null
  default_requires_repack: boolean

  // === INVENTORY SETTINGS ===
  inventory_enabled: boolean // Master toggle for inventory rules
  inventory_allow_negative: boolean
  inventory_cycle_count_frequency: number | null // Days between counts
  inventory_reorder_alerts: boolean

  // === SHIPPING SETTINGS ===
  shipping_enabled: boolean // Master toggle for shipping rules
  shipping_allowed_carriers: string[] // e.g., ['ups', 'fedex', 'usps']
  shipping_default_service: string | null
  shipping_requires_signature: boolean
  shipping_insurance_threshold: number | null // Auto-insure above this value
  shipping_hazmat_enabled: boolean

  // === RETURNS SETTINGS ===
  returns_enabled: boolean // Master toggle for returns
  returns_allowed: boolean
  returns_window_days: number
  returns_requires_rma: boolean
  returns_auto_restock: boolean

  // === BILLING SETTINGS ===
  billing_enabled: boolean // Master toggle for billing rules
  billing_model: BillingModel
  billing_storage_rate: number | null
  billing_pick_rate: number | null
  billing_pack_rate: number | null
  billing_minimum_monthly: number | null

  // === INTEGRATION SETTINGS ===
  integration_auto_import_orders: boolean
  integration_auto_sync_inventory: boolean
  integration_auto_fulfill: boolean
  integration_hold_for_review: boolean

  // === CONTAINER & SUPPLIES ===
  allowed_container_types: ContainerType[]

  // === PORTAL SETTINGS ===
  portal_features: PortalFeatures

  // === METADATA ===
  is_active: boolean
  created_at: string
  updated_at: string
}

// Custom fields that can be added per workflow
export type CustomFieldType = 'text' | 'textarea' | 'number' | 'decimal' | 'date' | 'datetime' | 'select' | 'multiselect' | 'boolean' | 'file' | 'image' | 'url' | 'email' | 'phone' | 'barcode'
export type CustomFieldAppliesTo = 'product' | 'inbound' | 'outbound' | 'inventory' | 'lot'

export interface WorkflowCustomField {
  id: string
  workflow_profile_id: string
  field_name: string
  field_label: string
  field_type: CustomFieldType
  field_options: { value: string; label: string }[] | null // For select/multiselect
  applies_to: CustomFieldAppliesTo
  is_required: boolean
  default_value: string | null
  validation_regex: string | null
  sort_order: number
  is_active: boolean
  created_at: string
}

// Automation rules
export type AutomationTrigger = 'inbound_received' | 'inbound_arrived' | 'outbound_created' | 'outbound_confirmed' | 'outbound_shipped' | 'outbound_delivered' | 'inventory_low' | 'inventory_expired' | 'return_requested' | 'return_received'
export type AutomationAction = 'send_email' | 'send_sms' | 'create_task' | 'update_status' | 'webhook' | 'generate_document' | 'add_tag'

export interface WorkflowAutomation {
  id: string
  workflow_profile_id: string
  name: string
  description: string | null
  trigger_type: AutomationTrigger
  trigger_conditions: Record<string, unknown> // Flexible conditions
  action_type: AutomationAction
  action_config: Record<string, unknown> // Action-specific config
  is_active: boolean
  created_at: string
}

// Notification settings per event
export interface WorkflowNotification {
  id: string
  workflow_profile_id: string
  event_type: string
  notify_client_email: boolean
  notify_client_sms: boolean
  notify_staff_email: boolean
  webhook_url: string | null
  email_template_id: string | null
  is_active: boolean
  created_at: string
}

// Document templates
export type DocumentType = 'packing_slip' | 'shipping_label' | 'invoice' | 'pick_list' | 'receiving_report' | 'return_label'

export interface WorkflowDocument {
  id: string
  workflow_profile_id: string
  document_type: DocumentType
  template_name: string
  template_content: string | null // HTML template
  is_default: boolean
  created_at: string
}

export interface ProfileSupply {
  id: string
  profile_id: string
  supply_id: string
  is_default: boolean
  created_at: string
}

export interface Product {
  id: string
  sku: string
  name: string
  description: string | null
  category: string | null
  unit_cost: number
  base_price: number
  reorder_point: number
  barcode: string | null
  image_url: string | null
  active: boolean
  created_at: string
  // V2.2.1.12 additions
  lot_tracking_enabled: boolean
  default_expiration_days: number | null
  // Container type for box selection
  container_type: ContainerType
  // Optional workflow override (if client allows)
  workflow_profile_id: string | null
}

export interface Location {
  id: string
  name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  zip: string
  active: boolean
  created_at: string
  // V2.2.1.12 additions
  location_type: LocationType
  is_pickable: boolean
  capacity: number | null
  current_occupancy: number
}

export interface Inventory {
  id: string
  product_id: string
  location_id: string
  qty_on_hand: number
  qty_reserved: number
  updated_at: string
  // V2.2.1.12 additions
  sublocation_id: string | null
  status: InventoryStatus
  status_changed_at: string | null
  status_changed_by: string | null
  status_notes: string | null
}

export interface Client {
  id: string
  company_name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  active: boolean
  created_at: string
  // V2.2.1.12 additions
  service_tier_id: string | null
  // Industry and workflow profile
  industry: ClientIndustry
  workflow_profile_id: string | null
  // Allow products to have their own workflow overrides
  allow_product_workflow_override: boolean
}

// Client user roles for portal access
export type ClientUserRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface ClientUser {
  id: string
  client_id: string
  user_id: string
  role: ClientUserRole
  is_primary: boolean
  invited_by: string | null
  invited_at: string | null
  accepted_at: string | null
  created_at: string
}

export interface ClientUserWithDetails extends ClientUser {
  client: {
    id: string
    company_name: string
    industry: ClientIndustry
  }
  user?: {
    id: string
    email: string
    full_name: string | null
    phone: string | null
    title: string | null
  }
}

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  title: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  active: boolean
  created_at: string
}

export interface InboundOrder {
  id: string
  po_number: string
  client_id: string
  supplier: string | null
  status: InboundStatus
  expected_date: string | null
  received_date: string | null
  received_by: string | null
  notes: string | null
  created_at: string
  // Shopify incoming inventory sync tracking
  shopify_incoming_synced: boolean
  shopify_incoming_synced_at: string | null
}

export interface InboundItem {
  id: string
  order_id: string
  product_id: string
  qty_expected: number
  qty_received: number
}

export type OrderSource = 'portal' | 'internal' | 'api';

export interface OutboundOrder {
  id: string
  order_number: string
  client_id: string
  status: OutboundStatus
  source: OrderSource

  // External platform tracking (Shopify, etc.)
  external_order_id: string | null
  external_platform: string | null
  external_order_number: string | null
  integration_id: string | null

  // Shipping address
  ship_to_name: string | null
  ship_to_company: string | null
  ship_to_address: string | null
  ship_to_address2: string | null
  ship_to_city: string | null
  ship_to_state: string | null
  ship_to_postal_code: string | null
  ship_to_country: string | null
  ship_to_phone: string | null
  ship_to_email: string | null

  notes: string | null
  carrier: string | null
  tracking_number: string | null
  shipped_date: string | null
  delivered_date: string | null
  requested_at: string | null
  confirmed_at: string | null
  confirmed_by: string | null
  is_rush: boolean | null
  preferred_carrier: string | null
  requires_repack: boolean
  created_at: string
}

export interface OutboundItem {
  id: string
  order_id: string
  product_id: string
  qty_requested: number
  qty_shipped: number
  unit_price: number
}

// Inventory Automation Types

export type TransactionType =
  | 'receive'
  | 'putaway'
  | 'pick'
  | 'pack'
  | 'ship'
  | 'adjust'
  | 'transfer'
  | 'return_restock'
  | 'damage_writeoff'
  | 'cycle_count'
  | 'reserve'
  | 'release'
  | 'expire'
  | 'quarantine'

export type ReferenceType =
  | 'inbound_order'
  | 'outbound_order'
  | 'return'
  | 'damage_report'
  | 'cycle_count'
  | 'stock_transfer'
  | 'manual'
  | 'lpn'

export type InventoryStage =
  | 'receiving'
  | 'putaway'
  | 'available'
  | 'reserved'
  | 'allocated'
  | 'picking'
  | 'packing'
  | 'staged'
  | 'shipped'
  | 'quarantine'

export interface InventoryTransaction {
  id: string
  inventory_id: string | null
  product_id: string
  location_id: string
  sublocation_id: string | null
  transaction_type: TransactionType
  qty_before: number
  qty_change: number
  qty_after: number
  reserved_before: number
  reserved_change: number
  reserved_after: number
  reference_type: ReferenceType | null
  reference_id: string | null
  lot_id: string | null
  reason: string | null
  notes: string | null
  performed_by: string | null
  created_at: string
}

export type ScanType = 'product' | 'lpn' | 'location' | 'sublocation' | 'lot'

export type WorkflowStage =
  | 'receiving'
  | 'putaway'
  | 'picking'
  | 'packing'
  | 'shipping'
  | 'cycle_count'
  | 'transfer'
  | 'return_processing'
  | 'damage_inspection'

export type ScanResult = 'success' | 'error' | 'warning'

export interface ScanEvent {
  id: string
  scan_type: ScanType
  barcode: string
  product_id: string | null
  lpn_id: string | null
  location_id: string | null
  sublocation_id: string | null
  lot_id: string | null
  workflow_stage: WorkflowStage
  reference_type: ReferenceType | null
  reference_id: string | null
  scanner_id: string | null
  station_id: string | null
  scan_result: ScanResult
  error_message: string | null
  qty_scanned: number | null
  fill_status: 'full' | 'empty' | null
  scanned_by: string | null
  scanned_at: string
}

export type LPNContainerType = 'pallet' | 'case' | 'tote' | 'bin' | 'carton' | 'bag' | 'other'
export type LPNStatus = 'active' | 'in_transit' | 'shipped' | 'empty' | 'damaged' | 'disposed'
export type LPNStage = 'receiving' | 'putaway' | 'storage' | 'picking' | 'packing' | 'staged' | 'shipped'

export interface LPN {
  id: string
  lpn_number: string
  container_type: LPNContainerType
  location_id: string | null
  sublocation_id: string | null
  status: LPNStatus
  stage: LPNStage
  parent_lpn_id: string | null
  length_inches: number | null
  width_inches: number | null
  height_inches: number | null
  weight_lbs: number | null
  reference_type: string | null
  reference_id: string | null
  is_mixed: boolean
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LPNContent {
  id: string
  lpn_id: string
  product_id: string
  lot_id: string | null
  qty: number
  uom: string
  fill_status: 'full' | 'empty'
  created_at: string
  updated_at: string
}

export type ProductType =
  | 'spirits'
  | 'wine'
  | 'beer'
  | 'food'
  | 'electronics'
  | 'apparel'
  | 'pharma'
  | 'hazmat'
  | 'general'

export type PickStrategy = 'FIFO' | 'FEFO' | 'LIFO' | 'SERIAL'

export interface ProductTypeConfig {
  id: string
  product_type: ProductType
  display_name: string
  requires_lot_tracking: boolean
  requires_expiration: boolean
  requires_serial_number: boolean
  requires_temperature_control: boolean
  default_pick_strategy: PickStrategy
  default_shelf_life_days: number | null
  expiration_warning_days: number | null
  track_fill_status: boolean
  special_handling_notes: string | null
  created_at: string
  updated_at: string
}

export interface ProductUOM {
  id: string
  product_id: string
  uom: 'each' | 'bottle' | 'case' | 'pack' | 'pallet'
  qty_per_uom: number
  barcode: string | null
  length_inches: number | null
  width_inches: number | null
  height_inches: number | null
  weight_lbs: number | null
  is_default_receive: boolean
  is_default_ship: boolean
  created_at: string
}

export interface InventoryMovement {
  id: string
  inventory_id: string | null
  product_id: string
  lot_id: string | null
  lpn_id: string | null
  movement_type: string
  from_location_id: string | null
  from_sublocation_id: string | null
  to_location_id: string | null
  to_sublocation_id: string | null
  qty_moved: number
  reference_type: ReferenceType | null
  reference_id: string | null
  notes: string | null
  performed_by: string | null
  created_at: string
}

// Billing Automation Types

export type BillingFrequency = 'weekly' | 'biweekly' | 'monthly'
export type BillingRunType = 'scheduled' | 'manual' | 'retry'
export type BillingRunStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial'
export type RateCategory = 'storage' | 'inbound' | 'outbound' | 'pick' | 'pack' | 'special' | 'return' | 'supply'

export interface ClientBillingConfig {
  id: string
  client_id: string
  billing_frequency: BillingFrequency
  billing_day_of_month: number
  billing_day_of_week: number
  payment_terms_days: number
  late_fee_percent: number
  monthly_minimum: number
  tax_rate: number
  tax_exempt: boolean
  auto_generate_invoices: boolean
  auto_send_invoices: boolean
  billing_email: string | null
  billing_contact_name: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VolumeTier {
  min_qty: number
  max_qty: number | null
  unit_price: number
}

export interface ClientRateCard {
  id: string
  client_id: string
  rate_category: RateCategory
  rate_code: string
  rate_name: string
  description: string | null
  unit_price: number
  price_unit: string
  volume_tiers: VolumeTier[]
  minimum_charge: number
  effective_date: string | null
  expiration_date: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

export interface DefaultRateTemplate {
  id: string
  template_name: string
  is_default: boolean
  rate_category: RateCategory
  rate_code: string
  rate_name: string
  description: string | null
  unit_price: number
  price_unit: string
  volume_tiers: VolumeTier[]
  minimum_charge: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface BillingRun {
  id: string
  run_number: string
  run_type: BillingRunType
  period_start: string
  period_end: string
  client_id: string | null
  status: BillingRunStatus
  invoices_generated: number
  total_billed: number
  errors: Array<{ client_id: string; error: string }>
  started_at: string | null
  completed_at: string | null
  started_by: string | null
  created_at: string
}

export interface StorageSnapshot {
  id: string
  snapshot_date: string
  client_id: string
  product_id: string
  location_id: string | null
  qty_on_hand: number
  qty_reserved: number
  pallet_count: number
  cubic_feet: number
  weight_lbs: number
  created_at: string
}

// Product Category Types

export interface ProductCategory {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  color: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Optional expanded references
  subcategories?: ProductSubcategory[]
}

export interface ProductSubcategory {
  id: string
  category_id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  // Optional expanded references
  category?: ProductCategory
}

// ===== SHOPIFY INTEGRATION TYPES =====

export type IntegrationPlatform = 'shopify' | 'tiktok' | 'amazon' | 'ebay' | 'woocommerce'
export type IntegrationStatus = 'pending' | 'active' | 'paused' | 'error' | 'disconnected'
export type WebhookStatus = 'received' | 'processing' | 'processed' | 'failed' | 'skipped'

export interface IntegrationSettings {
  auto_import_orders: boolean
  auto_sync_inventory: boolean
  auto_sync_prices?: boolean
  sync_inventory_interval_minutes: number
  inventory_buffer: number
  default_location_id: string | null
  fulfillment_notify_customer: boolean
  shopify_location_id?: string
}

export interface ClientIntegration {
  id: string
  client_id: string
  platform: IntegrationPlatform
  shop_domain: string | null
  shop_name: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  scope: string | null
  webhook_secret: string | null
  webhooks_registered: boolean
  settings: IntegrationSettings
  status: IntegrationStatus
  status_message: string | null
  last_order_sync_at: string | null
  last_inventory_sync_at: string | null
  last_error_at: string | null
  last_error_message: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  // Multi-location support
  shopify_location_id: string | null
  shopify_location_name: string | null
  location_created_by_us: boolean
}

export interface ProductMapping {
  id: string
  integration_id: string
  product_id: string
  external_product_id: string
  external_variant_id: string | null
  external_sku: string | null
  external_barcode: string | null
  external_inventory_item_id: string | null
  sync_inventory: boolean
  sync_price: boolean
  external_title: string | null
  external_image_url: string | null
  last_synced_at: string | null
  created_at: string
  // Optional expanded references
  product?: Product
  integration?: ClientIntegration
  // Incoming inventory tracking (from pending inbounds)
  incoming_qty: number
  incoming_updated_at: string | null
}

export interface WebhookEvent {
  id: string
  integration_id: string | null
  platform: IntegrationPlatform
  event_type: string
  event_id: string | null
  payload: Record<string, unknown>
  headers: Record<string, unknown> | null
  status: WebhookStatus
  error_message: string | null
  retry_count: number
  received_at: string
  processed_at: string | null
}

// Shopify-specific types
export interface ShopifyOrder {
  id: number
  name: string
  email: string
  created_at: string
  updated_at: string
  financial_status: string
  fulfillment_status: string | null
  line_items: ShopifyLineItem[]
  shipping_address: ShopifyAddress | null
  shipping_lines: ShopifyShippingLine[]
  note: string | null
  tags: string
  total_price: string
  currency: string
  test: boolean
  source_name: string
}

export interface ShopifyLineItem {
  id: number
  product_id: number
  variant_id: number
  sku: string
  name: string
  title: string
  quantity: number
  price: string
  fulfillable_quantity: number
  requires_shipping: boolean
}

export interface ShopifyAddress {
  first_name: string
  last_name: string
  company: string | null
  address1: string
  address2: string | null
  city: string
  province: string
  province_code: string
  zip: string
  country: string
  country_code: string
  phone: string | null
}

export interface ShopifyShippingLine {
  id: number
  title: string
  price: string
  code: string
}

export interface ShopifyProduct {
  id: number
  title: string
  variants: ShopifyVariant[]
}

export interface ShopifyVariant {
  id: number
  product_id: number
  title: string
  sku: string
  price: string
  inventory_item_id: number
  inventory_quantity: number
}

// ===== INTEGRATION SYNC LOG TYPES =====

export type SyncType = 'inventory' | 'orders' | 'fulfillment' | 'return' | 'incoming' | 'price'
export type SyncDirection = 'outbound' | 'inbound'
export type SyncStatus = 'success' | 'partial' | 'failed'
export type SyncTrigger = 'cron' | 'event' | 'manual' | 'webhook'

export interface IntegrationSyncLog {
  id: string
  integration_id: string
  sync_type: SyncType
  direction: SyncDirection
  status: SyncStatus
  items_processed: number
  items_failed: number
  error_details: Array<{ productId?: string; error: string }>
  duration_ms: number | null
  triggered_by: SyncTrigger
  metadata: Record<string, unknown>
  created_at: string
}

// ===== SPREADSHEET IMPORT TYPES =====

export type SpreadsheetImportStatus = 'pending' | 'processing' | 'completed' | 'failed'
export type SpreadsheetImportType = 'baseline' | 'update'

export interface SpreadsheetImport {
  id: string
  filename: string
  file_type: 'csv' | 'xlsx'
  import_type: SpreadsheetImportType
  status: SpreadsheetImportStatus
  total_rows: number
  products_created: number
  products_updated: number
  inventory_updated: number
  rows_skipped: number
  discrepancies: Array<{
    sku: string
    name: string
    sheetQty: number
    systemQty: number
    difference: number
  }>
  errors: Array<{ row: number; sku: string; error: string }>
  applied_data: Array<{
    sku: string
    name: string
    action: string
    qty: number
    clientId: string | null
  }>
  brand_client_map: Record<string, string | null>
  location_id: string | null
  imported_by: string | null
  completed_at: string | null
  created_at: string
  notes: string | null
}
