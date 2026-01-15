/**
 * Seed script for sample products
 * Run with: npx tsx scripts/seed-products.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Product {
  sku: string;
  name: string;
  description: string;
  category: string;
  unit_cost: number;
  unit_price: number;
  reorder_point: number;
  barcode?: string;
}

const products: Product[] = [
  // Gin
  {
    sku: "GIN-BOMB-750",
    name: "Bombay Sapphire London Dry Gin",
    description: "Premium London dry gin with 10 botanicals, 750ml",
    category: "Gin",
    unit_cost: 18.50,
    unit_price: 28.99,
    reorder_point: 24,
    barcode: "080480301002",
  },
  {
    sku: "GIN-HEND-750",
    name: "Hendrick's Gin",
    description: "Scottish gin infused with cucumber and rose, 750ml",
    category: "Gin",
    unit_cost: 24.00,
    unit_price: 36.99,
    reorder_point: 18,
    barcode: "083664868735",
  },
  {
    sku: "GIN-TANK-750",
    name: "Tanqueray London Dry Gin",
    description: "Classic London dry gin, four-times distilled, 750ml",
    category: "Gin",
    unit_cost: 16.00,
    unit_price: 24.99,
    reorder_point: 30,
    barcode: "088110110048",
  },

  // Vodka
  {
    sku: "VOD-GREY-750",
    name: "Grey Goose Vodka",
    description: "French premium vodka made from winter wheat, 750ml",
    category: "Vodka",
    unit_cost: 22.00,
    unit_price: 34.99,
    reorder_point: 24,
    barcode: "080480280024",
  },
  {
    sku: "VOD-TITO-750",
    name: "Tito's Handmade Vodka",
    description: "American craft vodka, gluten-free, 750ml",
    category: "Vodka",
    unit_cost: 14.00,
    unit_price: 22.99,
    reorder_point: 48,
    barcode: "619947000020",
  },
  {
    sku: "VOD-BELU-1L",
    name: "Beluga Noble Russian Vodka",
    description: "Premium Russian vodka, triple filtered, 1L",
    category: "Vodka",
    unit_cost: 32.00,
    unit_price: 49.99,
    reorder_point: 12,
  },

  // Whiskey
  {
    sku: "WHI-JACK-750",
    name: "Jack Daniel's Old No. 7",
    description: "Tennessee whiskey, charcoal mellowed, 750ml",
    category: "Whiskey",
    unit_cost: 18.00,
    unit_price: 27.99,
    reorder_point: 36,
    barcode: "082184090466",
  },
  {
    sku: "WHI-MAKE-750",
    name: "Maker's Mark Bourbon",
    description: "Kentucky straight bourbon whisky, 750ml",
    category: "Whiskey",
    unit_cost: 20.00,
    unit_price: 31.99,
    reorder_point: 24,
    barcode: "085246139431",
  },
  {
    sku: "WHI-GLEN-750",
    name: "Glenfiddich 12 Year Single Malt",
    description: "Speyside single malt Scotch whisky, 750ml",
    category: "Whiskey",
    unit_cost: 35.00,
    unit_price: 52.99,
    reorder_point: 12,
    barcode: "083664871650",
  },
  {
    sku: "WHI-BULL-750",
    name: "Bulleit Bourbon",
    description: "High-rye bourbon with bold spicy character, 750ml",
    category: "Whiskey",
    unit_cost: 22.00,
    unit_price: 33.99,
    reorder_point: 24,
  },

  // Tequila
  {
    sku: "TEQ-PATR-750",
    name: "Patron Silver Tequila",
    description: "Ultra-premium silver tequila, 100% Weber Blue Agave, 750ml",
    category: "Tequila",
    unit_cost: 36.00,
    unit_price: 54.99,
    reorder_point: 18,
    barcode: "721733000012",
  },
  {
    sku: "TEQ-DONJ-750",
    name: "Don Julio Blanco",
    description: "Premium blanco tequila, crisp agave flavor, 750ml",
    category: "Tequila",
    unit_cost: 38.00,
    unit_price: 56.99,
    reorder_point: 12,
    barcode: "674545000711",
  },
  {
    sku: "TEQ-CAZA-750",
    name: "Cazadores Reposado",
    description: "Reposado tequila aged in American oak, 750ml",
    category: "Tequila",
    unit_cost: 18.00,
    unit_price: 28.99,
    reorder_point: 24,
  },

  // Rum
  {
    sku: "RUM-BACA-750",
    name: "Bacardi Superior White Rum",
    description: "Light-bodied white rum, perfect for cocktails, 750ml",
    category: "Rum",
    unit_cost: 10.00,
    unit_price: 16.99,
    reorder_point: 48,
    barcode: "080480015008",
  },
  {
    sku: "RUM-CAPT-750",
    name: "Captain Morgan Original Spiced",
    description: "Caribbean rum with spices and natural flavors, 750ml",
    category: "Rum",
    unit_cost: 12.00,
    unit_price: 19.99,
    reorder_point: 36,
    barcode: "087000007536",
  },
  {
    sku: "RUM-DIPL-750",
    name: "Diplomatico Reserva Exclusiva",
    description: "Premium Venezuelan rum, aged 12 years, 750ml",
    category: "Rum",
    unit_cost: 32.00,
    unit_price: 48.99,
    reorder_point: 12,
  },
];

async function seedProducts() {
  console.log("Seeding products...\n");

  for (const product of products) {
    const { data, error } = await supabase
      .from("products")
      .upsert(
        {
          sku: product.sku,
          name: product.name,
          description: product.description,
          category: product.category,
          unit_cost: product.unit_cost,
          unit_price: product.unit_price,
          reorder_point: product.reorder_point,
          barcode: product.barcode || null,
        },
        { onConflict: "sku" }
      )
      .select()
      .single();

    if (error) {
      console.error(`Error inserting ${product.sku}:`, error.message);
    } else {
      console.log(`✓ ${product.sku} - ${product.name}`);
    }
  }

  console.log("\nDone! Seeded", products.length, "products.");
}

seedProducts().catch(console.error);
