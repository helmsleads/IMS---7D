const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const currencyFormatterNoDecimals = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number, decimals?: number): string {
  if (decimals === 0) return currencyFormatterNoDecimals.format(value);
  if (decimals !== undefined) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  }
  return currencyFormatter.format(value);
}

export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  }).format(value);
}

/** Orders marked [test] (Shopify tag) or [test:portal] (7D client portal). */
export function isTestOutboundOrder(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return /\[test(:portal)?\]/i.test(notes);
}

/** Shopify 7D-tagged orders that still need product matching in 7D. */
export function isNeedsMappingOutboundOrder(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return (
    /\[needs mapping\]/i.test(notes) ||
    /item\(s\) could not be mapped/i.test(notes) ||
    /item\(s\) not matching IMS/i.test(notes)
  );
}

export function isShopifyConnectionError(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false
  const lower = raw.toLowerCase()
  return (
    lower.includes('shopify_client_not_connected') ||
    lower.includes('disconnected') ||
    lower.includes('missing access token') ||
    lower.includes('not connected') ||
    lower.includes('shop domain')
  )
}

/** User-facing copy for Shopify line import errors (hides internal API details). */
export function formatShopifyImportError(
  raw: string | null | undefined,
  options?: { audience?: 'admin' | 'portal' }
): string | null {
  if (!raw?.trim()) return null

  const audience = options?.audience ?? 'portal'

  if (isShopifyConnectionError(raw)) {
    return audience === 'admin'
      ? "This client's Shopify store is not connected. View the client record to check the store connection."
      : 'Shopify is not connected. Reconnect your store under Integrations, then try again.'
  }

  const lower = raw.toLowerCase()

  if (lower.includes('no importable') || lower.includes('no shippable')) {
    return 'No shippable items were found on this order in Shopify.'
  }

  if (lower.includes('shopify order not found') || lower.includes('not found in shopify')) {
    return 'This order could not be found in Shopify. Confirm the correct store is connected.'
  }

  if (lower.includes('migration required')) {
    return 'Import is temporarily unavailable. Please contact support.'
  }

  if (
    lower.includes('client_id') ||
    lower.includes('access token') ||
    lower.includes('integration linked') ||
    lower.includes('oauth')
  ) {
    return audience === 'admin'
      ? "Unable to import from Shopify. Check the client's store connection and try again."
      : 'Unable to import from Shopify. Reconnect your store under Integrations and try again.'
  }

  return raw
}

export function formatDate(
  dateString: string | null | undefined,
  format: "short" | "long" | "relative" = "short"
): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid date";

  if (format === "relative") return formatRelativeTime(dateString);

  if (format === "long") {
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
