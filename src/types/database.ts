export type InboundStatus = 'ordered' | 'in_transit' | 'arrived' | 'received'
export type OutboundStatus = 'pending' | 'confirmed' | 'processing' | 'packed' | 'shipped' | 'delivered'
export type UserRole = 'admin' | 'warehouse' | 'viewer'

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
}

export interface Inventory {
  id: string
  product_id: string
  location_id: string
  qty_on_hand: number
  qty_reserved: number
  updated_at: string
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
}

export interface InboundItem {
  id: string
  order_id: string
  product_id: string
  qty_expected: number
  qty_received: number
}

export interface OutboundOrder {
  id: string
  order_number: string
  client_id: string
  status: OutboundStatus
  ship_to_address: string | null
  notes: string | null
  carrier: string | null
  tracking_number: string | null
  shipped_date: string | null
  delivered_date: string | null
  requested_at: string | null
  confirmed_at: string | null
  confirmed_by: string | null
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
