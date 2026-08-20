import dotenv from 'dotenv'

async function main() {
  const orderId = process.argv[2]
  const env = process.argv[3] === 'production' ? 'production' : 'staging'
  if (!orderId) {
    console.error('Usage: npx tsx tool/reimport-order.ts <orderId> [staging|production]')
    process.exit(1)
  }

  dotenv.config({
    path: env === 'production' ? '.env.production' : '.env.staging',
  })

  const { previewShopifyOrderLinesForIms, reimportShopifyOrderLineItems } =
    await import('../src/lib/api/shopify/order-sync')

  console.log('preview:', await previewShopifyOrderLinesForIms(orderId))
  console.log('reimport:', await reimportShopifyOrderLineItems(orderId))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
