import { useState, useRef, useEffect } from 'react'
import { X, SlidersHorizontal } from 'lucide-react'
import { useIsTablet } from '../hooks/useMediaQuery'
import Toolbar from './Toolbar'
import { useStore } from '../store'

export default function FloatingSettings() {
  const [open, setOpen] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const isTablet = useIsTablet()
  const prevModeRef = useRef<string | null>(null)

  const boundary = useStore((s) => s.boundary)
  const houseCount = useStore((s) => s.housePoints.length)
  const activeDrawMode = useStore((s) => s.activeDrawMode)

  const hasContent = boundary !== null || houseCount > 0
  const isDrawing = activeDrawMode === 'boundary' || activeDrawMode === 'road'

  // Auto-open when boundary exists and not drawing (unless dismissed)
  useEffect(() => {
    if (isDrawing) {
      setOpen(false)
    } else if (hasContent && !dismissed) {
      setOpen(true)
    }
  }, [hasContent, isDrawing, dismissed])

  // When finishing a draw, reset dismissed and reopen
  useEffect(() => {
    const wasDrawing = prevModeRef.current === 'boundary' || prevModeRef.current === 'road'
    if (wasDrawing && !isDrawing && hasContent) {
      setDismissed(false)
      setOpen(true)
    }
    prevModeRef.current = activeDrawMode
  }, [activeDrawMode, hasContent, isDrawing])

  // Reset when boundary removed
  useEffect(() => {
    if (!boundary) {
      setDismissed(false)
      setOpen(false)
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

  // When dismissed, listen for clicks on the map canvas to reopen
  useEffect(() => {
    if (!dismissed || !hasContent || isDrawing) return

    const canvas = document.querySelector('.maplibregl-canvas') as HTMLElement
    if (!canvas) return

    const handler = () => {
      setDismissed(false)
      setOpen(true)
    }

    canvas.addEventListener('click', handler)
    canvas.addEventListener('touchend', handler)
    return () => {
      canvas.removeEventListener('click', handler)
      canvas.removeEventListener('touchend', handler)
    }
  }, [dismissed, hasContent, isDrawing])

  if (!open || !hasContent) return null

  return (
    <div ref={panelRef} className="absolute right-3 top-14 z-10">
      <div className={`animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-divider/40 bg-white/95 shadow-[0_12px_40px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.04)] backdrop-blur-xl ${
        isTablet ? 'w-72' : 'w-64'
      }`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={14} strokeWidth={2} className="text-brand" />
            <h3 className="text-[13px] font-bold text-heading">Settings</h3>
          </div>
          <button
            onClick={() => { setOpen(false); setDismissed(true) }}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-150 hover:bg-slate-200 hover:text-slate-700 active:scale-90"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 pb-3">
          <Toolbar />
        </div>
      </div>
    </div>
  )
}
