import { SHOPIFY_ADMIN_API_VERSION } from "@/lib/api/shopify/constants";
import { normalizeShopifyShopDomain } from "@/lib/api/shopify/shop-domain";
import { buildShopifyWebhookUrl } from "@/lib/api/shopify/webhook-url";

const WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/fulfilled",
  "orders/cancelled",
  "inventory_levels/update",
] as const;

/** Register standard 7D inbound webhooks for a Shopify shop. */
export async function registerShopifyWebhooks(
  integrationId: string,
  shop: string,
  accessToken: string,
): Promise<void> {
  const shopDomain = normalizeShopifyShopDomain(shop);
  const webhookUrl = buildShopifyWebhookUrl(integrationId);

  for (const topic of WEBHOOK_TOPICS) {
    try {
      const response = await fetch(
        `https://${shopDomain}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/webhooks.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            webhook: {
              topic,
              address: webhookUrl,
              format: "json",
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to register webhook ${topic}:`, errorText);
      } else {
        console.log(`Registered webhook: ${topic}`);
      }
    } catch (error) {
      console.error(`Error registering webhook ${topic}:`, error);
    }
  }
}
