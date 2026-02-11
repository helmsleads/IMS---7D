/**
 * POST /api/supplies/import/parse
 * Parses a supply spreadsheet (CSV/XLSX) and returns preview data
 * with SKU matching against existing supplies.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

interface ParsedSupplyRow {
  rowIndex: number
  sku: string
  name: string
  quantity: number
  raw: Record<string, string>
  warnings: string[]
  /** Matched supply ID if SKU exists in supplies table */
  existingSupplyId: string | null
  existingSupplyName: string | null
  isNew: boolean
}

// Column detection patterns for supplies
const SKU_PATTERNS = [/^sku$/i, /^code$/i, /code.*sku/i, /sku.*code/i, /^item.?code$/i, /^supply.?code$/i]
const NAME_PATTERNS = [/^name$/i, /^item$/i, /^description$/i, /^supply$/i, /^product$/i, /item.*name/i, /supply.*name/i]
const QTY_PATTERNS = [/^qty$/i, /^quantity$/i, /^count$/i, /^on.?hand$/i, /^stock$/i, /ground.?inv/i, /ground.?count/i]

type ColumnRole = 'sku' | 'name' | 'quantity' | 'skip'

interface ColumnMap {
  index: number
  header: string
  role: ColumnRole
  rawHeader: string
}

function detectColumns(headers: string[]): ColumnMap[] {
  return headers.map((rawHeader, index) => {
    const h = rawHeader.trim().toLowerCase()
    let role: ColumnRole = 'skip'

    if (SKU_PATTERNS.some(p => p.test(h))) {
      role = 'sku'
    } else if (NAME_PATTERNS.some(p => p.test(h))) {
      role = 'name'
    } else if (QTY_PATTERNS.some(p => p.test(h))) {
      role = 'quantity'
    }

    return { index, header: rawHeader.trim(), role, rawHeader }
  })
}

function parseQty(value: string | undefined | null): number {
  if (!value || value.trim() === '') return 0
  const cleaned = value.replace(/[,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round(num)
}

function cleanString(value: string | undefined | null): string {
  if (!value) return ''
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
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

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const locationId = formData.get('locationId') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds maximum size of 5MB' },
        { status: 400 }
      )
    }

    const filename = file.name.toLowerCase()
    const isCSV = filename.endsWith('.csv')
    const isXLSX = filename.endsWith('.xlsx') || filename.endsWith('.xls')

    if (!isCSV && !isXLSX) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a CSV or XLSX file.' },
        { status: 400 }
      )
    }

    // Parse file
    let rawRows: Record<string, string>[] = []
    let headers: string[] = []

    if (isCSV) {
      const text = await file.text()
      const result = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.trim(),
      })

      if (result.errors.length > 0) {
        const parseErrors = result.errors
          .slice(0, 5)
          .map((e) => `Row ${e.row}: ${e.message}`)
        return NextResponse.json(
          { error: 'CSV parsing errors', details: parseErrors },
          { status: 400 }
        )
      }

      rawRows = result.data
      headers = result.meta.fields || []
    } else {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: '',
        raw: false,
      })

      if (jsonData.length === 0) {
        return NextResponse.json(
          { error: 'Spreadsheet appears to be empty' },
          { status: 400 }
        )
      }

      rawRows = jsonData
      headers = Object.keys(jsonData[0] || {})
    }

    if (rawRows.length === 0) {
      return NextResponse.json(
        { error: 'No data rows found in file' },
        { status: 400 }
      )
    }

    // Detect columns
    const columnMap = detectColumns(headers)

    const skuCol = columnMap.find(c => c.role === 'sku')
    const nameCol = columnMap.find(c => c.role === 'name')
    const qtyCol = columnMap.find(c => c.role === 'quantity')

    const warnings: string[] = []
    if (!skuCol) warnings.push('No SKU/Code column detected.')
    if (!qtyCol) warnings.push('No Quantity column detected.')

    // Fetch existing supplies
    const serviceClient = createServiceClient()
    const { data: existingSupplies } = await serviceClient
      .from('supplies')
      .select('id, sku, name')

    const supplyBySku: Record<string, { id: string; sku: string; name: string }> = {}
    for (const s of existingSupplies || []) {
      supplyBySku[s.sku.toLowerCase()] = s
    }

    // Fetch existing supply inventory for the location
    let existingInventoryMap: Record<string, number> = {}
    if (locationId) {
      const { data: invData } = await serviceClient
        .from('supply_inventory')
        .select('supply_id, qty_on_hand')
        .eq('location_id', locationId)

      for (const inv of invData || []) {
        existingInventoryMap[inv.supply_id] = inv.qty_on_hand
      }
    }

    // Process rows
    const rows: ParsedSupplyRow[] = []
    let emptyRows = 0
    const skuCount: Record<string, number[]> = {}

    rawRows.forEach((raw, rowIndex) => {
      const getValue = (col: ColumnMap | undefined): string => {
        if (!col) return ''
        return raw[col.rawHeader] ?? raw[col.header] ?? ''
      }

      const sku = cleanString(getValue(skuCol))
      const name = cleanString(getValue(nameCol))
      const quantity = parseQty(getValue(qtyCol))

      if (!sku && !name) {
        emptyRows++
        return
      }

      const rowWarnings: string[] = []
      if (!sku) rowWarnings.push('Missing SKU')

      // Track duplicates
      if (sku) {
        if (!skuCount[sku]) skuCount[sku] = []
        skuCount[sku].push(rowIndex + 2)
      }

      // Match against existing supplies
      const existing = sku ? supplyBySku[sku.toLowerCase()] : null

      rows.push({
        rowIndex: rowIndex + 2,
        sku,
        name: name || (existing?.name ?? sku),
        quantity,
        raw,
        warnings: rowWarnings,
        existingSupplyId: existing?.id || null,
        existingSupplyName: existing?.name || null,
        isNew: sku ? !existing : false,
      })
    })

    // Mark duplicate SKUs
    const duplicateSkus: string[] = []
    for (const [sku, indices] of Object.entries(skuCount)) {
      if (indices.length > 1) {
        duplicateSkus.push(sku)
        warnings.push(`Duplicate SKU "${sku}" on rows ${indices.join(', ')}`)
        rows.forEach(row => {
          if (row.sku === sku) {
            row.warnings.push(`Duplicate SKU (appears ${indices.length} times)`)
          }
        })
      }
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      fileType: isCSV ? 'csv' : 'xlsx',
      columns: columnMap,
      rows,
      warnings,
      existingInventory: existingInventoryMap,
      stats: {
        totalRows: rawRows.length,
        validRows: rows.length,
        emptyRows,
        matchedSupplies: rows.filter(r => !r.isNew).length,
        newSupplies: rows.filter(r => r.isNew).length,
        duplicateSkus,
      },
    })
  } catch (error) {
    console.error('Supply parse error:', error)
    return NextResponse.json(
      {
        error: 'Failed to parse file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
