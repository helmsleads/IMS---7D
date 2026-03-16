/**
 * One-time script to backfill billing usage records for all past shipped/delivered outbound orders.
 * Run with: node scripts/backfill-outbound-billing.js
 */
const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function backfill() {
  const client = await pool.connect();
  try {
    // Get all shipped/delivered orders that don't already have outbound usage records
    const { rows: orders } = await client.query(`
      SELECT o.id, o.order_number, o.client_id, o.shipped_date, o.created_at
      FROM outbound_orders o
      WHERE o.status IN ('shipped', 'delivered')
        AND o.client_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM usage_records ur
          WHERE ur.reference_type = 'outbound_order'
            AND ur.reference_id::uuid = o.id
            AND ur.usage_type IN ('PICK_UNIT', 'PICK_BARREL')
        )
      ORDER BY o.created_at
    `);

    console.log(`Found ${orders.length} shipped orders without billing records`);

    let totalRecords = 0;

    for (const order of orders) {
      // Get items with product container_type
      const { rows: items } = await client.query(`
        SELECT oi.qty_shipped, oi.qty_requested, p.container_type, p.client_id as product_client_id
        FROM outbound_items oi
        JOIN products p ON p.id = oi.product_id
        WHERE oi.order_id = $1
      `, [order.id]);

      let unitQty = 0;
      let barrelQty = 0;

      for (const item of items) {
        const qty = item.qty_shipped > 0 ? item.qty_shipped : item.qty_requested;
        if (qty <= 0) continue;
        if (item.container_type === 'keg') {
          barrelQty += qty;
        } else {
          unitQty += qty;
        }
      }

      const usageDate = order.shipped_date
        ? order.shipped_date.toISOString().split("T")[0]
        : order.created_at.toISOString().split("T")[0];

      if (unitQty > 0) {
        await client.query(`SELECT record_billable_event($1, 'PICK_UNIT', $2, 'outbound_order', $3, $4::date, $5)`, [
          order.client_id, unitQty, order.id, usageDate,
          `Backfill: Order ${order.order_number} - ${unitQty} cases/bottles`
        ]);
        totalRecords++;
      }

      if (barrelQty > 0) {
        await client.query(`SELECT record_billable_event($1, 'PICK_BARREL', $2, 'outbound_order', $3, $4::date, $5)`, [
          order.client_id, barrelQty, order.id, usageDate,
          `Backfill: Order ${order.order_number} - ${barrelQty} barrels`
        ]);
        totalRecords++;
      }

      if (unitQty > 0 || barrelQty > 0) {
        console.log(`  ${order.order_number}: ${unitQty} units, ${barrelQty} barrels (${usageDate})`);
      }
    }

    console.log(`\nDone! Created ${totalRecords} usage records for ${orders.length} orders.`);
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch(err => {
  console.error("Backfill failed:", err.message);
  pool.end();
  process.exit(1);
});
