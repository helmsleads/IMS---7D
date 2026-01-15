interface OrderShippedParams {
  order: {
    orderNumber: string;
    shippedAt: string;
    carrier: string;
    trackingNumber: string;
    shipToAddress: string;
    shipToAddress2?: string | null;
    shipToCity: string;
    shipToState: string;
    shipToPostalCode: string;
    shipToCountry: string;
  };
  client: {
    companyName: string;
    contactName: string;
  };
  items: {
    productName: string;
    sku: string;
    qtyShipped: number;
  }[];
}

const CARRIER_TRACKING_URLS: Record<string, string> = {
  ups: "https://www.ups.com/track?tracknum=",
  fedex: "https://www.fedex.com/fedextrack/?trknbr=",
  usps: "https://tools.usps.com/go/TrackConfirmAction?tLabels=",
  dhl: "https://www.dhl.com/en/express/tracking.html?AWB=",
};

function getTrackingUrl(carrier: string, trackingNumber: string): string {
  const carrierKey = carrier.toLowerCase().replace(/[^a-z]/g, "");
  const baseUrl = CARRIER_TRACKING_URLS[carrierKey];

  if (baseUrl) {
    return `${baseUrl}${trackingNumber}`;
  }

  // Fallback: Google search for tracking
  return `https://www.google.com/search?q=${encodeURIComponent(`${carrier} tracking ${trackingNumber}`)}`;
}

export function orderShippedEmail({ order, client, items }: OrderShippedParams): {
  subject: string;
  html: string;
} {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const totalUnits = items.reduce((sum, item) => sum + item.qtyShipped, 0);
  const trackingUrl = getTrackingUrl(order.carrier, order.trackingNumber);

  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 500; color: #111827;">${item.productName}</div>
            <div style="font-size: 13px; color: #6b7280;">SKU: ${item.sku}</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
            ${item.qtyShipped.toLocaleString()}
          </td>
        </tr>
      `
    )
    .join("");

  const addressLine2 = order.shipToAddress2
    ? `<div>${order.shipToAddress2}</div>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Shipped</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: white;">7 Degrees Co</div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px;">Inventory Management</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 32px;">

              <!-- Truck Icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #cffafe; border-radius: 50%; line-height: 64px; font-size: 32px;">
                  🚚
                </div>
              </div>

              <!-- Greeting -->
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                Your Order Has Shipped!
              </h1>
              <p style="margin: 0 0 24px 0; color: #6b7280; text-align: center;">
                Great news, ${client.contactName}! Your order is on its way.
              </p>

              <!-- Tracking Box - Prominent -->
              <div style="background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                <div style="font-size: 13px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Tracking Number</div>
                <div style="font-size: 20px; font-weight: 600; color: white; font-family: monospace; margin-bottom: 16px;">${order.trackingNumber}</div>
                <div style="font-size: 14px; color: rgba(255,255,255,0.9); margin-bottom: 16px;">
                  via ${order.carrier}
                </div>
                <a href="${trackingUrl}" style="display: inline-block; background-color: white; color: #0891b2; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px;">
                  Track Your Package →
                </a>
              </div>

              <!-- Order Info -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="50%" style="vertical-align: top;">
                      <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
                      <div style="font-size: 16px; font-weight: 600; color: #111827; font-family: monospace; margin-top: 4px;">${order.orderNumber}</div>
                    </td>
                    <td width="50%" style="vertical-align: top;">
                      <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Shipped On</div>
                      <div style="font-size: 16px; font-weight: 500; color: #111827; margin-top: 4px;">${formatDate(order.shippedAt)}</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- Ship To -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Shipping To</h2>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; font-size: 14px; color: #374151;">
                  <div style="font-weight: 500;">${client.companyName}</div>
                  <div>${order.shipToAddress}</div>
                  ${addressLine2}
                  <div>${order.shipToCity}, ${order.shipToState} ${order.shipToPostalCode}</div>
                  <div>${order.shipToCountry}</div>
                </div>
              </div>

              <!-- Items Table -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Items Shipped</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #f9fafb;">
                      <th style="padding: 12px; text-align: left; font-size: 13px; font-weight: 500; color: #6b7280; text-transform: uppercase;">Product</th>
                      <th style="padding: 12px; text-align: right; font-size: 13px; font-weight: 500; color: #6b7280; text-transform: uppercase;">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itemsHtml}
                  </tbody>
                  <tfoot>
                    <tr style="background-color: #f9fafb;">
                      <td style="padding: 12px; font-weight: 600; color: #111827;">Total Units Shipped</td>
                      <td style="padding: 12px; text-align: right; font-weight: 600; color: #111827;">${totalUnits.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Delivery Tips -->
              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background-color: #fefce8;">
                <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #713f12;">📦 Delivery Tips</h3>
                <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; color: #854d0e;">
                  <li style="margin-bottom: 8px;">Tracking updates may take 24 hours to appear</li>
                  <li style="margin-bottom: 8px;">Ensure someone is available to receive the shipment</li>
                  <li>Contact ${order.carrier} directly for delivery changes</li>
                </ul>
              </div>

              <!-- Secondary CTA -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://7degrees.co/portal/orders" style="display: inline-block; background-color: #f3f4f6; color: #374151; font-weight: 500; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px; border: 1px solid #e5e7eb;">
                  View All Orders
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
                Questions about your shipment? Contact us at support@7degrees.co
              </div>
              <div style="font-size: 12px; color: #9ca3af;">
                © ${new Date().getFullYear()} 7 Degrees Co. All rights reserved.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return {
    subject: `Your order ${order.orderNumber} has shipped!`,
    html,
  };
}
