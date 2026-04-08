import { useState, useCallback, useRef, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { FileText, Building2, Hash, ShoppingBag, GraduationCap, Church, Cross } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getToggleableLayers } from '../lib/mapStyle'
import { BRAND } from '../lib/colors'
import { useStore } from '../store'
import { useIsTablet } from '../hooks/useMediaQuery'
import PopupToggle from './PopupToggle'
import {
  popupContainer,
  popupHeader,
  popupHeaderTitle,
  popupHeaderSubtitle,
  popupSectionLabel,
} from '../lib/popupStyles'
import { tooltipAttrs } from '../lib/tooltips'
import PopupCloseButton from './PopupCloseButton'

type MapMode = 'satellite' | 'street' | 'clean'
type PreviewMapMode = Exclude<MapMode, 'clean'>

interface MapModeThumbnailProps {
  currentMode: MapMode
  onModeChange: (mode: MapMode) => void
  map: maplibregl.Map | null
  onPanelToggle?: (open: boolean) => void
  sidebarOpen?: boolean
}

const MAP_TYPES: { value: PreviewMapMode; label: string }[] = [
  { value: 'satellite', label: 'Satellite' },
  { value: 'street', label: 'Street' },
]

const DETAIL_ICONS: Record<string, LucideIcon> = {
  buildings: Building2,
  housenumbers: Hash,
  'poi-shops': ShoppingBag,
  'poi-schools': GraduationCap,
  'poi-churches': Church,
  'poi-hospitals': Cross,
}

const STREET_PREVIEW_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const SATELLITE_PREVIEW_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const FIXED_PREVIEW_VIEW: Record<PreviewMapMode, { center: [number, number]; zoom: number }> = {
  street: {
    center: [-122.4194, 37.7749],
    zoom: 15,
  },
  satellite: {
    center: [-122.4194, 37.7749],
    zoom: 15,
  },
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function lngLatToTile(center: [number, number], zoom: number) {
  const [lng, lat] = center
  const z = clamp(Math.round(zoom), 13, 17)
  const tilesPerAxis = 2 ** z
  const latRad = clamp(lat, -85.05112878, 85.05112878) * (Math.PI / 180)
  const x = Math.floor((((lng + 180) / 360) * tilesPerAxis) % tilesPerAxis)
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * tilesPerAxis,
  )

  return {
    z,
    x: ((x % tilesPerAxis) + tilesPerAxis) % tilesPerAxis,
    y: clamp(y, 0, tilesPerAxis - 1),
  }
}

function getPreviewTileUrl(mode: PreviewMapMode, center: [number, number], zoom: number) {
  const { x, y, z } = lngLatToTile(center, zoom)
  const template = mode === 'satellite' ? SATELLITE_PREVIEW_TILE_URL : STREET_PREVIEW_TILE_URL
  return template
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

function BasemapPreviewTile({
  mode,
  className,
}: {
  mode: PreviewMapMode
  className: string
}) {
  const fixedPreviewView = FIXED_PREVIEW_VIEW[mode]
  const previewTileUrl = getPreviewTileUrl(mode, fixedPreviewView.center, fixedPreviewView.zoom)

  return (
    <div className={className}>
      <img
        src={previewTileUrl}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="h-full w-full object-cover object-center select-none"
      />
      <div className={`pointer-events-none absolute inset-0 ${
        mode === 'satellite'
          ? 'bg-[linear-gradient(180deg,rgba(12,24,20,0.06),rgba(10,18,15,0.22))]'
          : 'bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(226,232,240,0.16))]'
      }`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-5 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),transparent)]" />
    </div>
  )
}

