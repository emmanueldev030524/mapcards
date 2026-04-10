import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'
import type { GeoJSON } from 'geojson'

interface SearchResult {
  place_id: number | string
  display_name: string
  lat: string
  lon: string
  boundingbox: [string, string, string, string]
  geojson?: GeoJSON
  type: string
  class: string
}

export interface LocationSelection {
  lng: number
  lat: number
  name: string
  bbox: [number, number, number, number]
  boundary: GeoJSON | null
}

interface LocationSearchProps {
  onLocationSelect: (selection: LocationSelection) => void
  /** When true, renders compact style for embedding in the toolbar */
  compact?: boolean
}

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number]
  }
  bbox?: [number, number, number, number]
  properties?: {
    name?: string
    city?: string
    county?: string
    state?: string
    country?: string
  }
}

interface DropdownPosition {
  left: number
  top: number
  width: number
}

function buildPhotonLabel(feature: PhotonFeature) {
  const parts = [
    feature.properties?.name,
    feature.properties?.city,
    feature.properties?.county,
    feature.properties?.state,
    feature.properties?.country,
  ].filter(Boolean)

  return parts.join(', ')
}

function mapPhotonResults(features: PhotonFeature[]): SearchResult[] {
  return features
    .filter((feature) => Array.isArray(feature.geometry?.coordinates))
    .slice(0, 5)
    .map((feature, index) => {
      const [lon, lat] = feature.geometry!.coordinates!
      const bbox = feature.bbox
        ? [String(feature.bbox[1]), String(feature.bbox[3]), String(feature.bbox[0]), String(feature.bbox[2])]
        : [String(lat), String(lat), String(lon), String(lon)]

      return {
        place_id: `photon-${index}-${lon}-${lat}`,
        display_name: buildPhotonLabel(feature),
        lat: String(lat),
        lon: String(lon),
        boundingbox: bbox as [string, string, string, string],
        type: 'place',
        class: 'location',
      }
    })
}

