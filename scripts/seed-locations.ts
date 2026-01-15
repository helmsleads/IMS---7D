/**
 * Seed script for sample locations
 * Run with: npx tsx scripts/seed-locations.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Location {
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active: boolean;
}

const locations: Location[] = [
  {
    name: "Miami Warehouse",
    address: "8500 NW 25th St",
    city: "Doral",
    state: "FL",
    postal_code: "33122",
    country: "USA",
    is_active: true,
  },
  {
    name: "Storage Unit A",
    address: "2100 NW 42nd Ave, Unit A",
    city: "Miami",
    state: "FL",
    postal_code: "33142",
    country: "USA",
    is_active: true,
  },
  {
    name: "Fort Lauderdale Depot",
    address: "1850 SW 2nd Ave",
    city: "Fort Lauderdale",
    state: "FL",
    postal_code: "33315",
    country: "USA",
    is_active: true,
  },
];

async function seedLocations() {
  console.log("Seeding locations...\n");

  for (const location of locations) {
    const { data, error } = await supabase
      .from("locations")
      .upsert(
        {
          name: location.name,
          address: location.address,
          city: location.city,
          state: location.state,
          postal_code: location.postal_code,
          country: location.country,
          is_active: location.is_active,
        },
        { onConflict: "name" }
      )
      .select()
      .single();

    if (error) {
      console.error(`Error inserting ${location.name}:`, error.message);
    } else {
      console.log(`✓ ${location.name} - ${location.city}, ${location.state}`);
    }
  }

  console.log("\nDone! Seeded", locations.length, "locations.");
}

seedLocations().catch(console.error);
