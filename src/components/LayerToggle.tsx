import { useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { getToggleableLayers } from '../lib/mapStyle'
import { useStore } from '../store'

interface LayerToggleProps {
  map: maplibregl.Map | null
}

const MAP_MODES = [
  { value: 'satellite', label: 'Satellite', icon: '🛰' },
  { value: 'street', label: 'Street', icon: '🗺' },
  { value: 'clean', label: 'Clean', icon: '📋' },
] as const

export default function LayerToggle({ map }: LayerToggleProps) {
  const visibleLayers = useStore((s) => s.visibleLayers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const boundary = useStore((s) => s.boundary)
  const mapMode = useStore((s) => s.mapMode)
  const setMapMode = useStore((s) => s.setMapMode)
  const layers = getToggleableLayers()

  const isAutoMode = mapMode === 'auto'
  const effectiveMode = isAutoMode
    ? (boundary === null ? 'satellite' : 'clean')
    : mapMode

  const handleToggle = useCallback(
    (layerId: string, mapLayerIds: string[]) => {
      toggleLayer(layerId)
      if (!map) return

      const newVisible = !visibleLayers[layerId]
      const visibility = newVisible ? 'visible' : 'none'

      for (const mlId of mapLayerIds) {
        try {
          map.setLayoutProperty(mlId, 'visibility', visibility)
        } catch {
          // Layer may not exist yet
        }
      }
    },
    [map, visibleLayers, toggleLayer],
  )

  return (
    <div className="space-y-2">
      {/* Map mode selector */}
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Map View
          </h3>
          {isAutoMode ? (
            <span className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-gray-400">
              auto
            </span>
          ) : (
            <button
              onClick={() => setMapMode('auto')}
              className="rounded bg-gray-100 px-1 py-0.5 text-[10px] text-primary hover:bg-gray-200"
            >
              reset auto
            </button>
          )}
        </div>
        <div className="flex gap-1">
          {MAP_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setMapMode(mode.value)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[10px] font-medium transition-colors ${
                effectiveMode === mode.value
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-sm">{mode.icon}</span>
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      <div className="my-1 border-t border-gray-100" />

      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Map Layers
      </h3>
      {layers.map((layer) => (
        <label key={layer.id} className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={visibleLayers[layer.id] || false}
            onChange={() => handleToggle(layer.id, layer.layerIds)}
            className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
          />
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: layer.color }}
          />
          <span className="text-sm text-gray-600">{layer.label}</span>
        </label>
      ))}
    </div>
  )
}
