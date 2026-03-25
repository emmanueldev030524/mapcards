import { useState, useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
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
      map.getCanvas().style.cursor = ''
      setDrawing(false)
    }

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
    setLine(null)
    setClickedPoints([])
    setDrawing(false)
    if (map) map.getCanvas().style.cursor = ''
    onClose()
  }, [map, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="w-80 rounded-lg bg-white p-5 shadow-xl">
        <h3 className="mb-3 text-sm font-semibold text-gray-800">Bulk Place Houses</h3>

        <div className="mb-3">
          <label className="mb-1 block text-xs text-gray-500">Number of houses</label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
            min={1}
            max={100}
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="mb-4">
          {!line ? (
            <button
              onClick={startDrawLine}
              disabled={drawing}
              className="w-full rounded-md border border-primary px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
            >
              {drawing
                ? `Drawing... (${clickedPoints.length} points, double-click to finish)`
                : 'Draw street segment on map'}
            </button>
          ) : (
            <p className="text-xs text-green-600">Street segment drawn. Ready to place {count} houses.</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-xs text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!line}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-light disabled:opacity-50"
          >
            Place Houses
          </button>
        </div>
      </div>
    </div>
  )
}
