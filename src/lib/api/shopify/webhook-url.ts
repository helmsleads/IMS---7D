/**
 * Shopify cannot send Vercel auth cookies. When Deployment Protection is on,
 * register webhook URLs with Vercel's automation bypass query param so POSTs
 * reach the app.
 *
 * @see https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
 */
export function buildShopifyWebhookUrl(integrationId: string): string {
  const appUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).replace(/\/$/, "");

  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL (or APP_URL) is required to register Shopify webhooks");
  }

  const url = new URL(`${appUrl}/api/webhooks/shopify/${integrationId}`);
  const bypass =
    process.env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ||
    process.env.SHOPIFY_WEBHOOK_VERCEL_BYPASS?.trim() ||
    "";

  if (bypass) {
    url.searchParams.set("x-vercel-protection-bypass", bypass);
  }

  return url.toString();
}
