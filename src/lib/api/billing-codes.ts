import { createClient } from "@/lib/supabase";

/**
 * Determine the correct billing rate code based on product container type.
 * Rate card: Cases/Bottles use standard unit rates, Barrels use barrel rates.
 */

// Cache product container types to avoid repeated lookups
const containerTypeCache = new Map<string, string>();

export async function getProductContainerType(productId: string): Promise<string> {
  if (containerTypeCache.has(productId)) {
    return containerTypeCache.get(productId)!;
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("container_type")
    .eq("id", productId)
    .single();

  const type = data?.container_type || "bottle";
  containerTypeCache.set(productId, type);
  return type;
}

function isBarrel(containerType: string): boolean {
  return containerType === "keg"; // kegs/barrels use barrel rates
}

export async function getInboundRateCode(productId: string): Promise<string> {
  const type = await getProductContainerType(productId);
  return isBarrel(type) ? "RECEIVE_BARREL" : "RECEIVE_UNIT";
}

export async function getOutboundRateCode(productId: string): Promise<string> {
  const type = await getProductContainerType(productId);
  return isBarrel(type) ? "PICK_BARREL" : "PICK_UNIT";
}
