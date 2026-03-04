import { createClient } from "@/lib/supabase";
import { sendPortalOrderNotification } from "@/lib/api/notifications";

export interface DockCapacity {
  maxPerSlot: number;
  amStart: string;
  amEnd: string;
  pmStart: string;
  pmEnd: string;
}

export interface SlotAvailability {
  booked: number;
  max: number;
  available: number;
}

export interface DayAvailability {
  date: string;
  am: { booked: number; max: number };
  pm: { booked: number; max: number };
}

export async function getDockCapacity(): Promise<DockCapacity> {
  const supabase = createClient();

  const { data } = await supabase
    .from("system_settings")
    .select("setting_key, setting_value")
    .eq("category", "dock");

  const settings: Record<string, string> = {};
  (data || []).forEach((s: { setting_key: string; setting_value: string }) => {
    settings[s.setting_key] = s.setting_value;
  });

  return {
    maxPerSlot: parseInt(settings.max_appointments_per_slot || "3", 10),
    amStart: settings.dock_hours_am_start || "08:00",
    amEnd: settings.dock_hours_am_end || "12:00",
    pmStart: settings.dock_hours_pm_start || "12:00",
    pmEnd: settings.dock_hours_pm_end || "17:00",
  };
}

export async function getMonthAvailability(
  year: number,
  month: number
): Promise<DayAvailability[]> {
  const supabase = createClient();
  const capacity = await getDockCapacity();

  // Build date range for the month
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data } = await supabase
    .from("inbound_orders")
    .select("expected_date, preferred_time_slot")
    .gte("expected_date", startDate)
    .lte("expected_date", endDate)
    .not("appointment_status", "eq", "rejected");

  // Group by date + slot
  const counts: Record<string, { am: number; pm: number }> = {};
  (data || []).forEach((order: { expected_date: string | null; preferred_time_slot: string | null }) => {
    if (!order.expected_date) return;
    if (!counts[order.expected_date]) {
      counts[order.expected_date] = { am: 0, pm: 0 };
    }
    const slot = order.preferred_time_slot === "pm" ? "pm" : "am";
    counts[order.expected_date][slot]++;
  });

  // Build result for every day in the month
  const result: DayAvailability[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayCounts = counts[dateStr] || { am: 0, pm: 0 };
    result.push({
      date: dateStr,
      am: { booked: dayCounts.am, max: capacity.maxPerSlot },
      pm: { booked: dayCounts.pm, max: capacity.maxPerSlot },
    });
  }

  return result;
}

export async function getSlotAvailability(
  date: string
): Promise<{ am: SlotAvailability; pm: SlotAvailability }> {
  const supabase = createClient();
  const capacity = await getDockCapacity();

  const { data } = await supabase
    .from("inbound_orders")
    .select("preferred_time_slot")
    .eq("expected_date", date)
    .not("appointment_status", "eq", "rejected");

  let amBooked = 0;
  let pmBooked = 0;
  (data || []).forEach((order: { preferred_time_slot: string | null }) => {
    if (order.preferred_time_slot === "pm") pmBooked++;
    else amBooked++;
  });

  return {
    am: {
      booked: amBooked,
      max: capacity.maxPerSlot,
      available: Math.max(0, capacity.maxPerSlot - amBooked),
    },
    pm: {
      booked: pmBooked,
      max: capacity.maxPerSlot,
      available: Math.max(0, capacity.maxPerSlot - pmBooked),
    },
  };
}

export async function approveAppointment(orderId: string): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("inbound_orders")
    .update({
      appointment_status: "approved",
      appointment_approved_by: user?.id || null,
      appointment_approved_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_order",
    entity_id: orderId,
    action: "appointment_approved",
    user_id: user?.id || null,
    details: {},
  });

  // Send portal notification
  const { data: order } = await supabase
    .from("inbound_orders")
    .select("client_id, po_number")
    .eq("id", orderId)
    .single();

  if (order?.client_id) {
    sendPortalOrderNotification({
      clientId: order.client_id,
      orderNumber: order.po_number,
      status: "appointment_approved",
    }).catch((err) => console.error("Failed to send appointment notification:", err));
  }
}

export async function rejectAppointment(
  orderId: string,
  reason: string
): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from("inbound_orders")
    .update({
      appointment_status: "rejected",
      appointment_rejection_reason: reason,
    })
    .eq("id", orderId);

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.from("activity_log").insert({
    entity_type: "inbound_order",
    entity_id: orderId,
    action: "appointment_rejected",
    user_id: user?.id || null,
    details: { reason },
  });

  // Send portal notification
  const { data: order } = await supabase
    .from("inbound_orders")
    .select("client_id, po_number")
    .eq("id", orderId)
    .single();

  if (order?.client_id) {
    sendPortalOrderNotification({
      clientId: order.client_id,
      orderNumber: order.po_number,
      status: "appointment_rejected",
      details: `Reason: ${reason}`,
    }).catch((err) => console.error("Failed to send appointment notification:", err));
  }
}

export async function getPendingAppointmentCount(): Promise<number> {
  const supabase = createClient();

  const { count, error } = await supabase
    .from("inbound_orders")
    .select("id", { count: "exact", head: true })
    .eq("appointment_status", "pending_approval");

  if (error) throw new Error(error.message);
  return count || 0;
}
