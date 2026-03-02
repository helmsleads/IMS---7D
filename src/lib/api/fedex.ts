/**
 * FedEx API Client — Server-side only
 *
 * Handles OAuth, shipment creation, and credential management
 * for the FedEx alcohol shipping account.
 */

import { createServiceClient } from '@/lib/supabase-service'
import { decryptToken, encryptToken } from '@/lib/encryption'
import type { FedExCredentials } from '@/types/database'

// ── Base URLs ────────────────────────────────────────────
const FEDEX_URLS = {
  sandbox: 'https://apis-sandbox.fedex.com',
  production: 'https://apis.fedex.com',
} as const

// ── Token cache ──────────────────────────────────────────
let cachedToken: { token: string; expiresAt: number } | null = null

// ── Types ────────────────────────────────────────────────

export interface FedExShipmentRequest {
  orderId: string
  serviceType: string // FEDEX_GROUND, FEDEX_EXPRESS_SAVER, FEDEX_2_DAY, PRIORITY_OVERNIGHT
  packageWeight: number // lbs
  packageLength?: number
  packageWidth?: number
  packageHeight?: number
  isAlcohol: boolean
  shipDate: string // YYYY-MM-DD
  recipient: {
    name: string
    company?: string
    street: string
    street2?: string
    city: string
    state: string
    zip: string
    country: string
    phone: string
  }
}

export interface FedExShipmentResponse {
  trackingNumber: string
  labelPdfBase64: string
  shipmentId: string
}

export interface FedExError {
  code: string
  message: string
}

// ── Credentials ──────────────────────────────────────────

export async function getFedExCredentials(): Promise<FedExCredentials | null> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('category', 'shipping')
    .eq('setting_key', 'fedex_credentials')
    .single()

  if (error || !data) return null

  const creds = data.setting_value as FedExCredentials
  if (!creds?.client_id) return null

  // Decrypt the client secret
  try {
    creds.client_secret = decryptToken(creds.client_secret)
  } catch {
    console.error('Failed to decrypt FedEx client secret')
    return null
  }

  return creds
}

export async function saveFedExCredentials(creds: FedExCredentials): Promise<void> {
  const supabase = createServiceClient()

  // Encrypt the client secret before storing
  const encrypted: FedExCredentials = {
    ...creds,
    client_secret: encryptToken(creds.client_secret),
  }

  const { error } = await supabase
    .from('system_settings')
    .upsert(
      {
        category: 'shipping',
        setting_key: 'fedex_credentials',
        setting_value: encrypted as unknown,
        description: 'FedEx API credentials for alcohol shipping',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'category,setting_key' }
    )

  if (error) throw new Error(`Failed to save FedEx credentials: ${error.message}`)

  // Invalidate token cache on credential change
  cachedToken = null
}

// ── OAuth ────────────────────────────────────────────────

export async function getAccessToken(credentials: FedExCredentials): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const baseUrl = FEDEX_URLS[credentials.environment]

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`FedEx OAuth failed (${response.status}): ${body}`)
  }

  const data = await response.json()
  const token = data.access_token as string
  const expiresIn = (data.expires_in as number) || 3600

  cachedToken = {
    token,
    expiresAt: Date.now() + expiresIn * 1000,
  }

  return token
}

// ── Shipment Creation ────────────────────────────────────

export async function createShipment(
  request: FedExShipmentRequest,
  credentials: FedExCredentials
): Promise<FedExShipmentResponse> {
  const token = await getAccessToken(credentials)
  const baseUrl = FEDEX_URLS[credentials.environment]

  // Build special services
  const specialServices: Record<string, unknown>[] = []
  if (request.isAlcohol) {
    specialServices.push({
      specialServiceTypes: ['ADULT_SIGNATURE_REQUIRED'],
      signatureOptionDetail: {
        signatureOptionType: 'ADULT',
      },
    })
  }

  const body = {
    labelResponseOptions: 'LABEL',
    requestedShipment: {
      shipper: {
        contact: {
          companyName: credentials.shipper_company,
          phoneNumber: credentials.shipper_phone,
        },
        address: {
          streetLines: [credentials.shipper_street],
          city: credentials.shipper_city,
          stateOrProvinceCode: credentials.shipper_state,
          postalCode: credentials.shipper_zip,
          countryCode: credentials.shipper_country || 'US',
        },
      },
      recipients: [
        {
          contact: {
            personName: request.recipient.name,
            companyName: request.recipient.company || undefined,
            phoneNumber: request.recipient.phone,
          },
          address: {
            streetLines: [
              request.recipient.street,
              ...(request.recipient.street2 ? [request.recipient.street2] : []),
            ],
            city: request.recipient.city,
            stateOrProvinceCode: request.recipient.state,
            postalCode: request.recipient.zip,
            countryCode: request.recipient.country || 'US',
          },
        },
      ],
      shipDatestamp: request.shipDate,
      serviceType: request.serviceType,
      packagingType: 'YOUR_PACKAGING',
      pickupType: 'USE_SCHEDULED_PICKUP',
      blockInsightVisibility: false,
      shippingChargesPayment: {
        paymentType: 'SENDER',
      },
      labelSpecification: {
        imageType: 'PDF',
        labelStockType: 'PAPER_4X6',
      },
      requestedPackageLineItems: [
        {
          weight: {
            units: 'LB',
            value: request.packageWeight,
          },
          ...(request.packageLength && request.packageWidth && request.packageHeight
            ? {
                dimensions: {
                  length: request.packageLength,
                  width: request.packageWidth,
                  height: request.packageHeight,
                  units: 'IN',
                },
              }
            : {}),
        },
      ],
      ...(specialServices.length > 0
        ? {
            shipmentSpecialServices: {
              specialServiceTypes: request.isAlcohol ? ['ADULT_SIGNATURE_REQUIRED'] : [],
              ...(request.isAlcohol
                ? {
                    alcoholDetail: {
                      alcoholRecipientType: 'CONSUMER',
                      shipperAgreementType: 'ALC',
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
    accountNumber: {
      value: credentials.account_number,
    },
  }

  const response = await fetch(`${baseUrl}/ship/v1/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] }))
    const errors = errorBody.errors as FedExError[] | undefined
    const msg = errors?.map((e) => e.message).join('; ') || `FedEx API error (${response.status})`
    throw new Error(msg)
  }

  const result = await response.json()

  const shipment = result.output?.transactionShipments?.[0]
  if (!shipment) {
    throw new Error('No shipment data in FedEx response')
  }

  const piece = shipment.pieceResponses?.[0] || shipment.completedShipmentDetail?.completedPackageDetails?.[0]
  const trackingNumber =
    piece?.trackingNumber ||
    shipment.masterTrackingNumber ||
    shipment.completedShipmentDetail?.masterTrackingId?.trackingNumber

  if (!trackingNumber) {
    throw new Error('No tracking number in FedEx response')
  }

  // Extract label PDF (base64 encoded)
  const labelData =
    piece?.packageDocuments?.[0]?.encodedLabel ||
    shipment.completedShipmentDetail?.completedPackageDetails?.[0]?.operationalDetail?.labelData

  return {
    trackingNumber,
    labelPdfBase64: labelData || '',
    shipmentId: shipment.shipDatestamp ? `${trackingNumber}-${shipment.shipDatestamp}` : trackingNumber,
  }
}
