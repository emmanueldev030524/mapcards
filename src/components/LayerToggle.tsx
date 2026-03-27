import { useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { getToggleableLayers } from '../lib/mapStyle'
import { useStore } from '../store'
import {
  Satellite, Map, FileText,
  Building2, Hash, ShoppingBag, GraduationCap, Church, Cross,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface LayerToggleProps {
  map: maplibregl.Map | null
}

const LAYER_ICONS: Record<string, LucideIcon> = {
  buildings: Building2,
  housenumbers: Hash,
  'poi-shops': ShoppingBag,
  'poi-schools': GraduationCap,
  'poi-churches': Church,
  'poi-hospitals': Cross,
}

const MAP_MODES: { value: 'satellite' | 'street' | 'clean'; label: string; Icon: LucideIcon }[] = [
  { value: 'satellite', label: 'Satellite', Icon: Satellite },
  { value: 'street', label: 'Street', Icon: Map },
  { value: 'clean', label: 'Clean', Icon: FileText },
]

export default function LayerToggle({ map }: LayerToggleProps) {
  const visibleLayers = useStore((s) => s.visibleLayers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const boundary = useStore((s) => s.boundary)
  const mapMode = useStore((s) => s.mapMode)
  const setMapMode = useStore((s) => s.setMapMode)
  const layers = getToggleableLayers()

  const effectiveMode = mapMode === 'auto'
    ? (boundary === null ? 'satellite' : 'street')
    : mapMode

  const handleToggle = useCallback(
    (layerId: string, mapLayerIds: string[]) => {
      toggleLayer(layerId)
      if (!map) return

      const newVisible = !visibleLayers[layerId]
      const visibility = newVisible ? 'visible' : 'none'

      // Toggle our custom layers
      for (const mlId of mapLayerIds) {
        try {
          map.setLayoutProperty(mlId, 'visibility', visibility)
        } catch {
          // Layer may not exist yet
        }
      }

      // For buildings/housenumbers: also toggle ALL base style layers that use the same source-layer
      const sourceLayerMap: Record<string, string> = {
        buildings: 'building',
        housenumbers: 'housenumber',
      }
      const targetSourceLayer = sourceLayerMap[layerId]
      if (targetSourceLayer) {
        const style = map.getStyle()
        if (style?.layers) {
          for (const layer of style.layers) {
            if ('source-layer' in layer && layer['source-layer'] === targetSourceLayer) {
              try {
                map.setLayoutProperty(layer.id, 'visibility', visibility)
              } catch { /* skip */ }
            }
          }
        }
      }
    },
    [map, visibleLayers, toggleLayer],
  )

  return (
    <div className="space-y-3">
      {/* Map mode — segmented control */}
      <div className="flex min-w-0 rounded-lg bg-input-bg p-0.5">
        {MAP_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => setMapMode(mode.value)}
            className={`relative z-10 flex flex-1 items-center justify-center gap-1 rounded-md px-1 py-1.5 text-[11px] font-semibold transition-colors duration-200 ${
              effectiveMode === mode.value
                ? 'bg-brand text-white shadow-sm'
                : 'text-body hover:text-heading'
            }`}
          >
            <mode.Icon size={12} strokeWidth={2} className="shrink-0" />
            {mode.label}
          </button>
        ))}
      </div>

      {/* Layers */}
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-heading">Layers</div>
      {layers.map((layer) => {
        const LayerIcon = LAYER_ICONS[layer.id]
        const isChecked = visibleLayers[layer.id] || false
        return (
          <label key={layer.id} className="group flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors duration-150 hover:bg-brand-hover">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(layer.id, layer.layerIds)}
                className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded border-[1.5px] border-divider bg-surface transition-colors duration-150 checked:border-brand checked:bg-brand"
              />
              <svg className="pointer-events-none absolute left-1 top-1 hidden h-3 w-3 text-white peer-checked:block" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            </div>
            <span
              className={`flex h-6.5 w-6.5 items-center justify-center rounded-md transition-transform duration-200 ${isChecked ? 'scale-110' : 'scale-100'}`}
              style={{ backgroundColor: layer.color + (isChecked ? '25' : '12') }}
            >
              {LayerIcon ? (
                <LayerIcon size={16} strokeWidth={2} style={{ color: layer.color }} />
              ) : (
                <span
                  className="block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
              )}
            </span>
            <span className={`text-[13px] font-medium transition-colors duration-150 ${isChecked ? 'text-heading' : 'text-body'}`}>{layer.label}</span>
          </label>
        )
      })}
    </div>
  )
}
