import { useState, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
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
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body">
        <Search size={14} strokeWidth={2} />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        placeholder="Search location..."
        className="w-full rounded-lg border-0 bg-input-bg py-2 pl-9 pr-8 text-[13px] text-heading placeholder-body outline-none transition-shadow duration-150 focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
      />
      {loading ? (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-divider border-t-brand" />
        </div>
      ) : query.length > 0 && (
        <button
          onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-body transition-colors duration-150 hover:bg-divider hover:text-heading"
        >
          <X size={13} strokeWidth={2} />
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1.5 max-h-48 w-full overflow-y-auto rounded-lg border border-divider bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.04)]">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                onClick={() => handleSelect(r)}
                className="w-full border-b border-divider/50 px-3 py-2.5 text-left text-[12px] text-body transition-colors duration-100 last:border-b-0 hover:bg-brand-hover"
              >
                <span className="font-medium text-heading">{r.display_name.split(',')[0]}</span>
                <span className="mt-0.5 block text-[10px] text-body/70">
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