export default function MapModeThumbnail({
  currentMode,
  onModeChange,
  map,
  onPanelToggle,
  sidebarOpen = false,
}: MapModeThumbnailProps) {
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
  const dockLeft = isTablet
    ? (sidebarOpen ? 'calc(min(22rem, 100vw - 1.5rem) + 0.75rem)' : '0.75rem')
    : (sidebarOpen ? 'calc(17rem + 0.75rem)' : '0.75rem')

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
  }, [panelOpen, setPanelOpen])

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

  return (
    <div
      ref={panelRef}
      className="absolute z-10 transition-[left] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
      style={{ left: dockLeft, bottom: 'var(--map-control-edge-offset-y)' }}
    >
      {/* Thumbnail button */}
      <button
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Basemap settings"
        {...tooltipAttrs({
          label: 'Change map style',
          description: 'Switch between street and satellite views.',
        })}
        className={`floating-control-trigger touch-active flex items-stretch rounded-[22px] p-0.5 text-left ${
          isTablet ? 'h-21 w-21' : 'h-17 w-17'
        } ${panelOpen ? 'border-white/85 ring-2 ring-brand/30 ring-offset-0' : ''}`}
      >
        <BasemapPreviewTile
          mode={current.value}
          className="relative flex h-full w-full overflow-hidden rounded-[19px] border border-white/45 bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),inset_0_-10px_18px_rgba(15,23,42,0.07)]"
        />
      </button>

      {/* Panel — Google Earth style basemap settings */}
      {panelOpen && (
        <div
          className={`${popupContainer} ${
            isTablet ? 'fixed bottom-28 w-80' : 'absolute left-0 bottom-20 w-72'
          } flex flex-col`}
          style={{
            left: isTablet ? dockLeft : undefined,
            maxHeight: isTablet ? 'calc(100vh - 8rem)' : 'calc(100vh - 6rem)',
          }}
        >
          {/* Header — always visible */}
          <div className={popupHeader}>
            <div className="min-w-0">
              <h3 className={popupHeaderTitle}>Basemap</h3>
              <p className={popupHeaderSubtitle}>Adjust map style and visible details</p>
            </div>
            <PopupCloseButton
              onClick={() => setPanelOpen(false)}
              isTablet={isTablet}
            />
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">

          {/* ── Type section ── */}
          <div className="px-4 pb-3 pt-3.5">
            <p className={popupSectionLabel}>Type</p>
            <div className="flex gap-2">
              {MAP_TYPES.map((mode) => {
                const active = currentMode === mode.value
                return (
                  <button
                    key={mode.value}
                    onClick={() => onModeChange(mode.value)}
                    className={`btn-press flex-1 overflow-hidden rounded-xl transition-all duration-150 ${
                      active
                        ? 'ring-2 ring-brand ring-offset-2 shadow-[0_6px_18px_-4px_rgba(75,108,167,0.38),0_2px_6px_-1px_rgba(75,108,167,0.22)]'
                        : 'ring-1 ring-slate-200/75 hover:-translate-y-px hover:ring-slate-300 hover:shadow-[0_4px_10px_rgba(15,23,42,0.06)]'
                    }`}
                  >
                    <BasemapPreviewTile
                      mode={mode.value}
                      className={`relative flex w-full overflow-hidden ${
                        isTablet ? 'h-14' : 'h-12'
                      }`}
                    />
                    <div className={`px-2 py-1.5 text-center text-[11px] font-semibold transition-colors duration-150 ${
                      active ? 'bg-brand/8 text-brand' : 'bg-white text-body/72'
                    }`}>
                      {mode.label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mx-4 border-t border-slate-200/55" />

          {/* ── Details section (layer toggles) ── */}
          <div className="px-4 pt-3 pb-2">
            <p className={popupSectionLabel}>Details</p>
            {layers.map((layer, i) => {
              const LayerIcon = DETAIL_ICONS[layer.id]
              const isChecked = visibleLayers[layer.id] || false
              return (
                <div key={layer.id}>
                  {i > 0 && <div className="border-t border-slate-200/40" />}
                  <button
                    onClick={() => handleLayerToggle(layer.id, layer.layerIds)}
                    aria-pressed={isChecked}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 ${
                      isChecked ? 'bg-brand/6' : 'hover:bg-slate-100/60'
                    } active:bg-brand-hover`}
                  >
                    {LayerIcon && (
                      <LayerIcon
                        size={isTablet ? 17 : 16}
                        strokeWidth={2}
                        style={{ color: isChecked ? layer.color : '#94a3b8' }}
                        className="shrink-0 transition-colors duration-150"
                      />
                    )}
                    <span className={`flex-1 text-left text-[12px] font-medium transition-colors duration-150 ${
                      isChecked ? 'text-heading' : 'text-body/85'
                    }`}>
                      {layer.label}
                    </span>
                    <PopupToggle checked={isChecked} readOnly />
                  </button>
                </div>
              )
            })}

            {/* Clean mode — toggle row */}
            <div className="border-t border-slate-200/40" />
            <button
              onClick={() => onModeChange(currentMode === 'clean' ? 'street' : 'clean')}
              aria-pressed={currentMode === 'clean'}
              className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 transition-colors duration-150 ${
                currentMode === 'clean' ? 'bg-brand/6' : 'hover:bg-slate-100/60'
              } active:bg-brand-hover`}
            >
              <FileText
                size={isTablet ? 17 : 16}
                strokeWidth={2}
                style={{ color: currentMode === 'clean' ? BRAND : '#94a3b8' }}
                className="shrink-0 transition-colors duration-150"
              />
              <div className="flex-1 text-left">
                <span className={`block text-[12px] font-medium transition-colors duration-150 ${
                  currentMode === 'clean' ? 'text-heading' : 'text-body/85'
                }`}>
                  Clean
                </span>
                <span className="block text-[10px] text-body/55">Hide all labels & roads</span>
              </div>
              <PopupToggle checked={currentMode === 'clean'} readOnly />
            </button>
          </div>

          </div>{/* end scrollable body */}
        </div>
      )}
    </div>
  )
}
