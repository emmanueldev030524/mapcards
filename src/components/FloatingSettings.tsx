import { useState, useRef, useEffect } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useIsTablet } from '../hooks/useMediaQuery'
import { point } from '@turf/helpers'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import type maplibregl from 'maplibre-gl'
import Toolbar from './Toolbar'
import { useStore } from '../store'
import {
  popupContainer,
  popupHeader,
  popupHeaderTitle,
  popupHeaderSubtitle,
} from '../lib/popupStyles'
import PopupCloseButton from './PopupCloseButton'

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
    <div ref={panelRef} data-popup-safe-top="true" data-right-popup="true" className={`absolute right-3 z-10 ${isTablet ? 'top-22' : 'top-14'}`}>
      <div className={`${popupContainer} ${isTablet ? 'w-[min(16rem,calc(100vw-1.5rem))]' : 'w-[min(18rem,calc(100vw-1.5rem))]'}`}>
        {/* Header */}
        <div className={isTablet ? popupHeader.replace('px-4 py-3.5', 'px-3.5 py-3') : popupHeader}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`flex shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand ring-1 ring-brand/15 ${isTablet ? 'h-6 w-6' : 'h-7 w-7'}`}>
                <SlidersHorizontal size={isTablet ? 12 : 13} strokeWidth={2.2} />
              </span>
              <h3 className={popupHeaderTitle}>Settings</h3>
            </div>
            <p className={popupHeaderSubtitle}>Quick visual adjustments for the current territory.</p>
          </div>
          <PopupCloseButton
            onClick={() => setDismissed(true)}
            isTablet={isTablet}
          />
        </div>

        {/* Content */}
        <div className={`overflow-y-auto overscroll-contain ${isTablet ? 'max-h-[min(55vh,24rem)] px-3.5 py-3' : 'max-h-[min(70vh,32rem)] px-4 py-3.5'}`}>
          <Toolbar />
        </div>
      </div>
    </div>
  )
}
