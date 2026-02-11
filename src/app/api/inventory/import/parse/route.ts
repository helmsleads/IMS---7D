/**
 * POST /api/inventory/import/parse
 * Receives a spreadsheet file via FormData, parses it, and returns
 * preview data including column mapping, cleaned rows, brand suggestions,
 * and discrepancy detection (for update imports).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  detectColumns,
  cleanRows,
  matchBrands,
  detectDiscrepancies,
  type ColumnMap,
  type ParsedRow,
  type BrandSuggestion,
  type BrandAlias,
  type DiscrepancyRow,
} from '@/lib/utils/spreadsheet-parser'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

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

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const importType = formData.get('importType') as string | null
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

    // Determine file type
    const filename = file.name.toLowerCase()
    const isCSV = filename.endsWith('.csv')
    const isXLSX = filename.endsWith('.xlsx') || filename.endsWith('.xls')

    if (!isCSV && !isXLSX) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a CSV or XLSX file.' },
        { status: 400 }
      )
    }

    // Parse file to raw rows
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
      // XLSX
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]

      // Convert to JSON with headers
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
    const columnMap: ColumnMap[] = detectColumns(headers)

    // Clean rows
    const cleanResult = cleanRows(rawRows, columnMap)

    // Fetch clients and brand aliases for brand matching
    const serviceClient = createServiceClient()
    const [{ data: clients }, { data: aliasRows }] = await Promise.all([
      serviceClient
        .from('clients')
        .select('id, company_name, industries')
        .eq('active', true)
        .order('company_name'),
      serviceClient
        .from('brand_aliases')
        .select('id, alias, client_id'),
    ])

    const aliases: BrandAlias[] = (aliasRows || []).map((a: { id: string; alias: string; client_id: string }) => ({
      alias: a.alias,
      client_id: a.client_id,
    }))

    // Build alias ID lookup for client-side deletion
    const aliasIdMap: Record<string, string> = {}
    for (const a of aliasRows || []) {
      const row = a as { id: string; alias: string }
      aliasIdMap[row.alias] = row.id
    }

    // Match brands
    const uniqueBrands = [
      ...new Set(cleanResult.rows.map((r) => r.brand).filter(Boolean)),
    ]
    const brandSuggestions: BrandSuggestion[] = matchBrands(
      uniqueBrands,
      clients || [],
      aliases
    )

    // Fetch existing product SKUs and supply SKUs in parallel
    const [{ data: existingProducts }, { data: existingSupplies }] = await Promise.all([
      serviceClient.from('products').select('id, sku'),
      serviceClient.from('supplies').select('sku, name').eq('is_active', true),
    ])

    const existingSkuSet = new Set(
      (existingProducts || []).map((p: { sku: string }) => p.sku.toLowerCase())
    )

    // Build SKU → product ID map for client-side deletion
    const skuProductIdMap: Record<string, string> = {}
    for (const p of existingProducts || []) {
      const prod = p as { id: string; sku: string }
      skuProductIdMap[prod.sku.toLowerCase()] = prod.id
    }

    // Build supply SKU lookup
    const supplySkuMap: Record<string, string> = {}
    for (const s of existingSupplies || []) {
      const supply = s as { sku: string; name: string }
      supplySkuMap[supply.sku.toLowerCase()] = supply.name
    }

    // Tag each row with isNewSku and isSupply
    const rowsWithNewFlag = cleanResult.rows.map((row) => ({
      ...row,
      isNewSku: row.sku ? !existingSkuSet.has(row.sku.toLowerCase()) : false,
      isSupply: row.sku ? row.sku.toLowerCase() in supplySkuMap : false,
      supplyName: row.sku ? supplySkuMap[row.sku.toLowerCase()] || null : null,
    }))

    // Discrepancy detection for update imports
    let discrepancies: DiscrepancyRow[] = []
    if (importType === 'update' && locationId) {
      // Fetch existing inventory for comparison
      const { data: existingInventory } = await serviceClient
        .from('inventory')
        .select(`
          product_id,
          qty_on_hand,
          product:products!inner(id, sku, name)
        `)
        .eq('location_id', locationId)

      if (existingInventory) {
        const formattedInventory = existingInventory.map((inv: Record<string, unknown>) => {
          const product = inv.product as { id: string; sku: string; name: string }
          return {
            product_id: product.id,
            sku: product.sku,
            name: product.name,
            qty_on_hand: inv.qty_on_hand as number,
          }
        })
        discrepancies = detectDiscrepancies(cleanResult.rows, formattedInventory)
      }
    }

    // Build stats
    const stats = {
      totalRows: cleanResult.stats.totalRawRows,
      validRows: cleanResult.stats.validRows,
      emptyRows: cleanResult.stats.emptyRows,
      duplicateSkus: cleanResult.stats.duplicateSkus,
      uniqueBrands: uniqueBrands.length,
      matchedBrands: brandSuggestions.filter((b) => b.confidence !== 'none').length,
      unmatchedBrands: brandSuggestions.filter((b) => b.confidence === 'none').length,
    }

    // For update imports, add discrepancy stats
    const discrepancyStats =
      importType === 'update'
        ? {
            matches: discrepancies.filter((d) => d.type === 'match').length,
            discrepancies: discrepancies.filter((d) => d.type === 'discrepancy').length,
            newSkus: discrepancies.filter((d) => d.type === 'new').length,
            missingFromSheet: discrepancies.filter((d) => d.type === 'missing_from_sheet').length,
          }
        : null

    return NextResponse.json({
      success: true,
      filename: file.name,
      fileType: isCSV ? 'csv' : 'xlsx',
      columns: columnMap,
      rows: rowsWithNewFlag,
      brandSuggestions,
      aliasIdMap,
      skuProductIdMap,
      supplySkuMap,
      discrepancies,
      warnings: cleanResult.warnings,
      stats: {
        ...stats,
        newSkus: rowsWithNewFlag.filter((r) => r.isNewSku).length,
        supplyRows: rowsWithNewFlag.filter((r) => r.isSupply).length,
      },
      discrepancyStats,
      clients: (clients || []).map((c: { id: string; company_name: string; industries: string[] }) => ({
        id: c.id,
        company_name: c.company_name,
        industries: c.industries || [],
      })),
    })
  } catch (error) {
    console.error('Parse error:', error)
    return NextResponse.json(
      {
        error: 'Failed to parse file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
