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

function clearTokenCache() {
  cachedToken = null
}

async function fedexFetch(
  url: string,
  init: RequestInit,
  credentials: FedExCredentials
): Promise<Response> {
  // Always use latest token (may be cached)
  const token = await getAccessToken(credentials)
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(url, { ...init, headers })

  // If token expired/revoked, clear cache and retry once
  if (res.status === 401) {
    clearTokenCache()
    const retryToken = await getAccessToken(credentials)
    const retryHeaders = new Headers(init.headers || {})
    retryHeaders.set('Authorization', `Bearer ${retryToken}`)
    return fetch(url, { ...init, headers: retryHeaders })
  }

  return res
}

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
  actualCost?: number
  listCost?: number
}

export interface FedExError {
  code: string
  message: string
}

export interface FedExRateOption {
  serviceType: string
  serviceName: string
  accountRate?: number
  listRate?: number
  deliveryDate?: string
}

export interface FedExRatesResponse {
  options: FedExRateOption[]
}

export interface FedExTrackEvent {
  statusCode: string
  statusDescription: string
  timestamp?: string
  city?: string
  state?: string
  country?: string
}

export interface FedExTrackResponse {
  trackingNumber: string
  statusCode: string
  statusDescription: string
  events: FedExTrackEvent[]
  estimatedDelivery?: string
  actualDelivery?: string
}

// ── Credentials ──────────────────────────────────────────

export async function getFedExCredentials(): Promise<FedExCredentials | null> {
  // First, try to read from system_settings (primary source)
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('category', 'shipping')
    .eq('setting_key', 'fedex_credentials')
    .single()

  if (!error && data?.setting_value) {
    const creds = data.setting_value as FedExCredentials
    if (!creds?.client_id) return null

    // Decrypt the client secret
    try {
      creds.client_secret = decryptToken(creds.client_secret)
    } catch {
      console.error('Failed to decrypt FedEx client secret')
      return null
    }

    // Optional override: force sandbox in local/dev environments
    // (useful when credentials are set to production in DB by mistake)
    if (process.env.FEDEX_SANDBOX === 'true') {
      creds.environment = 'sandbox'
    }

    return creds
  }

  // Fallback: allow configuring FedEx via environment for simple setups
  const envClientId = process.env.FEDEX_CLIENT_ID
  const envClientSecret = process.env.FEDEX_CLIENT_SECRET
  const envAccountNumber = process.env.FEDEX_ACCOUNT_NUMBER

  if (envClientId && envClientSecret && envAccountNumber) {
    const environment = (process.env.FEDEX_ENVIRONMENT === 'production' ? 'production' : 'sandbox') as
      | 'sandbox'
      | 'production'

    const shipperCompany = process.env.FEDEX_SHIPPER_COMPANY || 'Warehouse'
    const shipperStreet = process.env.FEDEX_SHIPPER_STREET || ''
    const shipperCity = process.env.FEDEX_SHIPPER_CITY || ''
    const shipperState = process.env.FEDEX_SHIPPER_STATE || ''
    const shipperZip = process.env.FEDEX_SHIPPER_ZIP || ''
    const shipperCountry = process.env.FEDEX_SHIPPER_COUNTRY || 'US'
    const shipperPhone = process.env.FEDEX_SHIPPER_PHONE || ''

    const creds: FedExCredentials = {
      client_id: envClientId,
      client_secret: envClientSecret,
      account_number: envAccountNumber,
      environment,
      shipper_company: shipperCompany,
      shipper_street: shipperStreet,
      shipper_city: shipperCity,
      shipper_state: shipperState,
      shipper_zip: shipperZip,
      shipper_country: shipperCountry,
      shipper_phone: shipperPhone,
    }

    return creds
  }

  return null
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
  clearTokenCache()
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

  const response = await fedexFetch(`${baseUrl}/ship/v1/shipments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    body: JSON.stringify(body),
  }, credentials)

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

  // Extract shipping rates (ACCOUNT = discounted, LIST = retail)
  let actualCost: number | undefined
  let listCost: number | undefined
  const rateDetails =
    shipment.completedShipmentDetail?.shipmentRating?.shipmentRateDetails as
      | { rateType: string; totalNetCharge: number }[]
      | undefined
  if (Array.isArray(rateDetails)) {
    for (const rate of rateDetails) {
      if (rate.rateType === 'ACCOUNT' || rate.rateType === 'PREFERRED_ACCOUNT') {
        actualCost = rate.totalNetCharge
      } else if (rate.rateType === 'LIST' || rate.rateType === 'PREFERRED_LIST') {
        listCost = rate.totalNetCharge
      }
    }
  }

  return {
    trackingNumber,
    labelPdfBase64: labelData || '',
    shipmentId: shipment.shipDatestamp ? `${trackingNumber}-${shipment.shipDatestamp}` : trackingNumber,
    actualCost,
    listCost,
  }
}

// ── Rates API ──────────────────────────────────────────────

export async function getRates(
  params: {
    shipDate: string
    serviceTypes?: string[]
    weightLbs: number
    shipperPostalCode: string
    shipperCountryCode: string
    recipientPostalCode: string
    recipientCountryCode: string
  },
  credentials: FedExCredentials
): Promise<FedExRatesResponse> {
  const baseUrl = FEDEX_URLS[credentials.environment]

  const body = {
    rateRequestControlParameters: {
      returnTransitTimes: true,
      rateSortOrder: 'SERVICENAMETRADITIONAL',
    },
    accountNumber: {
      value: credentials.account_number,
    },
    requestedShipment: {
      rateRequestType: ['LIST', 'ACCOUNT'],
      shipper: {
        address: {
          postalCode: params.shipperPostalCode,
          countryCode: params.shipperCountryCode,
        },
      },
      recipient: {
        address: {
          postalCode: params.recipientPostalCode,
          countryCode: params.recipientCountryCode,
        },
      },
      preferredCurrency: 'USD',
      shipDatestamp: params.shipDate,
      pickupType: 'USE_SCHEDULED_PICKUP',
      requestedPackageLineItems: [
        {
          weight: {
            units: 'LB',
            value: params.weightLbs,
          },
        },
      ],
      ...(params.serviceTypes && params.serviceTypes.length > 0
        ? { serviceType: params.serviceTypes[0] }
        : {}),
    },
  }

  const response = await fedexFetch(`${baseUrl}/rate/v1/rates/quotes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, credentials)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] }))
    const errors = errorBody.errors as FedExError[] | undefined
    const msg = errors?.map((e) => e.message).join('; ') || `FedEx Rates API error (${response.status})`
    throw new Error(msg)
  }

  const data = await response.json()
  const options: FedExRateOption[] = []

  const rateReplyDetails = data.output?.rateReplyDetails as any[] | undefined
  if (Array.isArray(rateReplyDetails)) {
    for (const detail of rateReplyDetails) {
      const serviceType: string = detail.serviceType
      const serviceName: string = detail.serviceName || serviceType

      let accountRate: number | undefined
      let listRate: number | undefined

      const ratedShipmentDetails = detail.ratedShipmentDetails as any[] | undefined
      if (Array.isArray(ratedShipmentDetails)) {
        for (const rs of ratedShipmentDetails) {
          const rateType = rs.rateType as string | undefined
          const totalNetCharge = rs.totalNetChargeWithDutiesAndTaxes?.amount ?? rs.totalNetCharge?.amount
          if (typeof totalNetCharge === 'number') {
            if (rateType === 'ACCOUNT' || rateType === 'PREFERRED_ACCOUNT') {
              accountRate = totalNetCharge
            } else if (rateType === 'LIST' || rateType === 'PREFERRED_LIST') {
              listRate = totalNetCharge
            }
          }
        }
      }

      const deliveryTimestamp: string | undefined =
        detail.operationalDetail?.deliveryDate ||
        detail.operationalDetail?.transitTime ||
        undefined

      options.push({
        serviceType,
        serviceName,
        accountRate,
        listRate,
        deliveryDate: deliveryTimestamp,
      })
    }
  }

  return { options }
}

