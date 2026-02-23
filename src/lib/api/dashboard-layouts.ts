import { createClient } from "@/lib/supabase";
import { DashboardLayout } from "@/lib/dashboard/types";

type OwnerType = "user" | "client";
type DashboardType = "admin" | "portal";

export async function loadDashboardLayout(
  ownerType: OwnerType,
  ownerId: string,
  dashboardType: DashboardType
): Promise<DashboardLayout | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("dashboard_layouts")
    .select("layout")
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("dashboard_type", dashboardType)
    .maybeSingle();

  if (error || !data) return null;
  return data.layout as DashboardLayout;
}

export async function saveDashboardLayout(
  ownerType: OwnerType,
  ownerId: string,
  dashboardType: DashboardType,
  layout: DashboardLayout
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("dashboard_layouts")
    .upsert(
      {
        owner_type: ownerType,
        owner_id: ownerId,
        dashboard_type: dashboardType,
        layout: layout as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_type,owner_id,dashboard_type" }
    );

  if (error) {
    console.error("Failed to save dashboard layout:", error.message);
  }
}

export async function deleteDashboardLayout(
  ownerType: OwnerType,
  ownerId: string,
  dashboardType: DashboardType
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("dashboard_layouts")
    .delete()
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .eq("dashboard_type", dashboardType);

  if (error) {
    console.error("Failed to delete dashboard layout:", error.message);
  }
}
