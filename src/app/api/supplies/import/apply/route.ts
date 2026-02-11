/**
 * POST /api/supplies/import/apply
 * Applies supply import: creates new supplies and upserts supply_inventory quantities.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'

interface SupplyImportRow {
  rowIndex: number
  sku: string
  name: string
  quantity: number
  existingSupplyId: string | null
  included: boolean
  isNew: boolean
  /** Category for new supplies */
  category?: string
}

interface ApplyRequest {
  filename: string
  fileType: 'csv' | 'xlsx'
  locationId: string
  rows: SupplyImportRow[]
}

export async function POST(request: NextRequest) {
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
    const { locationId, rows } = body

    if (!locationId) {
      return NextResponse.json({ error: 'Location is required' }, { status: 400 })
    }

    const includedRows = rows.filter((r) => r.included)
    if (includedRows.length === 0) {
      return NextResponse.json({ error: 'No rows selected for import' }, { status: 400 })
    }

    let suppliesCreated = 0
    let inventoryUpdated = 0
    let rowsSkipped = 0
    const errors: Array<{ row: number; sku: string; error: string }> = []

    // Fetch existing supply inventory for this location
    const { data: existingInventory } = await serviceClient
      .from('supply_inventory')
      .select('id, supply_id, qty_on_hand')
      .eq('location_id', locationId)

    const inventoryBySupplyId: Record<string, { id: string; qty_on_hand: number }> = {}
    for (const inv of existingInventory || []) {
      inventoryBySupplyId[inv.supply_id] = { id: inv.id, qty_on_hand: inv.qty_on_hand }
    }

    for (const row of includedRows) {
      try {
        if (!row.sku) {
          rowsSkipped++
          errors.push({ row: row.rowIndex, sku: '', error: 'Missing SKU, skipped' })
          continue
        }

        let supplyId = row.existingSupplyId

        // Create new supply if needed
        if (!supplyId && row.isNew) {
          const { data: newSupply, error: supplyError } = await serviceClient
            .from('supplies')
            .insert({
              sku: row.sku,
              name: row.name || row.sku,
              category: row.category || 'other',
              base_price: 0,
              cost: 0,
              unit: 'each',
              is_standard: false,
              is_active: true,
              sort_order: 0,
              industries: [],
            })
            .select('id')
            .single()

          if (supplyError || !newSupply) {
            errors.push({
              row: row.rowIndex,
              sku: row.sku,
              error: `Failed to create supply: ${supplyError?.message || 'Unknown error'}`,
            })
            rowsSkipped++
            continue
          }

          supplyId = newSupply.id
          suppliesCreated++
        }

        if (!supplyId) {
          errors.push({ row: row.rowIndex, sku: row.sku, error: 'No matching supply found' })
          rowsSkipped++
          continue
        }

        // Upsert supply inventory
        const existingInv = inventoryBySupplyId[supplyId]

        if (existingInv) {
          const { error: updateError } = await serviceClient
            .from('supply_inventory')
            .update({
              qty_on_hand: row.quantity,
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
          const { data: newInv, error: insertError } = await serviceClient
            .from('supply_inventory')
            .insert({
              supply_id: supplyId,
              location_id: locationId,
              qty_on_hand: row.quantity,
              reorder_point: 0,
            })
            .select('id, supply_id, qty_on_hand')
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

          if (newInv) {
            inventoryBySupplyId[supplyId] = { id: newInv.id, qty_on_hand: newInv.qty_on_hand }
          }
        }

        inventoryUpdated++
      } catch (rowError) {
        errors.push({
          row: row.rowIndex,
          sku: row.sku,
          error: rowError instanceof Error ? rowError.message : 'Unknown error',
        })
        rowsSkipped++
      }
    }

    return NextResponse.json({
      success: true,
      stats: {
        suppliesCreated,
        inventoryUpdated,
        rowsSkipped,
        errorsCount: errors.length,
      },
      errors,
    })
  } catch (error) {
    console.error('Supply apply error:', error)
    return NextResponse.json(
      {
        error: 'Failed to apply supply import',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
