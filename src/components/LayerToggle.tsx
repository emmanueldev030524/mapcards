import { useCallback, useRef, useEffect, useState } from 'react'
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

/** Sliding pill segmented control */
function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; Icon: LucideIcon }[]
  value: string
  onChange: (value: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })
  const activeIndex = options.findIndex((o) => o.value === value)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const buttons = container.querySelectorAll<HTMLButtonElement>('[data-segment]')
    const btn = buttons[activeIndex]
    if (!btn) return
    setIndicator({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    })
  }, [activeIndex])

  return (
    <div
      ref={containerRef}
      className="relative flex w-full overflow-hidden rounded-full border border-divider/60 bg-white p-0.5"
    >
      {/* Sliding indicator */}
      <div
        className="absolute top-0.5 bottom-0.5 rounded-full bg-brand shadow-[0_1px_3px_rgba(75,108,167,0.4)] transition-all duration-300 ease-in-out"
        style={{ left: indicator.left, width: indicator.width }}
      />
      {options.map((opt) => {
        const isActive = opt.value === value
        return (
          <button
            key={opt.value}
            data-segment
            onClick={() => onChange(opt.value)}
            className={`relative z-10 flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full px-1 py-2 text-[11px] transition-colors duration-200 ${
              isActive
                ? 'font-semibold text-white'
                : 'font-medium text-body/50 hover:text-body/80'
            }`}
          >
            <opt.Icon size={13} strokeWidth={isActive ? 2.5 : 1.5} className="shrink-0" />
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

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
    <div className="space-y-3">
      {/* Map mode — segmented control with sliding indicator */}
      <SegmentedControl
        options={MAP_MODES}
        value={effectiveMode}
        onChange={(v) => setMapMode(v as 'satellite' | 'street' | 'clean')}
      />

      {/* Layers */}
      <div className="space-y-1.5">
        {layers.map((layer) => {
          const LayerIcon = LAYER_ICONS[layer.id]
          const isChecked = visibleLayers[layer.id] || false
          return (
            <button
              key={layer.id}
              onClick={() => handleToggle(layer.id, layer.layerIds)}
              className={`group flex w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 transition-all duration-150 ${
                isChecked
                  ? ''
                  : 'opacity-40 hover:opacity-60'
              }`}
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-all duration-200"
                style={{
                  backgroundColor: isChecked ? layer.color : '#C8C6C1',
                }}
              >
                {LayerIcon ? (
                  <LayerIcon
                    size={16}
                    strokeWidth={2}
                    className="text-white"
                  />
                ) : (
                  <span className="block h-2.5 w-2.5 rounded-full bg-white" />
                )}
              </span>
              <span className="flex-1 text-left text-[13px] font-semibold text-heading">
                {layer.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
