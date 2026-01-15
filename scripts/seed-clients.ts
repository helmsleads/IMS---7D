/**
 * Seed script for sample clients
 * Run with: npx tsx scripts/seed-clients.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface Client {
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_active: boolean;
}

const clients: Client[] = [
  {
    company_name: "Coastal Spirits & Wine",
    contact_name: "Maria Rodriguez",
    email: "maria@coastalspirits.com",
    phone: "(305) 555-0142",
    address: "1250 Ocean Drive",
    city: "Miami Beach",
    state: "FL",
    postal_code: "33139",
    country: "USA",
    is_active: true,
  },
  {
    company_name: "Palm Grove Beverage Co",
    contact_name: "James Chen",
    email: "jchen@palmgrovebev.com",
    phone: "(561) 555-0198",
    address: "4500 PGA Boulevard, Suite 200",
    city: "Palm Beach Gardens",
    state: "FL",
    postal_code: "33418",
    country: "USA",
    is_active: true,
  },
  {
    company_name: "Sunset Liquor Distributors",
    contact_name: "Anthony DiMaggio",
    email: "tony@sunsetliquor.com",
    phone: "(954) 555-0167",
    address: "2800 E Commercial Blvd",
    city: "Fort Lauderdale",
    state: "FL",
    postal_code: "33308",
    country: "USA",
    is_active: true,
  },
  {
    company_name: "Tampa Bay Wine & Spirits",
    contact_name: "Sarah Mitchell",
    email: "smitchell@tbwines.com",
    phone: "(813) 555-0234",
    address: "5100 W Kennedy Blvd",
    city: "Tampa",
    state: "FL",
    postal_code: "33609",
    country: "USA",
    is_active: true,
  },
  {
    company_name: "Keys Beverage Group",
    contact_name: "Daniel Reyes",
    email: "dreyes@keysbeverage.com",
    phone: "(305) 555-0289",
    address: "99501 Overseas Hwy",
    city: "Key Largo",
    state: "FL",
    postal_code: "33037",
    country: "USA",
    is_active: true,
  },
];

async function seedClients() {
  console.log("Seeding clients...\n");

  for (const client of clients) {
    const { data, error } = await supabase
      .from("clients")
      .upsert(
        {
          company_name: client.company_name,
          contact_name: client.contact_name,
          email: client.email,
          phone: client.phone,
          address: client.address,
          city: client.city,
          state: client.state,
          postal_code: client.postal_code,
          country: client.country,
          is_active: client.is_active,
        },
        { onConflict: "email" }
      )
      .select()
      .single();

    if (error) {
      console.error(`Error inserting ${client.company_name}:`, error.message);
    } else {
      console.log(`✓ ${client.company_name}`);
      console.log(`  Contact: ${client.contact_name} <${client.email}>`);
      console.log(`  Location: ${client.city}, ${client.state}\n`);
    }
  }

  console.log("Done! Seeded", clients.length, "clients.");
}

seedClients().catch(console.error);