export default function LocationSearch({ onLocationSelect, compact }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLUListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cleanup debounce timer and abort pending fetch on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  const updateDropdownPosition = useCallback(() => {
    const input = inputRef.current
    if (!input) return

    const rect = input.getBoundingClientRect()
    const maxWidth = Math.min(320, window.innerWidth - 24)
    setDropdownPosition({
      left: Math.max(12, Math.min(rect.left, window.innerWidth - maxWidth - 12)),
      top: rect.bottom + 8,
      width: compact ? Math.min(maxWidth, Math.max(rect.width, 240)) : rect.width,
    })
  }, [compact])

  // Click-outside dismissal
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return

    updateDropdownPosition()
    const handler = () => updateDropdownPosition()

    window.addEventListener('resize', handler)
    window.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      window.removeEventListener('scroll', handler, true)
    }
  }, [open, updateDropdownPosition])

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 3) {
      setResults([])
      setOpen(false)
      setError(null)
      setHasSearched(false)
      return
    }

    // Abort any in-flight request before starting a new one
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)
    setHasSearched(true)
    try {
      const nominatimUrl =
        `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(trimmed)}&limit=5&polygon_geojson=1&polygon_threshold=0.0005`
      const res = await fetch(nominatimUrl, {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Primary search failed')
      let data: SearchResult[] = await res.json()

      if (data.length === 0) {
        const photonRes = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=5`,
          { signal: controller.signal },
        )
        if (!photonRes.ok) throw new Error('Fallback search failed')
        const photonData = await photonRes.json() as { features?: PhotonFeature[] }
        data = mapPhotonResults(photonData.features || [])
      }

      setResults(data)
      setOpen(true)
      updateDropdownPosition()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setResults([])
      setError('Location search is unavailable right now.')
      setOpen(true)
    } finally {
      setLoading(false)
    }
  }, [updateDropdownPosition])

  const handleInput = (value: string) => {
    setQuery(value)
    setError(null)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(value), 400)
  }

  const handleSelect = (result: SearchResult) => {
    const [south, north, west, east] = result.boundingbox.map(Number)
    const bbox: [number, number, number, number] = [west, south, east, north]

    onLocationSelect({
      lng: parseFloat(result.lon),
      lat: parseFloat(result.lat),
      name: result.display_name,
      bbox,
      boundary: result.geojson || null,
    })

    setQuery(result.display_name.split(',')[0])
    setOpen(false)
    setResults([])
    setError(null)
  }

  const dropdown = open && dropdownPosition && (
    <ul
      ref={dropdownRef}
      className="fixed z-[80] max-h-64 overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/98 py-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.18),0_6px_16px_rgba(15,23,42,0.08)] backdrop-blur-xl"
      style={{
        left: dropdownPosition.left,
        top: dropdownPosition.top,
        width: dropdownPosition.width,
      }}
    >
      {results.map((r, i) => (
        <li key={r.place_id}>
          {i > 0 && <div className="mx-3 border-t border-divider/30" />}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleSelect(r)}
            className="w-full px-4 py-3 text-left transition-colors duration-100 hover:bg-slate-50 active:bg-slate-100"
          >
            <span className="block text-[13px] font-semibold text-heading">{r.display_name.split(',')[0]}</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-body/78">
              {r.display_name.split(',').slice(1, 4).join(',').trim()}
            </span>
          </button>
        </li>
      ))}

      {!loading && results.length === 0 && error && (
        <li className="px-4 py-3 text-[12px] text-body/70">{error}</li>
      )}

      {!loading && results.length === 0 && !error && hasSearched && (
        <li className="px-4 py-3 text-[12px] text-body/70">No matching locations found.</li>
      )}
    </ul>
  )

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onFocus={() => {
          if (results.length > 0 || error || (hasSearched && query.trim().length >= 3)) {
            setOpen(true)
            updateDropdownPosition()
          }
        }}
        onKeyDown={(e) => {
          // Prevent Escape from clearing draw mode while typing
          if (e.key === 'Escape') {
            e.stopPropagation()
            setOpen(false)
            e.currentTarget.blur()
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            if (debounceRef.current) clearTimeout(debounceRef.current)
            search(query).catch(() => {
              // Search state is handled in search().
            })
          }
        }}
        aria-label="Search for a location"
        placeholder={compact ? 'Search location...' : 'Search...'}
        className={
          compact
            ? 'peer h-9 w-full rounded-full border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] pl-8 pr-7 text-[12px] text-heading placeholder:text-slate-600 outline-none shadow-[inset_0_1px_2px_rgba(15,23,42,0.06),0_1px_0_rgba(255,255,255,0.75)] transition-all duration-150 hover:border-slate-300/85 hover:bg-white hover:shadow-[inset_0_1px_2px_rgba(15,23,42,0.05),0_4px_10px_rgba(15,23,42,0.06)] focus:border-brand/50 focus:bg-white focus:shadow-[0_0_0_3px_rgba(75,108,167,0.16),0_6px_18px_rgba(75,108,167,0.12),inset_0_1px_2px_rgba(15,23,42,0.03)]'
            : 'w-full rounded-lg border-0 bg-input-bg py-2 pl-9 pr-8 text-[13px] text-heading placeholder-body outline-none transition-shadow duration-150 focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]'
        }
      />
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body/70 transition-colors duration-150 peer-hover:text-slate-600 peer-focus:text-brand">
        <Search size={compact ? 13 : 14} strokeWidth={2.2} />
      </div>
      {loading ? (
        <div className={`absolute top-1/2 -translate-y-1/2 ${compact ? 'right-2' : 'right-3'}`}>
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-divider border-t-brand" />
        </div>
      ) : query.length > 0 && (
        <button
          onClick={() => {
            abortRef.current?.abort()
            setQuery('')
            setResults([])
            setOpen(false)
            setError(null)
            setHasSearched(false)
            setLoading(false)
          }}
          aria-label="Clear search"
          className={`absolute top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-slate-200/70 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none ${compact ? '-right-2' : '-right-1'}`}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      )}
      {dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
