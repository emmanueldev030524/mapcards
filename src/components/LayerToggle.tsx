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

  const isAutoMode = mapMode === 'auto'
  const effectiveMode = isAutoMode
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
      {/* Map mode — high-contrast segmented control */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 p-0.5">
          {MAP_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => setMapMode(mode.value)}
              className={`relative z-10 flex flex-1 items-center justify-center gap-1 rounded px-1 py-1.5 text-[11px] font-bold transition-all duration-200 ${
                effectiveMode === mode.value
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-muted hover:bg-slate-200 hover:text-heading'
              }`}
            >
              <mode.Icon size={12} strokeWidth={2} className="shrink-0" />
              {mode.label}
            </button>
          ))}
        </div>
        {!isAutoMode && (
          <button
            onClick={() => setMapMode('auto')}
            className="shrink-0 rounded bg-slate-200 px-1.5 py-1 text-[11px] font-bold text-action transition-colors duration-150 hover:bg-slate-300"
          >
            Auto
          </button>
        )}
      </div>

      {/* Layers */}
      <div className="text-[13px] font-bold uppercase tracking-wide text-heading">Layers</div>
      {layers.map((layer) => {
        const LayerIcon = LAYER_ICONS[layer.id]
        const isChecked = visibleLayers[layer.id] || false
        return (
          <label key={layer.id} className="group flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors duration-100 hover:bg-slate-50">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(layer.id, layer.layerIds)}
                className="peer h-5 w-5 cursor-pointer appearance-none rounded border-2 border-slate-500 bg-white transition-all duration-150 checked:border-action checked:bg-action"
              />
              <svg className="pointer-events-none absolute left-1 top-1 hidden h-3 w-3 text-white peer-checked:block" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            </div>
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-200 ${isChecked ? 'scale-110' : 'scale-100'}`}
              style={{ backgroundColor: layer.color + (isChecked ? '30' : '15') }}
            >
              {LayerIcon ? (
                <LayerIcon size={20} strokeWidth={2} style={{ color: layer.color }} />
              ) : (
                <span
                  className="block h-3 w-3 rounded-full"
                  style={{ backgroundColor: layer.color }}
                />
              )}
            </span>
            <span className={`text-sm font-medium transition-colors duration-150 ${isChecked ? 'text-heading' : 'text-label'}`}>{layer.label}</span>
          </label>
        )
      })}
    </div>
  )
}
