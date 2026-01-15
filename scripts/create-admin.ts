/**
 * Create super-admin user
 * Run with: npx tsx scripts/create-admin.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdminUser() {
  const email = "sam@helmsmanimports.com";
  const password = "Boisfranc24$";

  console.log("Creating super-admin user...\n");

  // Sign up the user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) {
    // Check if user already exists
    if (authError.message.includes("already registered")) {
      console.log("User already exists in auth. Checking users table...");

      // Try to sign in to get user ID
      const { data: signInData } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData?.user) {
        // Check if already in users table
        const { data: existingUser } = await supabase
          .from("users")
          .select("*")
          .eq("id", signInData.user.id)
          .single();

        if (existingUser) {
          console.log("✓ User already exists in users table");
          console.log(`  Email: ${email}`);
          console.log(`  Role: ${existingUser.role}`);
          return;
        }

        // Add to users table
        const { error: insertError } = await supabase.from("users").insert({
          id: signInData.user.id,
          email,
          name: "Sam",
          role: "super_admin",
        });

        if (insertError) {
          console.error("Error adding to users table:", insertError.message);
          return;
        }

        console.log("✓ Added existing auth user to users table as super_admin");
      }
      return;
    }

    console.error("Error creating user:", authError.message);
    return;
  }

  if (!authData.user) {
    console.error("No user data returned");
    return;
  }

  console.log("✓ Auth user created");

  // Add to users table
  const { error: insertError } = await supabase.from("users").insert({
    id: authData.user.id,
    email,
    name: "Sam",
    role: "super_admin",
  });

  if (insertError) {
    console.error("Error adding to users table:", insertError.message);
    return;
  }

  console.log("✓ Added to users table as super_admin");
  console.log("\n" + "=".repeat(40));
  console.log("Super-admin user created successfully!");
  console.log("=".repeat(40));
  console.log(`\n  Email: ${email}`);
  console.log("  Password: (as provided)");
  console.log("  Role: super_admin");
  console.log("\nYou can now log in at http://localhost:3000");
}

createAdminUser().catch(console.error);
