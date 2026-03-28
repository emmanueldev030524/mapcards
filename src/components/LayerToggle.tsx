import { useCallback } from 'react'
import type maplibregl from 'maplibre-gl'
import { getToggleableLayers } from '../lib/mapStyle'
import { useStore } from '../store'
import {
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

/** Inline toggle switch — compact version for layer rows */
function LayerSwitch({ checked }: { checked: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 rounded-full transition-colors duration-200 ease-out ${
        checked ? 'bg-brand' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </span>
  )
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

      // Toggle our custom layers
      for (const mlId of mapLayerIds) {
        try {
          map.setLayoutProperty(mlId, 'visibility', visibility)
        } catch {
          // Layer may not exist yet
        }
      }

      // For buildings: also toggle ALL base style layers that use the building source-layer
      if (layerId === 'buildings') {
        const style = map.getStyle()
        if (style?.layers) {
          for (const layer of style.layers) {
            if ('source-layer' in layer && layer['source-layer'] === 'building') {
              try {
                map.setLayoutProperty(layer.id, 'visibility', visibility)
              } catch { /* skip */ }
            }
          }
        }
      }

      // For housenumbers: toggle text visibility on the house icons layer
      if (layerId === 'housenumbers') {
        try {
          if (newVisible) {
            // Show numbers + labels below house icons
            map.setLayoutProperty('house-icons', 'text-field', [
              'format',
              ['get', 'num'], { 'font-scale': 1.0 },
              ['case', ['!=', ['get', 'label'], ''],
                ['concat', '\n', ['get', 'label']],
                '',
              ], { 'font-scale': 0.85 },
            ])
          } else {
            // Hide all text
            map.setLayoutProperty('house-icons', 'text-field', '')
          }
        } catch { /* layer may not exist yet */ }
      }
    },
    [map, visibleLayers, toggleLayer],
  )

  return (
    <div>
      {/* Layers — grouped card */}
      <div className="rounded-xl bg-input-bg/50 px-1 py-0.5">
        {layers.map((layer, i) => {
          const LayerIcon = LAYER_ICONS[layer.id]
          const isChecked = visibleLayers[layer.id] || false
          return (
            <div key={layer.id}>
              {i > 0 && <div className="mx-2.5 border-t border-divider/40" />}
              <button
                onClick={() => handleToggle(layer.id, layer.layerIds)}
                className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition-all duration-150 active:bg-white/60"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200"
                  style={{
                    backgroundColor: isChecked
                      ? `${layer.color}18`
                      : 'rgba(0,0,0,0.04)',
                  }}
                >
                  {LayerIcon ? (
                    <LayerIcon
                      size={17}
                      strokeWidth={2}
                      style={{ color: isChecked ? layer.color : '#9ca3af' }}
                      className="transition-colors duration-200"
                    />
                  ) : (
                    <span
                      className="block h-2.5 w-2.5 rounded-full transition-colors duration-200"
                      style={{ backgroundColor: isChecked ? layer.color : '#9ca3af' }}
                    />
                  )}
                </span>
                <span className={`flex-1 text-left text-[13px] font-medium transition-colors duration-200 ${
                  isChecked ? 'text-heading' : 'text-body/50'
                }`}>
                  {layer.label}
                </span>
                <LayerSwitch checked={isChecked} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
