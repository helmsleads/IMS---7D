interface OrderConfirmedParams {
  order: {
    orderNumber: string;
    createdAt: string;
    shipToAddress: string;
    shipToAddress2?: string | null;
    shipToCity: string;
    shipToState: string;
    shipToPostalCode: string;
    shipToCountry: string;
    isRush: boolean;
    notes?: string | null;
  };
  client: {
    companyName: string;
    contactName: string;
  };
  items: {
    productName: string;
    sku: string;
    qtyRequested: number;
  }[];
}

export function orderConfirmedEmail({ order, client, items }: OrderConfirmedParams): {
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

  const totalUnits = items.reduce((sum, item) => sum + item.qtyRequested, 0);

  const itemsHtml = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
            <div style="font-weight: 500; color: #111827;">${item.productName}</div>
            <div style="font-size: 13px; color: #6b7280;">SKU: ${item.sku}</div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 500;">
            ${item.qtyRequested.toLocaleString()}
          </td>
        </tr>
      `
    )
    .join("");

  const addressLine2 = order.shipToAddress2
    ? `<div>${order.shipToAddress2}</div>`
    : "";

  const rushBadge = order.isRush
    ? `<span style="display: inline-block; background-color: #fef3c7; color: #b45309; font-size: 12px; font-weight: 500; padding: 4px 8px; border-radius: 4px; margin-left: 8px;">RUSH ORDER</span>`
    : "";

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: white;">7 Degrees Co</div>
              <div style="font-size: 14px; color: rgba(255,255,255,0.8); margin-top: 4px;">Inventory Management</div>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color: white; padding: 32px;">

              <!-- Success Icon -->
              <div style="text-align: center; margin-bottom: 24px;">
                <div style="display: inline-block; width: 64px; height: 64px; background-color: #d1fae5; border-radius: 50%; line-height: 64px; font-size: 32px;">
                  ✓
                </div>
              </div>

              <!-- Greeting -->
              <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: #111827; text-align: center;">
                Order Confirmed!
              </h1>
              <p style="margin: 0 0 24px 0; color: #6b7280; text-align: center;">
                Hi ${client.contactName}, your shipment request has been received.
              </p>

              <!-- Order Info Box -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                  <div>
                    <div style="font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Order Number</div>
                    <div style="font-size: 20px; font-weight: 600; color: #111827; font-family: monospace;">${order.orderNumber}${rushBadge}</div>
                  </div>
                </div>
                <div style="font-size: 14px; color: #6b7280;">
                  Placed on ${formatDate(order.createdAt)}
                </div>
              </div>

              <!-- Items Table -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Items Requested</h2>
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
                      <td style="padding: 12px; font-weight: 600; color: #111827;">Total Units</td>
                      <td style="padding: 12px; text-align: right; font-weight: 600; color: #111827;">${totalUnits.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Ship To -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Ship To</h2>
                <div style="background-color: #f9fafb; border-radius: 8px; padding: 16px; font-size: 14px; color: #374151;">
                  <div style="font-weight: 500;">${client.companyName}</div>
                  <div>${order.shipToAddress}</div>
                  ${addressLine2}
                  <div>${order.shipToCity}, ${order.shipToState} ${order.shipToPostalCode}</div>
                  <div>${order.shipToCountry}</div>
                </div>
              </div>

              ${order.notes ? `
              <!-- Notes -->
              <div style="margin-bottom: 24px;">
                <h2 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Notes</h2>
                <div style="background-color: #fefce8; border-radius: 8px; padding: 16px; font-size: 14px; color: #713f12;">
                  ${order.notes}
                </div>
              </div>
              ` : ""}

              <!-- Next Steps -->
              <div style="border-top: 1px solid #e5e7eb; padding-top: 24px;">
                <h2 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">What Happens Next?</h2>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td width="32" valign="top" style="padding-bottom: 12px;">
                      <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #2563eb;">1</div>
                    </td>
                    <td style="padding-bottom: 12px; padding-left: 12px;">
                      <div style="font-weight: 500; color: #111827;">Order Processing</div>
                      <div style="font-size: 13px; color: #6b7280;">Our team will pick and pack your items</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="32" valign="top" style="padding-bottom: 12px;">
                      <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #2563eb;">2</div>
                    </td>
                    <td style="padding-bottom: 12px; padding-left: 12px;">
                      <div style="font-weight: 500; color: #111827;">Shipment</div>
                      <div style="font-size: 13px; color: #6b7280;">You'll receive tracking info when shipped</div>
                    </td>
                  </tr>
                  <tr>
                    <td width="32" valign="top">
                      <div style="width: 24px; height: 24px; background-color: #dbeafe; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600; color: #2563eb;">3</div>
                    </td>
                    <td style="padding-left: 12px;">
                      <div style="font-weight: 500; color: #111827;">Delivery</div>
                      <div style="font-size: 13px; color: #6b7280;">Track your package to its destination</div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center; margin-top: 32px;">
                <a href="https://7degrees.co/portal/orders" style="display: inline-block; background-color: #2563eb; color: white; font-weight: 500; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 14px;">
                  View Order Status
                </a>
              </div>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px; border-radius: 0 0 12px 12px; text-align: center; border-top: 1px solid #e5e7eb;">
              <div style="font-size: 14px; color: #6b7280; margin-bottom: 8px;">
                Questions? Contact us at support@7degrees.co
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
    subject: `Your order ${order.orderNumber} is confirmed`,
    html,
  };
}
