/**
 * Spreadsheet Parser Utility
 * Handles CSV/XLSX parsing, column detection, data cleaning, brand matching,
 * and discrepancy detection for inventory imports.
 */

// ---- Types ----

export type ColumnRole =
  | 'brand'
  | 'sku'
  | 'item'
  | 'unit'
  | 'ground_inventory'
  | 'skip'
  | 'informational'

export interface ColumnMap {
  index: number
  header: string
  role: ColumnRole
  /** Original raw header text */
  rawHeader: string
}

export interface ParsedRow {
  rowIndex: number
  brand: string
  sku: string
  item: string
  unit: string
  groundInventory: number
  raw: Record<string, string>
  warnings: string[]
}

export interface BrandSuggestion {
  brand: string
  clientId: string | null
  clientName: string | null
  confidence: 'exact' | 'fuzzy' | 'none'
  /** True when matched via a saved brand alias */
  aliasMatch?: boolean
}

export type DiscrepancyType = 'match' | 'discrepancy' | 'new' | 'missing_from_sheet'

export interface DiscrepancyRow {
  sku: string
  productName: string
  productId: string | null
  sheetQty: number | null
  systemQty: number | null
  difference: number | null
  type: DiscrepancyType
}

export interface CleanResult {
  rows: ParsedRow[]
  warnings: string[]
  stats: {
    totalRawRows: number
    validRows: number
    emptyRows: number
    duplicateSkus: string[]
  }
}

export interface ClientForMatching {
  id: string
  company_name: string
}

export interface BrandAlias {
  alias: string
  client_id: string
}

export interface ExistingInventoryItem {
  product_id: string
  sku: string
  name: string
  qty_on_hand: number
}

// ---- Column Detection ----

const BRAND_PATTERNS = [/^brand$/i]
const SKU_PATTERNS = [/^code$/i, /^sku$/i, /code.*sku/i, /sku.*code/i]
const ITEM_PATTERNS = [/^item$/i, /^product$/i, /^name$/i, /item.*name/i, /product.*name/i]
const UNIT_PATTERNS = [/^unit$/i, /^uom$/i, /unit.*measure/i]
const GROUND_INV_PATTERNS = [/ground.?inventory/i, /ground.?inv/i, /ground.?count/i, /physical.?count/i, /^balance$/i, /balance.?qty/i, /balance.?quantity/i]
const SKIP_PATTERNS = [/balance.?case/i]
const REQUEST_PATTERNS = [/request/i]

export function detectColumns(headers: string[]): ColumnMap[] {
  return headers.map((rawHeader, index) => {
    const header = rawHeader.trim()
    const h = header.toLowerCase()

    let role: ColumnRole = 'informational'

    if (BRAND_PATTERNS.some(p => p.test(h))) {
      role = 'brand'
    } else if (SKU_PATTERNS.some(p => p.test(h))) {
      role = 'sku'
    } else if (ITEM_PATTERNS.some(p => p.test(h))) {
      role = 'item'
    } else if (UNIT_PATTERNS.some(p => p.test(h))) {
      role = 'unit'
    } else if (GROUND_INV_PATTERNS.some(p => p.test(h))) {
      role = 'ground_inventory'
    } else if (SKIP_PATTERNS.some(p => p.test(h))) {
      role = 'skip'
    } else if (REQUEST_PATTERNS.some(p => p.test(h))) {
      role = 'informational'
    }

    return { index, header, role, rawHeader }
  })
}

// ---- Data Cleaning ----

