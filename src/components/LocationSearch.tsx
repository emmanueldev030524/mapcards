import { useState, useRef, useCallback, useEffect } from 'react'
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
  /** When true, renders compact style for embedding in the toolbar */
  compact?: boolean
}

export default function LocationSearch({ onLocationSelect, compact }: LocationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Cleanup debounce timer and abort pending fetch on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current?.abort()
    }
  }, [])

  // Click-outside dismissal
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 3) {
      setResults([])
      setOpen(false)
      return
    }

    // Abort any in-flight request before starting a new one
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5&polygon_geojson=1&polygon_threshold=0.0005`,
        {
          headers: { 'Accept-Language': 'en', 'User-Agent': 'MapCards/1.0' },
          signal: controller.signal,
        },
      )
      if (!res.ok) throw new Error('Search failed')
      const data: SearchResult[] = await res.json()
      setResults(data)
      setOpen(data.length > 0)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
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
    <div ref={rootRef} className="relative">
      <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body/70">
        <Search size={compact ? 13 : 14} strokeWidth={2} />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={(e) => {
          // Prevent Escape from clearing draw mode while typing
          if (e.key === 'Escape') {
            e.stopPropagation()
            setOpen(false)
            e.currentTarget.blur()
          }
        }}
        placeholder={compact ? 'Search location...' : 'Search...'}
        className={
          compact
            ? 'h-9 w-full rounded-full border border-slate-200/80 bg-slate-100/60 pl-8 pr-7 text-[12px] text-heading placeholder-body/60 outline-none transition-all duration-150 focus:border-brand/30 focus:bg-white focus:shadow-[0_0_0_2px_rgba(75,108,167,0.2)]'
            : 'w-full rounded-lg border-0 bg-input-bg py-2 pl-9 pr-8 text-[13px] text-heading placeholder-body outline-none transition-shadow duration-150 focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]'
        }
      />
      {loading ? (
        <div className={`absolute top-1/2 -translate-y-1/2 ${compact ? 'right-2' : 'right-3'}`}>
          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-divider border-t-brand" />
        </div>
      ) : query.length > 0 && (
        <button
          onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
          aria-label="Clear search"
          className={`absolute top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-slate-500 transition-colors duration-150 hover:bg-slate-200/60 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none ${compact ? 'right-1' : 'right-2'}`}
        >
          <X size={13} strokeWidth={2.5} />
        </button>
      )}
      {open && results.length > 0 && (
        <ul className={`absolute z-50 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-divider/50 bg-white/98 py-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14),0_4px_10px_rgba(0,0,0,0.06)] backdrop-blur-xl ${
          compact ? 'left-0 w-80' : 'w-full'
        }`}>
          {results.map((r, i) => (
            <li key={r.place_id}>
              {i > 0 && <div className="mx-3 border-t border-divider/30" />}
              <button
                onClick={() => handleSelect(r)}
                className="w-full px-4 py-3 text-left transition-colors duration-100 hover:bg-brand-hover active:bg-brand-hover"
              >
                <span className="block text-[13px] font-semibold text-heading">{r.display_name.split(',')[0]}</span>
                <span className="mt-0.5 block text-[11px] leading-relaxed text-body/60">
                  {r.display_name.split(',').slice(1, 4).join(',').trim()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
