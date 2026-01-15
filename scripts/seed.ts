/**
 * Master seed script - runs all seed scripts in order
 * Run with: npm run seed
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Import all seed data
import { execSync } from "child_process";
import * as path from "path";

const scriptsDir = path.dirname(__filename);

interface SeedStep {
  name: string;
  script: string;
  description: string;
}

const seedSteps: SeedStep[] = [
  {
    name: "Products",
    script: "seed-products.ts",
    description: "16 spirits products (Gin, Vodka, Whiskey, Tequila, Rum)",
  },
  {
    name: "Locations",
    script: "seed-locations.ts",
    description: "3 warehouse locations in South Florida",
  },
  {
    name: "Clients",
    script: "seed-clients.ts",
    description: "5 distribution clients",
  },
  {
    name: "Inventory",
    script: "seed-inventory.ts",
    description: "Stock levels across locations (includes low stock items)",
  },
  {
    name: "Orders",
    script: "seed-orders.ts",
    description: "4 inbound + 6 outbound orders with various statuses",
  },
];

async function checkConnection(): Promise<boolean> {
  console.log("Checking database connection...");

  const { error } = await supabase.from("products").select("id").limit(1);

  if (error) {
    console.error("❌ Database connection failed:", error.message);
    console.log("\nMake sure your .env.local file has valid Supabase credentials.");
    return false;
  }

  console.log("✓ Database connected\n");
  return true;
}

async function runSeed() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║           7 DEGREES CO - DATABASE SEED SCRIPT              ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Check connection first
  const connected = await checkConnection();
  if (!connected) {
    process.exit(1);
  }

  console.log("Seed plan:");
  console.log("─".repeat(60));
  seedSteps.forEach((step, index) => {
    console.log(`  ${index + 1}. ${step.name.padEnd(12)} - ${step.description}`);
  });
  console.log("─".repeat(60) + "\n");

  const startTime = Date.now();
  let successCount = 0;
  let failCount = 0;

  for (const step of seedSteps) {
    console.log(`\n${"═".repeat(60)}`);
    console.log(`STEP: ${step.name.toUpperCase()}`);
    console.log("═".repeat(60) + "\n");

    try {
      const scriptPath = path.join(scriptsDir, step.script);
      execSync(`npx tsx "${scriptPath}"`, {
        stdio: "inherit",
        cwd: path.join(scriptsDir, ".."),
      });
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed to run ${step.script}`);
      failCount++;

      // Continue with other scripts even if one fails
      console.log("Continuing with remaining scripts...\n");
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n" + "═".repeat(60));
  console.log("SEED COMPLETE");
  console.log("═".repeat(60));
  console.log(`\n  ✓ Successful: ${successCount}/${seedSteps.length}`);
  if (failCount > 0) {
    console.log(`  ✗ Failed: ${failCount}/${seedSteps.length}`);
  }
  console.log(`  ⏱ Duration: ${duration}s`);
  console.log("\nYour database is now populated with sample data!");
  console.log("─".repeat(60) + "\n");
}

// Check for --clear flag to reset data first
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log(`
Usage: npm run seed [options]

Options:
  --help    Show this help message

This script seeds the database with sample data including:
  - Products (spirits inventory)
  - Locations (warehouses)
  - Clients (distribution partners)
  - Inventory (stock levels)
  - Orders (inbound and outbound)

The script uses upsert operations, so it's safe to run multiple times.
`);
  process.exit(0);
}

runSeed().catch((error) => {
  console.error("Seed script failed:", error);
  process.exit(1);
});
