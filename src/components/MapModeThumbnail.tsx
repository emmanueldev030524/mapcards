import { useState, useCallback, useRef, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { X, Satellite, Map, FileText, Building2, Hash, ShoppingBag, GraduationCap, Church, Cross } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getToggleableLayers } from '../lib/mapStyle'
import { useStore } from '../store'
import { useIsTablet } from '../hooks/useMediaQuery'

type MapMode = 'satellite' | 'street' | 'clean'

interface MapModeThumbnailProps {
  currentMode: MapMode
  onModeChange: (mode: MapMode) => void
  map: maplibregl.Map | null
  onPanelToggle?: (open: boolean) => void
}

const MAP_TYPES: { value: MapMode; label: string; Icon: typeof Satellite; gradient: string }[] = [
  { value: 'satellite', label: 'Satellite', Icon: Satellite, gradient: 'from-emerald-800 to-emerald-900' },
  { value: 'street', label: 'Street', Icon: Map, gradient: 'from-slate-100 to-slate-200' },
]

const DETAIL_ICONS: Record<string, LucideIcon> = {
  buildings: Building2,
  housenumbers: Hash,
  'poi-shops': ShoppingBag,
  'poi-schools': GraduationCap,
  'poi-churches': Church,
  'poi-hospitals': Cross,
}

