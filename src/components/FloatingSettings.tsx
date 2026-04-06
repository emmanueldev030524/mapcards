import { useState, useRef, useEffect } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { useIsTablet } from '../hooks/useMediaQuery'
import { point } from '@turf/helpers'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type maplibregl from 'maplibre-gl'
import Toolbar from './Toolbar'
import { useStore } from '../store'

interface FloatingSettingsProps {
  map: maplibregl.Map | null
}

export default function FloatingSettings({ map }: FloatingSettingsProps) {
  const [dismissed, setDismissed] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const isTablet = useIsTablet()

  const boundary = useStore((s) => s.boundary)
  const houseCount = useStore((s) => s.housePoints.length)
  const activeDrawMode = useStore((s) => s.activeDrawMode)
  const selectedHouseId = useStore((s) => s.selectedHouseId)
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const selectedRoadId = useStore((s) => s.selectedRoadId)
  const selectedStartMarker = useStore((s) => s.selectedStartMarker)

  const hasContent = boundary !== null || houseCount > 0
  const hasActiveMode = activeDrawMode !== null
  const hasSelection =
    selectedHouseId !== null ||
    selectedTreeId !== null ||
    selectedRoadId !== null ||
    selectedStartMarker
  const open = hasContent && !hasSelection && !hasActiveMode && !dismissed

  // Click outside panel to close + dismiss
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setDismissed(true)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Reopen on empty-area click — only when panel is currently dismissed (closed).
  // Skips clicks on houses/trees/roads. Won't re-trigger while already open.
  useEffect(() => {
    if (!dismissed || !boundary || !map || hasActiveMode || hasSelection) return

    const handler = (e: maplibregl.MapMouseEvent) => {
      // Skip if click hit an element
      const hitLayers = ['house-icons', 'tree-icons', 'start-marker-pin', 'custom-roads-fill'].filter((l) => map.getLayer(l))
      if (hitLayers.length > 0) {
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 12, e.point.y - 12],
          [e.point.x + 12, e.point.y + 12],
        ]
        if (map.queryRenderedFeatures(bbox, { layers: hitLayers }).length > 0) return
      }

      const pt = point([e.lngLat.lng, e.lngLat.lat])
      if (booleanPointInPolygon(pt, boundary)) {
        setDismissed(false)
      }
    }

    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [dismissed, boundary, map, hasActiveMode, hasSelection])

  if (!open || !hasContent || hasSelection) return null

  return (
    <div ref={panelRef} className={`absolute right-3 z-10 ${isTablet ? 'top-22' : 'top-14'}`}>
      <div className="w-[min(18rem,calc(100vw-1.5rem))] animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden rounded-2xl border border-divider/40 bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {/* Header */}
        <div className="border-b border-divider/40 px-4 pb-2 pt-3.5">
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} strokeWidth={2} className="text-brand" />
              <h3 className="text-[13px] font-bold text-heading">Settings</h3>
            </div>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition-all duration-150 hover:bg-slate-200 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              <X size={16} strokeWidth={2.5} />
            </button>
          </div>
          <p className="pr-8 text-[11px] leading-relaxed text-body/65">
            Quick visual adjustments for the current territory.
          </p>
        </div>

        {/* Content */}
        <div className="max-h-[min(70vh,32rem)] overflow-y-auto px-4 pb-3 pt-3">
          <div className="space-y-3">
            <Toolbar />
          </div>
        </div>
      </div>
    </div>
  )
}
