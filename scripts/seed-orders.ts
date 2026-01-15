/**
 * Seed script for sample orders (inbound and outbound)
 * Run with: npx tsx scripts/seed-orders.ts
 *
 * Prerequisites: Run seed-products.ts, seed-locations.ts, and seed-clients.ts first
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to generate dates relative to today
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

// Inbound order configurations
const inboundOrders = [
  {
    po_number: "PO-2024-001",
    supplier: "Southern Wine & Spirits",
    status: "received",
    expected_date: daysAgo(10),
    received_date: daysAgo(8),
    notes: "Monthly restock order",
    items: [
      { sku: "VOD-GREY-750", qty_expected: 48, qty_received: 48 },
      { sku: "VOD-TITO-750", qty_expected: 72, qty_received: 72 },
      { sku: "GIN-BOMB-750", qty_expected: 36, qty_received: 36 },
    ],
  },
  {
    po_number: "PO-2024-002",
    supplier: "Republic National Distributing",
    status: "received",
    expected_date: daysAgo(5),
    received_date: daysAgo(4),
    notes: null,
    items: [
      { sku: "WHI-JACK-750", qty_expected: 60, qty_received: 60 },
      { sku: "WHI-MAKE-750", qty_expected: 24, qty_received: 24 },
      { sku: "RUM-BACA-750", qty_expected: 96, qty_received: 96 },
    ],
  },
  {
    po_number: "PO-2024-003",
    supplier: "Breakthru Beverage",
    status: "in_transit",
    expected_date: daysFromNow(2),
    received_date: null,
    notes: "Tequila restock - priority",
    items: [
      { sku: "TEQ-PATR-750", qty_expected: 24, qty_received: 0 },
      { sku: "TEQ-DONJ-750", qty_expected: 18, qty_received: 0 },
      { sku: "TEQ-CAZA-750", qty_expected: 36, qty_received: 0 },
    ],
  },
  {
    po_number: "PO-2024-004",
    supplier: "Johnson Brothers",
    status: "pending",
    expected_date: daysFromNow(7),
    received_date: null,
    notes: "Premium spirits order",
    items: [
      { sku: "WHI-GLEN-750", qty_expected: 12, qty_received: 0 },
      { sku: "GIN-HEND-750", qty_expected: 18, qty_received: 0 },
      { sku: "RUM-DIPL-750", qty_expected: 12, qty_received: 0 },
    ],
  },
];

// Outbound order configurations
const outboundOrders = [
  {
    order_number: "ORD-20240108-0001",
    client_name: "Coastal Spirits & Wine",
    status: "delivered",
    created_at: daysAgo(14),
    shipped_at: daysAgo(12),
    delivered_at: daysAgo(10),
    ship_to_address: "1250 Ocean Drive",
    ship_to_city: "Miami Beach",
    ship_to_state: "FL",
    ship_to_postal_code: "33139",
    ship_to_country: "USA",
    preferred_carrier: "UPS",
    tracking_number: "1Z999AA10123456784",
    is_rush: false,
    notes: null,
    items: [
      { sku: "VOD-GREY-750", qty_requested: 12, qty_picked: 12 },
      { sku: "GIN-BOMB-750", qty_requested: 12, qty_picked: 12 },
      { sku: "WHI-JACK-750", qty_requested: 6, qty_picked: 6 },
    ],
  },
  {
    order_number: "ORD-20240110-0002",
    client_name: "Palm Grove Beverage Co",
    status: "shipped",
    created_at: daysAgo(7),
    shipped_at: daysAgo(5),
    delivered_at: null,
    ship_to_address: "4500 PGA Boulevard, Suite 200",
    ship_to_city: "Palm Beach Gardens",
    ship_to_state: "FL",
    ship_to_postal_code: "33418",
    ship_to_country: "USA",
    preferred_carrier: "FedEx",
    tracking_number: "794644790138",
    is_rush: false,
    notes: "Leave at loading dock",
    items: [
      { sku: "TEQ-PATR-750", qty_requested: 6, qty_picked: 6 },
      { sku: "RUM-BACA-750", qty_requested: 24, qty_picked: 24 },
      { sku: "VOD-TITO-750", qty_requested: 18, qty_picked: 18 },
    ],
  },
  {
    order_number: "ORD-20240112-0003",
    client_name: "Sunset Liquor Distributors",
    status: "packed",
    created_at: daysAgo(3),
    shipped_at: null,
    delivered_at: null,
    ship_to_address: "2800 E Commercial Blvd",
    ship_to_city: "Fort Lauderdale",
    ship_to_state: "FL",
    ship_to_postal_code: "33308",
    ship_to_country: "USA",
    preferred_carrier: "UPS",
    tracking_number: null,
    is_rush: true,
    notes: "Rush order - customer event this weekend",
    items: [
      { sku: "GIN-HEND-750", qty_requested: 6, qty_picked: 6 },
      { sku: "WHI-MAKE-750", qty_requested: 6, qty_picked: 6 },
      { sku: "TEQ-DONJ-750", qty_requested: 6, qty_picked: 0 },
    ],
  },
  {
    order_number: "ORD-20240113-0004",
    client_name: "Tampa Bay Wine & Spirits",
    status: "processing",
    created_at: daysAgo(2),
    shipped_at: null,
    delivered_at: null,
    ship_to_address: "5100 W Kennedy Blvd",
    ship_to_city: "Tampa",
    ship_to_state: "FL",
    ship_to_postal_code: "33609",
    ship_to_country: "USA",
    preferred_carrier: "FedEx",
    tracking_number: null,
    is_rush: false,
    notes: null,
    items: [
      { sku: "VOD-BELU-1L", qty_requested: 6, qty_picked: 0 },
      { sku: "WHI-GLEN-750", qty_requested: 4, qty_picked: 0 },
      { sku: "RUM-DIPL-750", qty_requested: 4, qty_picked: 0 },
    ],
  },
  {
    order_number: "ORD-20240114-0005",
    client_name: "Keys Beverage Group",
    status: "confirmed",
    created_at: daysAgo(1),
    shipped_at: null,
    delivered_at: null,
    ship_to_address: "99501 Overseas Hwy",
    ship_to_city: "Key Largo",
    ship_to_state: "FL",
    ship_to_postal_code: "33037",
    ship_to_country: "USA",
    preferred_carrier: null,
    tracking_number: null,
    is_rush: false,
    notes: "Weekly standing order",
    items: [
      { sku: "RUM-BACA-750", qty_requested: 48, qty_picked: 0 },
      { sku: "RUM-CAPT-750", qty_requested: 24, qty_picked: 0 },
      { sku: "VOD-TITO-750", qty_requested: 24, qty_picked: 0 },
    ],
  },
  {
    order_number: "ORD-20240114-0006",
    client_name: "Coastal Spirits & Wine",
    status: "pending",
    created_at: daysAgo(0),
    shipped_at: null,
    delivered_at: null,
    ship_to_address: "1250 Ocean Drive",
    ship_to_city: "Miami Beach",
    ship_to_state: "FL",
    ship_to_postal_code: "33139",
    ship_to_country: "USA",
    preferred_carrier: null,
    tracking_number: null,
    is_rush: false,
    notes: "New order - awaiting confirmation",
    items: [
      { sku: "GIN-TANK-750", qty_requested: 12, qty_picked: 0 },
      { sku: "WHI-BULL-750", qty_requested: 6, qty_picked: 0 },
    ],
  },
];

async function seedOrders() {
  console.log("Seeding orders...\n");

  // Fetch products, locations, and clients
  const { data: products } = await supabase.from("products").select("id, sku");
  const { data: clients } = await supabase.from("clients").select("id, company_name");

  if (!products || !clients) {
    console.error("Error: Make sure to run seed scripts for products and clients first!");
    return;
  }

  const productMap = new Map(products.map((p) => [p.sku, p.id]));
  const clientMap = new Map(clients.map((c) => [c.company_name, c.id]));

  // Seed Inbound Orders
  console.log("=== INBOUND ORDERS ===\n");

  for (const order of inboundOrders) {
    const { data: inboundOrder, error: orderError } = await supabase
      .from("inbound_orders")
      .upsert(
        {
          order_number: order.po_number,
          supplier: order.supplier,
          status: order.status,
          expected_date: order.expected_date,
          received_at: order.received_date,
          notes: order.notes,
        },
        { onConflict: "order_number" }
      )
      .select()
      .single();

    if (orderError) {
      console.error(`Error creating inbound order ${order.po_number}:`, orderError.message);
      continue;
    }

    // Insert items
    for (const item of order.items) {
      const productId = productMap.get(item.sku);
      if (!productId) {
        console.error(`  Product not found: ${item.sku}`);
        continue;
      }

      await supabase.from("inbound_items").upsert(
        {
          order_id: inboundOrder.id,
          product_id: productId,
          qty_expected: item.qty_expected,
          qty_received: item.qty_received,
        },
        { onConflict: "order_id,product_id" }
      );
    }

    const statusIcon = order.status === "received" ? "✓" : order.status === "in_transit" ? "🚚" : "○";
    console.log(`${statusIcon} ${order.po_number} - ${order.supplier}`);
    console.log(`  Status: ${order.status.toUpperCase()}, Items: ${order.items.length}\n`);
  }

  // Seed Outbound Orders
  console.log("\n=== OUTBOUND ORDERS ===\n");

  for (const order of outboundOrders) {
    const clientId = clientMap.get(order.client_name);
    if (!clientId) {
      console.error(`Client not found: ${order.client_name}`);
      continue;
    }

    const { data: outboundOrder, error: orderError } = await supabase
      .from("outbound_orders")
      .upsert(
        {
          order_number: order.order_number,
          client_id: clientId,
          status: order.status,
          created_at: order.created_at,
          shipped_at: order.shipped_at,
          delivered_at: order.delivered_at,
          ship_to_address: order.ship_to_address,
          ship_to_city: order.ship_to_city,
          ship_to_state: order.ship_to_state,
          ship_to_postal_code: order.ship_to_postal_code,
          ship_to_country: order.ship_to_country,
          preferred_carrier: order.preferred_carrier,
          tracking_number: order.tracking_number,
          is_rush: order.is_rush,
          notes: order.notes,
        },
        { onConflict: "order_number" }
      )
      .select()
      .single();

    if (orderError) {
      console.error(`Error creating outbound order ${order.order_number}:`, orderError.message);
      continue;
    }

    // Insert items
    for (const item of order.items) {
      const productId = productMap.get(item.sku);
      if (!productId) {
        console.error(`  Product not found: ${item.sku}`);
        continue;
      }

      await supabase.from("outbound_items").upsert(
        {
          order_id: outboundOrder.id,
          product_id: productId,
          qty_requested: item.qty_requested,
          qty_picked: item.qty_picked,
          status: item.qty_picked > 0 ? "picked" : "pending",
        },
        { onConflict: "order_id,product_id" }
      );
    }

    const statusIcons: Record<string, string> = {
      delivered: "✓",
      shipped: "🚚",
      packed: "📦",
      processing: "⚙️",
      confirmed: "✔",
      pending: "○",
    };

    console.log(`${statusIcons[order.status] || "•"} ${order.order_number} → ${order.client_name}`);
    console.log(`  Status: ${order.status.toUpperCase()}${order.is_rush ? " [RUSH]" : ""}`);
    if (order.tracking_number) {
      console.log(`  Tracking: ${order.tracking_number} (${order.preferred_carrier})`);
    }
    console.log(`  Items: ${order.items.length}, Ship to: ${order.ship_to_city}, ${order.ship_to_state}\n`);
  }

  console.log("=".repeat(50));
  console.log(`Done! Seeded ${inboundOrders.length} inbound + ${outboundOrders.length} outbound orders.`);
}

seedOrders().catch(console.error);