function parseQty(value: string | undefined | null): number {
  if (!value || value.trim() === '') return 0
  // Remove commas and whitespace
  const cleaned = value.replace(/[,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : Math.round(num)
}

function normalizeUnit(unit: string): string {
  const u = unit.trim().toLowerCase()
  if (/^bottle/i.test(u)) return 'Bottle'
  if (/^can/i.test(u)) return 'Can'
  if (/^case/i.test(u)) return 'Case'
  if (/^keg/i.test(u)) return 'Keg'
  if (/^bag/i.test(u)) return 'Bag-in-Box'
  if (/^piece|^each|^ea/i.test(u)) return 'Piece'
  if (/^pack/i.test(u)) return 'Pack'
  if (/^pallet/i.test(u)) return 'Pallet'
  if (/^ml$/i.test(u) || /^\d+\s*ml$/i.test(u)) return 'ML'
  if (/^plastic/i.test(u)) return 'Plastic'
  if (/^box/i.test(u)) return 'Box'
  if (u === '') return 'Piece'
  // Capitalize first letter
  return unit.trim().charAt(0).toUpperCase() + unit.trim().slice(1).toLowerCase()
}

function cleanString(value: string | undefined | null): string {
  if (!value) return ''
  // Remove embedded newlines and excessive whitespace
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function cleanRows(
  rawRows: Record<string, string>[],
  columnMap: ColumnMap[]
): CleanResult {
  const warnings: string[] = []
  const rows: ParsedRow[] = []
  let emptyRows = 0
  const skuCount: Record<string, number[]> = {}

  const brandCol = columnMap.find(c => c.role === 'brand')
  const skuCol = columnMap.find(c => c.role === 'sku')
  const itemCol = columnMap.find(c => c.role === 'item')
  const unitCol = columnMap.find(c => c.role === 'unit')
  const invCol = columnMap.find(c => c.role === 'ground_inventory')

  if (!skuCol) {
    warnings.push('No SKU/Code column detected. Cannot match products.')
  }

  rawRows.forEach((raw, rowIndex) => {
    // Get values by header name
    const getValue = (col: ColumnMap | undefined): string => {
      if (!col) return ''
      return raw[col.rawHeader] ?? raw[col.header] ?? ''
    }

    const sku = cleanString(getValue(skuCol))
    const brand = cleanString(getValue(brandCol))
    const item = cleanString(getValue(itemCol))
    const unit = normalizeUnit(getValue(unitCol))
    const groundInventory = parseQty(getValue(invCol))

    // Skip completely empty rows
    if (!sku && !brand && !item) {
      emptyRows++
      return
    }

    const rowWarnings: string[] = []

    // Flag rows with no SKU
    if (!sku) {
      rowWarnings.push('Missing SKU/Code')
    }

    // Flag rows with no brand
    if (!brand) {
      rowWarnings.push('Missing Brand')
    }

    // Track duplicates
    if (sku) {
      if (!skuCount[sku]) skuCount[sku] = []
      skuCount[sku].push(rowIndex + 2) // +2 for header row + 1-based
    }

    rows.push({
      rowIndex: rowIndex + 2,
      brand,
      sku,
      item,
      unit,
      groundInventory,
      raw,
      warnings: rowWarnings,
    })
  })

  // Detect SKU prefix / brand mismatches
  // Build a map of SKU prefix → most common brand for that prefix
  const prefixBrandCount: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    if (!row.sku || !row.brand) continue
    const prefix = row.sku.split('-')[0].toUpperCase()
    if (!prefixBrandCount[prefix]) prefixBrandCount[prefix] = {}
    prefixBrandCount[prefix][row.brand] = (prefixBrandCount[prefix][row.brand] || 0) + 1
  }
  // For each prefix, find the dominant brand
  const prefixDominantBrand: Record<string, string> = {}
  for (const [prefix, brands] of Object.entries(prefixBrandCount)) {
    const totalRows = Object.values(brands).reduce((a, b) => a + b, 0)
    if (totalRows < 2) continue // need at least 2 rows with this prefix to detect mismatch
    let maxCount = 0
    let dominant = ''
    for (const [brand, count] of Object.entries(brands)) {
      if (count > maxCount) { maxCount = count; dominant = brand }
    }
    if (maxCount > totalRows * 0.5) {
      prefixDominantBrand[prefix] = dominant
    }
  }
  // Flag rows whose brand differs from the dominant brand for their SKU prefix
  for (const row of rows) {
    if (!row.sku || !row.brand) continue
    const prefix = row.sku.split('-')[0].toUpperCase()
    const dominant = prefixDominantBrand[prefix]
    if (dominant && row.brand !== dominant) {
      row.warnings.push(`SKU prefix "${prefix}" typically belongs to "${dominant}" but this row has brand "${row.brand}"`)
      warnings.push(`Row ${row.rowIndex}: SKU "${row.sku}" (prefix ${prefix}) may belong to "${dominant}" instead of "${row.brand}"`)
    }
  }

  // Mark duplicate SKUs
  const duplicateSkus: string[] = []
  for (const [sku, indices] of Object.entries(skuCount)) {
    if (indices.length > 1) {
      duplicateSkus.push(sku)
      warnings.push(
        `Duplicate SKU "${sku}" found on rows ${indices.join(', ')}`
      )
      // Add warning to each affected row
      rows.forEach(row => {
        if (row.sku === sku) {
          row.warnings.push(`Duplicate SKU (appears ${indices.length} times)`)
        }
      })
    }
  }

  return {
    rows,
    warnings,
    stats: {
      totalRawRows: rawRows.length,
      validRows: rows.length,
      emptyRows,
      duplicateSkus,
    },
  }
}

// ---- Brand-to-Client Matching ----

const INTERNAL_BRANDS = [
  '7degrees', '7degree', '7degreesco', '7d',
  'sevendegrees', 'sevendegree',
  'internal', 'warehouse', 'warehousesupplies',
]

export function matchBrands(
  uniqueBrands: string[],
  clients: ClientForMatching[],
  aliases?: BrandAlias[]
): BrandSuggestion[] {
  return uniqueBrands.map(brand => {
    const brandLower = brand.toLowerCase().replace(/[^a-z0-9]/g, '')

    // Check internal brands → warehouse supplies, no client
    if (INTERNAL_BRANDS.some(ib => brandLower.includes(ib))) {
      return {
        brand,
        clientId: null,
        clientName: '7D Warehouse (Internal)',
        confidence: 'exact' as const,
      }
    }

    // Exact match (case-insensitive)
    const exactMatch = clients.find(
      c => c.company_name.toLowerCase() === brand.toLowerCase()
    )
    if (exactMatch) {
      return {
        brand,
        clientId: exactMatch.id,
        clientName: exactMatch.company_name,
        confidence: 'exact' as const,
      }
    }

    // Contains match
    const containsMatch = clients.find(c => {
      const clientLower = c.company_name.toLowerCase()
      return (
        clientLower.includes(brand.toLowerCase()) ||
        brand.toLowerCase().includes(clientLower)
      )
    })
    if (containsMatch) {
      return {
        brand,
        clientId: containsMatch.id,
        clientName: containsMatch.company_name,
        confidence: 'fuzzy' as const,
      }
    }

    // Prefix match (first word)
    const brandFirstWord = brand.toLowerCase().split(/\s+/)[0]
    const prefixMatch = clients.find(c => {
      const clientFirstWord = c.company_name.toLowerCase().split(/\s+/)[0]
      return (
        clientFirstWord === brandFirstWord ||
        c.company_name.toLowerCase().startsWith(brandFirstWord)
      )
    })
    if (prefixMatch) {
      return {
        brand,
        clientId: prefixMatch.id,
        clientName: prefixMatch.company_name,
        confidence: 'fuzzy' as const,
      }
    }

    // Alias match (from previously confirmed brand mappings)
    if (aliases) {
      const aliasMatch = aliases.find(a => a.alias === brand.toLowerCase().trim())
      if (aliasMatch) {
        const client = clients.find(c => c.id === aliasMatch.client_id)
        if (client) {
          return {
            brand,
            clientId: client.id,
            clientName: client.company_name,
            confidence: 'exact' as const,
            aliasMatch: true,
          }
        }
      }
    }

    return {
      brand,
      clientId: null,
      clientName: null,
      confidence: 'none' as const,
    }
  })
}

// ---- Discrepancy Detection ----

export function detectDiscrepancies(
  rows: ParsedRow[],
  existingInventory: ExistingInventoryItem[]
): DiscrepancyRow[] {
  const results: DiscrepancyRow[] = []
  const matchedSkus = new Set<string>()

  // Build lookup by SKU
  const inventoryBySku: Record<string, ExistingInventoryItem> = {}
  for (const inv of existingInventory) {
    inventoryBySku[inv.sku.toLowerCase()] = inv
  }

  // Check each sheet row against system
  for (const row of rows) {
    if (!row.sku) continue

    const skuLower = row.sku.toLowerCase()
    const existing = inventoryBySku[skuLower]

    if (existing) {
      matchedSkus.add(skuLower)
      const diff = row.groundInventory - existing.qty_on_hand

      results.push({
        sku: row.sku,
        productName: existing.name,
        productId: existing.product_id,
        sheetQty: row.groundInventory,
        systemQty: existing.qty_on_hand,
        difference: diff,
        type: diff === 0 ? 'match' : 'discrepancy',
      })
    } else {
      results.push({
        sku: row.sku,
        productName: row.item,
        productId: null,
        sheetQty: row.groundInventory,
        systemQty: null,
        difference: null,
        type: 'new',
      })
    }
  }

  // Find items in system but not in sheet
  for (const inv of existingInventory) {
    if (!matchedSkus.has(inv.sku.toLowerCase())) {
      results.push({
        sku: inv.sku,
        productName: inv.name,
        productId: inv.product_id,
        sheetQty: null,
        systemQty: inv.qty_on_hand,
        difference: null,
        type: 'missing_from_sheet',
      })
    }
  }

  return results
}
