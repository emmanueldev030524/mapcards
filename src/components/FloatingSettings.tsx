import { useState, useRef, useEffect } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { useIsTablet } from '../hooks/useMediaQuery'
import * as turf from '@turf/turf'
import type maplibregl from 'maplibre-gl'
import Toolbar from './Toolbar'
import { useStore } from '../store'

interface FloatingSettingsProps {
  map: maplibregl.Map | null
}

export default function FloatingSettings({ map }: FloatingSettingsProps) {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [settingsInteracted, setSettingsInteracted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const isTablet = useIsTablet()
  const prevModeRef = useRef<string | null>(null)

  const boundary = useStore((s) => s.boundary)
  const houseCount = useStore((s) => s.housePoints.length)
  const activeDrawMode = useStore((s) => s.activeDrawMode)

  const hasContent = boundary !== null || houseCount > 0
  const hasActiveMode = activeDrawMode !== null

  // Auto-open when boundary exists and no tool active (unless dismissed)
  useEffect(() => {
    if (hasActiveMode) {
      setOpen(false)
    } else if (hasContent && !dismissed) {
      setOpen(true)
    }
  }, [hasContent, hasActiveMode, dismissed])

  // When exiting any tool mode, reset dismissed and reopen (only if user hasn't interacted)
  useEffect(() => {
    const hadMode = prevModeRef.current !== null
    if (hadMode && !hasActiveMode && hasContent && !settingsInteracted) {
      setDismissed(false)
      setOpen(true)
    }
    prevModeRef.current = activeDrawMode
  }, [activeDrawMode, hasContent, hasActiveMode, settingsInteracted])

  // Reset when boundary removed
  useEffect(() => {
    if (!boundary) {
      setDismissed(false)
      setOpen(false)
      setSettingsInteracted(false)
    }
  }, [boundary])

  // Click outside panel to close + dismiss
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setDismissed(true)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // When dismissed, reopen only on clicks INSIDE the boundary
  useEffect(() => {
    if (!dismissed || !boundary || !map || hasActiveMode) return

    const handler = (e: maplibregl.MapMouseEvent) => {
      const pt = turf.point([e.lngLat.lng, e.lngLat.lat])
      if (turf.booleanPointInPolygon(pt, boundary)) {
        setDismissed(false)
        setOpen(true)
      }
    }

    map.on('click', handler)
    return () => { map.off('click', handler) }
  }, [dismissed, boundary, map, hasActiveMode])

  if (!open || !hasContent) return null

  return (
    <div ref={panelRef} className={`absolute right-3 z-10 ${isTablet ? 'top-22' : 'top-14'}`}>
      <div className="w-64 animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-divider/40 bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} strokeWidth={2} className="text-brand" />
            <h3 className="text-[13px] font-bold text-heading">Settings</h3>
          </div>
          <button
            onClick={() => { setOpen(false); setDismissed(true) }}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition-all duration-150 hover:bg-slate-200 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <div onPointerDown={() => setSettingsInteracted(true)}>
            <Toolbar />
          </div>
        </div>
      </div>
    </div>
  )
}
