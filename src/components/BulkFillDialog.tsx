import { useState, useCallback, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import { LayoutGrid } from 'lucide-react'
import { useStore } from '../store'
import { distributeHousesAlongLine } from '../lib/bulkFillHouses'
import type { Feature, LineString } from 'geojson'

interface BulkFillDialogProps {
  map: maplibregl.Map | null
  open: boolean
  onClose: () => void
}

export default function BulkFillDialog({ map, open, onClose }: BulkFillDialogProps) {
  const [count, setCount] = useState(5)
  const [drawing, setDrawing] = useState(false)
  const [line, setLine] = useState<Feature<LineString> | null>(null)
  const [clickedPoints, setClickedPoints] = useState<[number, number][]>([])
  const bulkAddHouses = useStore((s) => s.bulkAddHouses)

  // Store active listeners so we can clean them up on cancel
  const listenersRef = useRef<{ onClick: ((e: maplibregl.MapMouseEvent) => void) | null; onDblClick: ((e: maplibregl.MapMouseEvent) => void) | null }>({ onClick: null, onDblClick: null })

  const startDrawLine = useCallback(() => {
    if (!map) return
    setDrawing(true)
    setClickedPoints([])
    setLine(null)
    map.getCanvas().style.cursor = 'crosshair'

    const points: [number, number][] = []

    const onClick = (e: maplibregl.MapMouseEvent) => {
      points.push([e.lngLat.lng, e.lngLat.lat])
      setClickedPoints([...points])
    }

    const onDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault()
      points.push([e.lngLat.lng, e.lngLat.lat])

      if (points.length >= 2) {
        const feature: Feature<LineString> = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: points },
          properties: {},
        }
        setLine(feature)
      }

      map.off('click', onClick)
      map.off('dblclick', onDblClick)
      listenersRef.current = { onClick: null, onDblClick: null }
      map.getCanvas().style.cursor = ''
      setDrawing(false)
    }

    listenersRef.current = { onClick, onDblClick }
    map.on('click', onClick)
    map.on('dblclick', onDblClick)
  }, [map])

  const handleConfirm = useCallback(() => {
    if (!line) return
    const points = distributeHousesAlongLine(line, count)
    bulkAddHouses(points)
    setLine(null)
    setClickedPoints([])
    onClose()
  }, [line, count, bulkAddHouses, onClose])

  const handleCancel = useCallback(() => {
    // Remove any active drawing listeners to prevent leaks
    if (map && listenersRef.current.onClick) {
      map.off('click', listenersRef.current.onClick)
    }
    if (map && listenersRef.current.onDblClick) {
      map.off('dblclick', listenersRef.current.onDblClick)
    }
    listenersRef.current = { onClick: null, onDblClick: null }
    setLine(null)
    setClickedPoints([])
    setDrawing(false)
    if (map) map.getCanvas().style.cursor = ''
    onClose()
  }, [map, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
      <div className="w-full max-w-[20rem] mx-4 rounded-xl bg-white p-5 shadow-[0_20px_40px_rgba(0,0,0,0.12),0_8px_16px_rgba(0,0,0,0.06)]">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <LayoutGrid size={14} strokeWidth={2} className="text-primary" />
          </div>
          Bulk Place Houses
        </h3>

        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Number of houses</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={100}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-[0_1px_2px_rgba(0,0,0,0.04)] outline-none transition-all duration-150 focus:border-primary focus:shadow-[0_0_0_3px_rgba(74,109,167,0.1)]"
          />
        </div>

        <div className="mb-4">
          {!line ? (
            <button
              onClick={startDrawLine}
              disabled={drawing}
              className="w-full rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-xs font-medium text-primary shadow-[0_1px_2px_rgba(74,109,167,0.1)] transition-all duration-150 hover:bg-primary/10 hover:shadow-[0_2px_4px_rgba(74,109,167,0.15)] disabled:opacity-60 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              {drawing
                ? `Drawing... (${clickedPoints.length} points, double-click to finish)`
                : 'Draw street segment on map'}
            </button>
          ) : (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-600">
              Street segment drawn. Ready to place {count} houses.
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-all duration-150 hover:bg-slate-50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!line}
            className="flex-1 rounded-lg bg-linear-to-b from-primary-light to-primary px-3 py-2 text-xs font-semibold text-white shadow-[0_1px_3px_rgba(74,109,167,0.3)] transition-all duration-150 hover:shadow-[0_2px_6px_rgba(74,109,167,0.35)] hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            Place Houses
          </button>
        </div>
      </div>
    </div>
  )
}
