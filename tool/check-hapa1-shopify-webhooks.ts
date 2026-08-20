import dotenv from 'dotenv'

async function main() {
  dotenv.config({ path: '.env.staging' })

  const pg = await import('pg')
  const { createShopifyClientForIntegration } = await import(
    '../src/lib/api/shopify/tokens.ts'
  )
  const { buildShopifyWebhookUrl } = await import(
    '../src/lib/api/shopify/webhook-url.ts'
  )

  const integrationId = '92b9c8bd-5ef8-4397-8149-630cefb83dd7'
  const db = new pg.default.Client({
    connectionString: process.env.DATABASE_URL!,
    ssl: { rejectUnauthorized: false },
  })
  await db.connect()

  const { rows } = await db.query(
    'SELECT * FROM client_integrations WHERE id = $1',
    [integrationId]
  )
  const integration = rows[0]
  await db.end()

  if (!integration) {
    console.error('Integration not found')
    process.exit(1)
  }

  console.log('Integration:', {
    shop: integration.shop_domain,
    status: integration.status,
    webhooks_registered: integration.webhooks_registered,
    updated_at: integration.updated_at,
    token_expires_at: integration.token_expires_at,
    settings: integration.settings,
  })

  console.log('Expected webhook URL:', buildShopifyWebhookUrl(integrationId))

  try {
    const client = await createShopifyClientForIntegration(integration)
    const { webhooks } = await client.get<{
      webhooks: Array<{
        id: number
        topic: string
        address: string
        created_at: string
      }>
    }>('/webhooks.json')

    console.log('\nShopify registered webhooks:')
    for (const wh of webhooks || []) {
      console.log(`- ${wh.topic}`)
      console.log(`  ${wh.address}`)
    }

    const { orders } = await client.get<{
      orders: Array<{ id: number; name: string; tags: string; created_at: string }>
    }>('/orders.json?status=any&limit=8&order=created_at+desc')

    console.log('\nRecent Shopify orders:')
    for (const o of orders || []) {
      console.log(`- ${o.name} tags="${o.tags}" created=${o.created_at}`)
    }
  } catch (e) {
    console.error('Shopify API error:', e instanceof Error ? e.message : e)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
