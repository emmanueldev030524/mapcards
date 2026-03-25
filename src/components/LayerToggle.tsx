import { useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { getToggleableLayers } from '../lib/mapStyle'
import { useStore } from '../store'

interface LayerToggleProps {
  map: maplibregl.Map | null
}

export default function LayerToggle({ map }: LayerToggleProps) {
  const visibleLayers = useStore((s) => s.visibleLayers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const layers = getToggleableLayers()

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
