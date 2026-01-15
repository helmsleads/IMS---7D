/**
 * Seed script for sample inventory
 * Run with: npx tsx scripts/seed-inventory.ts
 *
 * Prerequisites: Run seed-products.ts and seed-locations.ts first
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Inventory distribution configuration
// Format: { sku: { locationName: { qty_on_hand, qty_reserved } } }
const inventoryConfig: Record<string, Record<string, { qty: number; reserved?: number }>> = {
  // Gin - well stocked
  "GIN-BOMB-750": {
    "Miami Warehouse": { qty: 120, reserved: 12 },
    "Storage Unit A": { qty: 48 },
    "Fort Lauderdale Depot": { qty: 36 },
  },
  "GIN-HEND-750": {
    "Miami Warehouse": { qty: 72 },
    "Fort Lauderdale Depot": { qty: 24 },
  },
  "GIN-TANK-750": {
    "Miami Warehouse": { qty: 96 },
    "Storage Unit A": { qty: 24 },
  },

  // Vodka - mixed stock levels
  "VOD-GREY-750": {
    "Miami Warehouse": { qty: 84, reserved: 6 },
    "Fort Lauderdale Depot": { qty: 36 },
  },
  "VOD-TITO-750": {
    "Miami Warehouse": { qty: 144 },
    "Storage Unit A": { qty: 72 },
    "Fort Lauderdale Depot": { qty: 48 },
  },
  "VOD-BELU-1L": {
    "Miami Warehouse": { qty: 18 },  // Above reorder (12)
  },

  // Whiskey - some low stock
  "WHI-JACK-750": {
    "Miami Warehouse": { qty: 108 },
    "Storage Unit A": { qty: 36 },
    "Fort Lauderdale Depot": { qty: 24 },
  },
  "WHI-MAKE-750": {
    "Miami Warehouse": { qty: 20 },  // Low stock! (reorder: 24)
    "Fort Lauderdale Depot": { qty: 6 },
  },
  "WHI-GLEN-750": {
    "Miami Warehouse": { qty: 10 },  // Low stock! (reorder: 12)
  },
  "WHI-BULL-750": {
    "Miami Warehouse": { qty: 48 },
    "Storage Unit A": { qty: 18 },
  },

  // Tequila - one out of stock
  "TEQ-PATR-750": {
    "Miami Warehouse": { qty: 36, reserved: 12 },
    "Fort Lauderdale Depot": { qty: 18 },
  },
  "TEQ-DONJ-750": {
    "Miami Warehouse": { qty: 0 },  // OUT OF STOCK!
  },
  "TEQ-CAZA-750": {
    "Miami Warehouse": { qty: 60 },
    "Storage Unit A": { qty: 24 },
  },

  // Rum - various levels
  "RUM-BACA-750": {
    "Miami Warehouse": { qty: 180 },
    "Storage Unit A": { qty: 96 },
    "Fort Lauderdale Depot": { qty: 72 },
  },
  "RUM-CAPT-750": {
    "Miami Warehouse": { qty: 30 },  // Low stock! (reorder: 36)
    "Storage Unit A": { qty: 12 },
  },
  "RUM-DIPL-750": {
    "Miami Warehouse": { qty: 8 },  // Low stock! (reorder: 12)
  },
};

async function seedInventory() {
  console.log("Seeding inventory...\n");

  // Fetch all products
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, sku, name, reorder_point");

  if (productsError || !products) {
    console.error("Error fetching products:", productsError?.message);
    console.log("\nMake sure to run seed-products.ts first!");
    return;
  }

  // Fetch all locations
  const { data: locations, error: locationsError } = await supabase
    .from("locations")
    .select("id, name");

  if (locationsError || !locations) {
    console.error("Error fetching locations:", locationsError?.message);
    console.log("\nMake sure to run seed-locations.ts first!");
    return;
  }

  // Create lookup maps
  const productMap = new Map(products.map((p) => [p.sku, p]));
  const locationMap = new Map(locations.map((l) => [l.name, l]));

  let successCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const [sku, locationQtys] of Object.entries(inventoryConfig)) {
    const product = productMap.get(sku);
    if (!product) {
      console.error(`Product not found: ${sku}`);
      continue;
    }

    for (const [locationName, { qty, reserved }] of Object.entries(locationQtys)) {
      const location = locationMap.get(locationName);
      if (!location) {
        console.error(`Location not found: ${locationName}`);
        continue;
      }

      const { error } = await supabase
        .from("inventory")
        .upsert(
          {
            product_id: product.id,
            location_id: location.id,
            qty_on_hand: qty,
            qty_reserved: reserved || 0,
          },
          { onConflict: "product_id,location_id" }
        );

      if (error) {
        console.error(`Error inserting inventory for ${sku} at ${locationName}:`, error.message);
      } else {
        let status = "";
        if (qty === 0) {
          status = " ⚠️  OUT OF STOCK";
          outOfStockCount++;
        } else if (qty <= product.reorder_point) {
          status = " ⚡ LOW STOCK";
          lowStockCount++;
        }

        console.log(
          `✓ ${sku.padEnd(15)} @ ${locationName.padEnd(22)} qty: ${String(qty).padStart(3)}${reserved ? ` (${reserved} reserved)` : ""}${status}`
        );
        successCount++;
      }
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Done! Created ${successCount} inventory records.`);
  console.log(`  - ${outOfStockCount} out of stock`);
  console.log(`  - ${lowStockCount} low stock (at or below reorder point)`);
}

seedInventory().catch(console.error);