/** Toggle switch — matches Toolbar.tsx iOS-style toggle */
function Toggle({ checked }: { checked: boolean }) {
  return (
    <span
      role="switch"
      aria-checked={checked}
      className={`relative inline-flex h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200 ease-out ${
        checked ? 'bg-brand' : 'bg-slate-200'
      }`}
    >
      <span
        className={`absolute left-[3px] top-[3px] h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  )
}

export default function MapModeThumbnail({ currentMode, onModeChange, map, onPanelToggle }: MapModeThumbnailProps) {
  const [panelOpen, _setPanelOpen] = useState(false)
  const setPanelOpen = useCallback((v: boolean | ((prev: boolean) => boolean)) => {
    _setPanelOpen((prev) => {
      const next = typeof v === 'function' ? v(prev) : v
      onPanelToggle?.(next)
      return next
    })
  }, [onPanelToggle])
  const panelRef = useRef<HTMLDivElement>(null)
  const isTablet = useIsTablet()

  const visibleLayers = useStore((s) => s.visibleLayers)
  const toggleLayer = useStore((s) => s.toggleLayer)
  const layers = getToggleableLayers()

  // Click outside to close
  useEffect(() => {
    if (!panelOpen) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setPanelOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [panelOpen])

  const handleLayerToggle = useCallback(
    (layerId: string, mapLayerIds: string[]) => {
      toggleLayer(layerId)
      if (!map) return

      const newVisible = !visibleLayers[layerId]
      const visibility = newVisible ? 'visible' : 'none'

      for (const mlId of mapLayerIds) {
        try { map.setLayoutProperty(mlId, 'visibility', visibility) } catch { /* skip */ }
      }

      if (layerId === 'buildings') {
        const style = map.getStyle()
        if (style?.layers) {
          for (const layer of style.layers) {
            if ('source-layer' in layer && layer['source-layer'] === 'building') {
              try { map.setLayoutProperty(layer.id, 'visibility', visibility) } catch { /* skip */ }
            }
          }
        }
      }

      if (layerId === 'housenumbers') {
        try {
          if (newVisible) {
            map.setLayoutProperty('house-icons', 'text-field', [
              'format',
              ['get', 'num'], { 'font-scale': 1.0 },
              ['case', ['!=', ['get', 'label'], ''],
                ['concat', '\n', ['get', 'label']],
                '',
              ], { 'font-scale': 0.85 },
            ])
          } else {
            map.setLayoutProperty('house-icons', 'text-field', '')
          }
        } catch { /* skip */ }
      }
    },
    [map, visibleLayers, toggleLayer],
  )

  // Thumbnail: show the current mode icon
  const current = MAP_TYPES.find((m) => m.value === currentMode) || MAP_TYPES[1]
  const isLight = current.value !== 'satellite'

  return (
    <div ref={panelRef} className="absolute left-3 bottom-5 z-10">
      {/* Thumbnail button */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        title="Basemap settings"
        className={`touch-active flex flex-col items-center justify-end overflow-hidden rounded-xl border-2 border-white/80 bg-linear-to-b shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-all duration-200 hover:scale-105 hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] active:scale-95 ${current.gradient} ${
          isTablet ? 'h-20 w-20' : 'h-16 w-16'
        } ${panelOpen ? 'ring-2 ring-brand/40' : ''}`}
      >
        <div className="flex flex-1 items-center justify-center">
          <current.Icon
            size={isTablet ? 22 : 18}
            strokeWidth={1.5}
            className={isLight ? 'text-slate-500' : 'text-white/80'}
          />
        </div>
        <div className={`w-full px-1 pb-1.5 text-center text-[9px] font-semibold leading-none ${
          isLight ? 'text-slate-600' : 'text-white'
        }`}>
          {current.label}
        </div>
      </button>

      {/* Panel — Google Earth style basemap settings */}
      {panelOpen && (
        <div className={`absolute left-0 animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-divider/40 bg-white/95 shadow-[0_8px_28px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.05)] backdrop-blur-xl ${
          isTablet ? 'bottom-24 w-72 max-h-[calc(100dvh-8rem)]' : 'bottom-20 w-64 max-h-[calc(100dvh-6rem)]'
        } flex flex-col overflow-hidden`}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2.5">
            <h3 className="text-[15px] font-bold text-heading">Basemap</h3>
            <button
              onClick={() => setPanelOpen(false)}
              aria-label="Close"
              className={`flex items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-slate-200/60 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none ${
                isTablet ? 'h-9 w-9' : 'h-8 w-8'
              }`}
            >
              <X size={isTablet ? 18 : 16} strokeWidth={2} />
            </button>
          </div>

          {/* ── Scrollable content ── */}
          <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* ── Type section ── */}
          <div className="px-5 pb-4">
            <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-wider text-body/70">Type</p>
            <div className="flex gap-4">
              {MAP_TYPES.map((mode) => {
                const active = currentMode === mode.value
                const light = mode.value !== 'satellite'
                return (
                  <button
                    key={mode.value}
                    onClick={() => onModeChange(mode.value)}
                    className={`touch-active flex flex-col items-center gap-2 transition-all duration-150 ${
                      active ? '' : 'opacity-50 hover:opacity-80'
                    }`}
                  >
                    <div className={`flex items-center justify-center overflow-hidden rounded-xl bg-linear-to-b shadow-sm ${mode.gradient} ${
                      isTablet ? 'h-18 w-18' : 'h-16 w-16'
                    } ${active ? 'ring-2 ring-brand ring-offset-2' : ''}`}>
                      <mode.Icon size={isTablet ? 24 : 22} strokeWidth={1.5} className={light ? 'text-slate-500' : 'text-white/80'} />
                    </div>
                    <span className={`text-[11px] font-semibold ${active ? 'text-heading' : 'text-body/60'}`}>
                      {mode.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mx-5 border-t border-divider/40" />

          {/* ── Details section (layer toggles) ── */}
          <div className="px-5 pt-3 pb-1">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-body/70">Details</p>
            {layers.map((layer, i) => {
              const LayerIcon = DETAIL_ICONS[layer.id]
              const isChecked = visibleLayers[layer.id] || false
              return (
                <div key={layer.id}>
                  {i > 0 && <div className="border-t border-divider/30" />}
                  <button
                    onClick={() => handleLayerToggle(layer.id, layer.layerIds)}
                    className="flex min-h-11 w-full items-center gap-3 py-2.5 transition-colors active:bg-input-bg/50"
                  >
                    {LayerIcon && (
                      <LayerIcon
                        size={isTablet ? 18 : 17}
                        strokeWidth={2}
                        style={{ color: isChecked ? layer.color : '#9ca3af' }}
                        className="shrink-0 transition-colors duration-200"
                      />
                    )}
                    <span className={`flex-1 text-left text-[13px] font-medium transition-colors duration-200 ${
                      isChecked ? 'text-heading' : 'text-body/70'
                    }`}>
                      {layer.label}
                    </span>
                    <Toggle checked={isChecked} />
                  </button>
                </div>
              )
            })}
          </div>

          {/* Clean mode option */}
          <div className="mx-5 border-t border-divider/40" />
          <div className="px-5 pt-1 pb-4">
            <button
              onClick={() => onModeChange('clean')}
              className="touch-active flex min-h-11 w-full items-center gap-3 py-2.5 transition-colors active:bg-input-bg/50"
            >
              <FileText
                size={isTablet ? 18 : 17}
                strokeWidth={2}
                className={`shrink-0 ${currentMode === 'clean' ? 'text-brand' : 'text-body/40'}`}
              />
              <div className="flex-1 text-left">
                <span className={`block text-[13px] font-medium ${currentMode === 'clean' ? 'text-heading' : 'text-body/70'}`}>
                  Clean
                </span>
                <span className="block text-[10px] text-body/50">No labels, places, or roads</span>
              </div>
              <div className={`h-6 w-6 rounded-full border-2 transition-colors ${
                currentMode === 'clean' ? 'border-brand bg-brand' : 'border-slate-300'
              }`}>
                {currentMode === 'clean' && (
                  <svg viewBox="0 0 12 12" className="h-full w-full text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2.5 6 5 8.5 9.5 3.5" />
                  </svg>
                )}
              </div>
            </button>
          </div>

          </div>{/* end scrollable content */}
        </div>
      )}
    </div>
  )
}
