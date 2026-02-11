'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card from '@/components/ui/Card'
import { useClient } from '@/lib/client-auth'

interface ShopifyLocation {
  id: string
  name: string
  active: boolean
  fulfills_online_orders: boolean
  city: string | null
  province_code: string | null
  country_code: string | null
}

interface LocationsResponse {
  locations: ShopifyLocation[]
  currentLocationId: string | null
  currentLocationName: string | null
  locationCreatedByUs: boolean
}

export default function ShopifyLocationSettingsPage() {
  const router = useRouter()
  const { client } = useClient()
  const [locations, setLocations] = useState<ShopifyLocation[]>([])
  const [currentLocationId, setCurrentLocationId] = useState<string | null>(null)
  const [selectedLocationId, setSelectedLocationId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadLocations()
  }, [client?.id])

  async function loadLocations() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/shopify/locations')

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to load locations')
      }

      const data: LocationsResponse = await response.json()
      setLocations(data.locations)
      setCurrentLocationId(data.currentLocationId)
      setSelectedLocationId(data.currentLocationId || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load locations')
    }

    setIsLoading(false)
  }

  async function handleSave() {
    if (!selectedLocationId) return

    setIsSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/integrations/shopify/locations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: selectedLocationId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update location')
      }

      const data = await response.json()
      setSuccess(data.message || 'Location updated successfully')
      setCurrentLocationId(selectedLocationId)

      // Refresh locations to get updated name
      loadLocations()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update location')
    }

    setIsSaving(false)
  }

  const hasChanges = selectedLocationId !== currentLocationId
  const selectedLocation = locations.find((loc) => loc.id === selectedLocationId)

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={() => router.push('/portal/settings/integrations')}
          className="text-sm text-gray-500 hover:text-gray-700 mb-2 inline-flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Integrations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Shopify Inventory Location</h1>
        <p className="text-gray-600 mt-1">
          Choose which Shopify location represents inventory stored at our warehouse
        </p>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
          {success}
        </div>
      )}

      <Card>
        <div className="p-6">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading locations...</div>
          ) : locations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No locations found in your Shopify store.</p>
              <p className="text-sm text-gray-400 mt-2">
                Make sure your Shopify app has the <code>read_locations</code> permission.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Info Box */}
              <div className="p-4 bg-blue-50 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">How it works</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Inventory sync only updates the selected location</li>
                  <li>• Other locations in Shopify remain unchanged</li>
                  <li>• Orders assigned to this location are imported to our system</li>
                </ul>
              </div>

              {/* Location Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Inventory Location
                </label>
                <div className="space-y-2">
                  {locations.map((location) => (
                    <label
                      key={location.id}
                      className={`flex items-center p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedLocationId === location.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="location"
                        value={location.id}
                        checked={selectedLocationId === location.id}
                        onChange={(e) => setSelectedLocationId(e.target.value)}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{location.name}</span>
                          {location.id === currentLocationId && (
                            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                              Current
                            </span>
                          )}
                          {!location.fulfills_online_orders && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                              No online fulfillment
                            </span>
                          )}
                        </div>
                        {(location.city || location.province_code) && (
                          <p className="text-sm text-gray-500 mt-1">
                            {[location.city, location.province_code, location.country_code]
                              .filter(Boolean)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedLocationId === location.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedLocationId === location.id && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Warning for non-fulfilling location */}
              {selectedLocation && !selectedLocation.fulfills_online_orders && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This location is not set to fulfill online orders in Shopify.
                    Orders may not be automatically assigned to this location.
                  </p>
                </div>
              )}

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  onClick={() => router.push('/portal/settings/integrations')}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasChanges}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
