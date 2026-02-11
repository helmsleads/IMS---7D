/**
 * POST /api/inventory/import/create-client
 * Creates a minimal client record during the import flow.
 * Used when a brand has no matching client and the user wants to create one inline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createServiceClient } from '@/lib/supabase-service'

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
    const body = await request.json()
    const { brandName } = body

    if (!brandName || typeof brandName !== 'string' || brandName.trim().length === 0) {
      return NextResponse.json(
        { error: 'brandName is required' },
        { status: 400 }
      )
    }

    const trimmedName = brandName.trim()

    const serviceClient = createServiceClient()

    // Check if a client with this name already exists
    const { data: existing } = await serviceClient
      .from('clients')
      .select('id, company_name')
      .ilike('company_name', trimmedName)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        id: existing[0].id,
        company_name: existing[0].company_name,
        alreadyExisted: true,
      })
    }

    // Create minimal client record
    const { data: newClient, error } = await serviceClient
      .from('clients')
      .insert({
        company_name: trimmedName,
        active: true,
        industries: ['general_merchandise'],
        allow_product_workflow_override: false,
      })
      .select('id, company_name')
      .single()

    if (error) {
      console.error('Create client error:', error)
      return NextResponse.json(
        { error: 'Failed to create client: ' + error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: newClient.id,
      company_name: newClient.company_name,
      alreadyExisted: false,
    })
  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    )
  }
}