// ── Track API ──────────────────────────────────────────────

export async function trackShipment(
  trackingNumber: string,
  credentials: FedExCredentials
): Promise<FedExTrackResponse> {
  const baseUrl = FEDEX_URLS[credentials.environment]

  const body = {
    trackingInfo: [
      {
        trackingNumberInfo: {
          trackingNumber,
        },
      },
    ],
    includeDetailedScans: true,
  }

  const response = await fedexFetch(`${baseUrl}/track/v1/trackingnumbers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  }, credentials)

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ errors: [{ message: 'Unknown error' }] }))
    const errors = errorBody.errors as FedExError[] | undefined
    const msg = errors?.map((e) => e.message).join('; ') || `FedEx Track API error (${response.status})`
    throw new Error(msg)
  }

  const data = await response.json()
  const completedTrackDetails = data.output?.completeTrackResults?.[0]?.trackResults?.[0]

  if (!completedTrackDetails) {
    throw new Error('No tracking data in FedEx response')
  }

  const statusCode: string =
    completedTrackDetails.latestStatusDetail?.code || completedTrackDetails.latestStatusDetail?.statusCode || 'UNKNOWN'
  const statusDescription: string =
    completedTrackDetails.latestStatusDetail?.description ||
    completedTrackDetails.latestStatusDetail?.statusByLocale ||
    'Unknown status'

  const events: FedExTrackEvent[] = Array.isArray(completedTrackDetails.scanEvents)
    ? completedTrackDetails.scanEvents.map((e: any) => ({
        statusCode: e.eventType || e.scanType || '',
        statusDescription: e.eventDescription || e.statusExceptionDescription || '',
        timestamp: e.date || e.dateTime || undefined,
        city: e.scanLocation?.city || undefined,
        state: e.scanLocation?.stateOrProvinceCode || undefined,
        country: e.scanLocation?.countryCode || undefined,
      }))
    : []

  const estimatedDelivery: string | undefined =
    completedTrackDetails.estimatedDeliveryDate || completedTrackDetails.estimatedDeliveryTime || undefined
  const actualDelivery: string | undefined = completedTrackDetails.actualDeliveryDateAndTime || undefined

  return {
    trackingNumber,
    statusCode,
    statusDescription,
    events,
    estimatedDelivery,
    actualDelivery,
  }
}

