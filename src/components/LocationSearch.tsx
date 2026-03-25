import { useState, useRef, useCallback } from 'react'
import type { GeoJSON } from 'geojson'

interface SearchResult {
  place_id: number
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
}

export default function LocationSearch({ onLocationSelect }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&polygon_geojson=1&polygon_threshold=0.0005`,
        { headers: { 'Accept-Language': 'en' } },
      )
      if (!res.ok) throw new Error('Search failed')
      const data: SearchResult[] = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch {
      setResults([])
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleInput = (value: string) => {
    setQuery(value)
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
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Search location..."
        className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
      {loading && (
        <div className="absolute right-2 top-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
        </div>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                onClick={() => handleSelect(r)}
                className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                <span className="font-medium">{r.display_name.split(',')[0]}</span>
                <span className="block text-[10px] text-gray-400">
                  {r.display_name.split(',').slice(1).join(',').trim()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
