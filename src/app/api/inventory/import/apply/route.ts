/**
 * POST /api/inventory/import/apply
 * Receives confirmed/resolved import data and applies changes:
 * - Creates new products
 * - Upserts inventory quantities
 * - Logs activity
 * - Creates spreadsheet_imports audit record
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'

interface ImportRow {
  rowIndex: number
  sku: string
  item: string
  brand: string
  unit: string
  groundInventory: number
  clientId: string | null
  included: boolean
  /** For update imports, the existing product id */
  existingProductId?: string | null
  /** Container type for new products */
  containerType?: string
}

interface ApplyRequest {
  filename: string
  fileType: 'csv' | 'xlsx'
  importType: 'baseline' | 'update'
  locationId: string
  rows: ImportRow[]
  brandClientMap: Record<string, string | null>
  notes?: string
}

export async function POST(request: NextRequest) {
  // Authenticate user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {},
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient()

  try {
    const body: ApplyRequest = await request.json()
    const {
      filename,
      fileType,
      importType,
      locationId,
      rows,
      brandClientMap,
      notes,
    } = body

    if (!locationId) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    if (!rows || rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import' }, { status: 400 })
    }

    const includedRows = rows.filter((r) => r.included)
    if (includedRows.length === 0) {
      return NextResponse.json({ error: 'No rows selected for import' }, { status: 400 })
    }

    // Create import record
    const { data: importRecord, error: importError } = await serviceClient
      .from('spreadsheet_imports')
      .insert({
        filename,
        file_type: fileType,
        import_type: importType,
        status: 'processing',
        total_rows: includedRows.length,
        location_id: locationId,
        imported_by: user.id,
        brand_client_map: brandClientMap,
        notes: notes || null,
      })
      .select('id')
      .single()

    if (importError || !importRecord) {
      console.error('Failed to create import record:', importError)
      return NextResponse.json(
        { error: 'Failed to create import record' },
        { status: 500 }
      )
    }

    const importId = importRecord.id
    let productsCreated = 0
    let productsUpdated = 0
    let inventoryUpdated = 0
    let rowsSkipped = 0
    const errors: Array<{ row: number; sku: string; error: string }> = []
    const discrepancies: Array<{
      sku: string
      name: string
      sheetQty: number
      systemQty: number
      difference: number
    }> = []
    const appliedData: Array<{
      sku: string
      name: string
      action: string
      qty: number
      clientId: string | null
    }> = []

    // Fetch existing products by SKU for matching
    const skus = includedRows.map((r) => r.sku).filter(Boolean)
    const { data: existingProducts } = await serviceClient
      .from('products')
      .select('id, sku, name, client_id')
      .in('sku', skus)

    const productBySku: Record<
      string,
      { id: string; sku: string; name: string; client_id: string | null }
    > = {}
    for (const p of existingProducts || []) {
      productBySku[p.sku.toLowerCase()] = p
    }

    // Fetch existing inventory for this location
    const { data: existingInventory } = await serviceClient
      .from('inventory')
      .select('id, product_id, qty_on_hand')
      .eq('location_id', locationId)

    const inventoryByProductId: Record<
      string,
      { id: string; product_id: string; qty_on_hand: number }
    > = {}
    for (const inv of existingInventory || []) {
      inventoryByProductId[inv.product_id] = inv
    }

    // Process each row
    for (const row of includedRows) {
      try {
        if (!row.sku) {
          rowsSkipped++
          errors.push({
            row: row.rowIndex,
            sku: '',
            error: 'Missing SKU, skipped',
          })
          continue
        }

        const skuLower = row.sku.toLowerCase()
        const clientId = row.clientId || brandClientMap[row.brand] || null
        let productId: string

        // Check if product exists
        const existingProduct = productBySku[skuLower]

        if (existingProduct) {
          productId = existingProduct.id

          // Update product name if changed and this is an update import
          if (importType === 'update' && row.item && row.item !== existingProduct.name) {
            await serviceClient
              .from('products')
              .update({ name: row.item })
              .eq('id', productId)
            productsUpdated++
          }
        } else {
          // Create new product
          const containerType = row.containerType || mapUnitToContainerType(row.unit)
          const unitsPerCase = getDefaultUnitsPerCase(containerType)
          const { data: newProduct, error: productError } = await serviceClient
            .from('products')
            .insert({
              sku: row.sku,
              name: row.item || row.sku,
              client_id: clientId,
              container_type: containerType,
              units_per_case: unitsPerCase,
              unit_cost: 0,
              base_price: 0,
              reorder_point: 0,
              active: true,
            })
            .select('id')
            .single()

          if (productError || !newProduct) {
            errors.push({
              row: row.rowIndex,
              sku: row.sku,
              error: `Failed to create product: ${productError?.message || 'Unknown error'}`,
            })
            rowsSkipped++
            continue
          }

          productId = newProduct.id
          productBySku[skuLower] = {
            id: productId,
            sku: row.sku,
            name: row.item || row.sku,
            client_id: clientId,
          }
          productsCreated++
        }

        // Upsert inventory
        const existingInv = inventoryByProductId[productId]

        if (existingInv) {
          // Track discrepancy if quantities differ
          if (existingInv.qty_on_hand !== row.groundInventory) {
            discrepancies.push({
              sku: row.sku,
              name: row.item || existingProduct?.name || row.sku,
              sheetQty: row.groundInventory,
              systemQty: existingInv.qty_on_hand,
              difference: row.groundInventory - existingInv.qty_on_hand,
            })
          }

          // Update existing inventory
          const { error: updateError } = await serviceClient
            .from('inventory')
            .update({
              qty_on_hand: row.groundInventory,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInv.id)

          if (updateError) {
            errors.push({
              row: row.rowIndex,
              sku: row.sku,
              error: `Failed to update inventory: ${updateError.message}`,
            })
            rowsSkipped++
            continue
          }
        } else {
          // Create new inventory record
          const { data: newInv, error: insertError } = await serviceClient
            .from('inventory')
            .insert({
              product_id: productId,
              location_id: locationId,
              qty_on_hand: row.groundInventory,
              qty_reserved: 0,
              status: 'available',
            })
            .select('id, product_id, qty_on_hand')
            .single()

          if (insertError) {
            errors.push({
              row: row.rowIndex,
              sku: row.sku,
              error: `Failed to create inventory: ${insertError.message}`,
            })
            rowsSkipped++
            continue
          }

          // Add to lookup for potential duplicates in same import
          if (newInv) {
            inventoryByProductId[productId] = newInv
          }
        }

        inventoryUpdated++

        appliedData.push({
          sku: row.sku,
          name: row.item || row.sku,
          action: existingInv ? 'updated' : 'created',
          qty: row.groundInventory,
          clientId,
        })

        // Log activity
        await serviceClient.from('activity_log').insert({
          entity_type: 'inventory',
          entity_id: productId,
          action: importType === 'baseline'
            ? 'spreadsheet_baseline_import'
            : 'spreadsheet_ground_count',
          details: {
            import_id: importId,
            sku: row.sku,
            name: row.item,
            qty_set: row.groundInventory,
            previous_qty: existingInv?.qty_on_hand ?? null,
            client_id: clientId,
          },
          performed_by: user.id,
        })
      } catch (rowError) {
        errors.push({
          row: row.rowIndex,
          sku: row.sku,
          error:
            rowError instanceof Error ? rowError.message : 'Unknown error',
        })
        rowsSkipped++
      }
    }

    // Upsert brand aliases for confirmed brand→client mappings
    for (const [brand, clientId] of Object.entries(brandClientMap)) {
      if (clientId) {
        await serviceClient
          .from('brand_aliases')
          .upsert(
            { alias: brand.toLowerCase().trim(), client_id: clientId },
            { onConflict: 'alias' }
          )
      }
    }

    // Update import record with results
    const finalStatus = errors.length > 0 && inventoryUpdated === 0 ? 'failed' : 'completed'

    await serviceClient
      .from('spreadsheet_imports')
      .update({
        status: finalStatus,
        products_created: productsCreated,
        products_updated: productsUpdated,
        inventory_updated: inventoryUpdated,
        rows_skipped: rowsSkipped,
        discrepancies,
        errors,
        applied_data: appliedData,
        completed_at: new Date().toISOString(),
      })
      .eq('id', importId)

    return NextResponse.json({
      success: true,
      importId,
      status: finalStatus,
      stats: {
        productsCreated,
        productsUpdated,
        inventoryUpdated,
        rowsSkipped,
        errorsCount: errors.length,
        discrepanciesCount: discrepancies.length,
      },
      discrepancies,
      errors,
    })
  } catch (error) {
    console.error('Apply error:', error)
    return NextResponse.json(
      {
        error: 'Failed to apply import',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function mapUnitToContainerType(unit: string): string {
  const u = unit.toLowerCase()
  if (u.includes('bottle')) return 'bottle'
  if (u.includes('can')) return 'can'
  if (u.includes('keg')) return 'keg'
  if (u.includes('bag')) return 'bag_in_box'
  if (u.includes('piece') || u.includes('each')) return 'merchandise'
  if (u === 'ml') return 'sample'
  if (u.includes('box')) return 'gift_box'
  if (u.includes('case')) return 'bottle'
  return 'other'
}

function getDefaultUnitsPerCase(containerType: string): number {
  switch (containerType) {
    case 'bottle': return 6
    case 'can': return 24
    case 'keg': return 1
    case 'empty_bottle': return 6
    default: return 1
  }
}
