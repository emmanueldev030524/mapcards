import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { DrawMode } from '../types/project'
import { useIsTablet } from '../hooks/useMediaQuery'
import LocationSearch from './LocationSearch'
import type { LocationSelection } from './LocationSearch'
import {
  Road,
  Home,
  TreePine,
  LayoutGrid,
  MousePointer,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import BoundaryPolygonIcon from './icons/BoundaryPolygonIcon'

interface MapToolbarProps {
  activeMode: DrawMode
  onModeChange: (mode: DrawMode) => void
  hasBoundary: boolean
  onClearBoundary?: () => void
  onDrawUndo?: () => void
  onDrawRedo?: () => void
  onDrawFinish?: () => void
  getVertexCount?: () => number
  onLocationSelect?: (selection: LocationSelection) => void
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl+'

type ToolIcon = React.ComponentType<{ size?: number | string; strokeWidth?: number; className?: string }>
const TOOLS: { mode: DrawMode; label: string; Icon: ToolIcon; desc: string; shortcut?: string }[] = [
  { mode: 'boundary', label: 'Boundary', Icon: BoundaryPolygonIcon, desc: 'Draw territory boundary' },
  { mode: 'road', label: 'Road', Icon: Road, desc: 'Draw custom road' },
  { mode: 'house', label: 'House', Icon: Home, desc: 'Place house marker' },
  { mode: 'tree', label: 'Tree', Icon: TreePine, desc: 'Place tree / landmark' },
  { mode: 'bulkFill', label: 'Bulk Fill', Icon: LayoutGrid, desc: 'Place houses along a road' },
  { mode: 'select', label: 'Select', Icon: MousePointer, desc: 'Select & edit elements', shortcut: 'Esc' },
]

/* Tooltip with optional description and keyboard shortcut badge */
function Tip({ label, desc, shortcut, align = 'center' }: { label: string; desc?: string; shortcut?: string; align?: 'center' | 'end' }) {
  return (
    <span className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1 ${
      desc ? '-bottom-14' : '-bottom-9'
    } ${align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'}`}>
      <span className="flex items-center gap-1.5">
        {label}
        {shortcut && (
          <kbd className="rounded bg-white/15 px-1.5 py-px text-[10px] font-medium tracking-wide text-white/70">
            {shortcut}
          </kbd>
        )}
      </span>
      {desc && (
        <span className="mt-0.5 block text-[10px] font-normal text-white/55">{desc}</span>
      )}
    </span>
  )
}

/** Step-by-step hint for the active drawing/placement mode */
function getHintMessage(mode: DrawMode, vertexCount: number): string | null {
  switch (mode) {
    case 'boundary':
      if (vertexCount === 0) return 'Click points on the map to draw your boundary'
      if (vertexCount < 3) return `Keep clicking to add points (${vertexCount}/3 minimum)`
      return 'Click first point to close, or press Done'
    case 'road':
      if (vertexCount === 0) return 'Click points on the map to draw a road'
      if (vertexCount < 2) return 'Click to add another point'
      return 'Double-click or press Done to finish'
    case 'house':
      return 'Click on the map to place a house'
    case 'tree':
      return 'Click on the map to place a tree or landmark'
    case 'select':
      return 'Click on a house, tree, or road to edit it'
    default:
      return null
  }
}

/** Get tool metadata for the active mode */
function getActiveTool(mode: DrawMode) {
  return TOOLS.find((t) => t.mode === mode) || null
}

/* Shared button base — animation handled by .btn-press in CSS */
const btnBase = 'group relative flex items-center justify-center rounded-full outline-none btn-press'
const btnInteractive = 'hover:bg-black/6'
const btnFocusRing = 'focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1'

export default function MapToolbar({
  activeMode,
  onModeChange,
  hasBoundary,
  onClearBoundary,
  onDrawUndo,
  onDrawRedo,
  onDrawFinish,
  getVertexCount,
  onLocationSelect,
}: MapToolbarProps) {
  const isDrawing = activeMode === 'boundary' || activeMode === 'road'
  const isPlacing = activeMode === 'house' || activeMode === 'tree'
  const isTablet = useIsTablet()
  const btnSize = isTablet ? 'h-11 w-11' : 'h-9 w-9'
  const iconSize = isTablet ? 20 : 17
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  const undoAction = useStore((s) => s.undoAction)
  const redoAction = useStore((s) => s.redoAction)

  // Poll vertex count while drawing so the Done button enables/disables reactively
  const [vertexCount, setVertexCount] = useState(0)
  useEffect(() => {
    if (!isDrawing || !getVertexCount) { setVertexCount(0); return }
    const id = setInterval(() => setVertexCount(getVertexCount()), 200)
    return () => clearInterval(id)
  }, [isDrawing, getVertexCount])

  const canFinish = isDrawing && (
    (activeMode === 'boundary' && vertexCount >= 3) ||
    (activeMode === 'road' && vertexCount >= 2)
  )

  // Track scroll position for fade-edge indicators
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 2)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    checkScroll()
    el.addEventListener('scroll', checkScroll, { passive: true })
    const ro = new ResizeObserver(checkScroll)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', checkScroll)
      ro.disconnect()
    }
  }, [checkScroll])

  const hintMessage = getHintMessage(activeMode, vertexCount)
  const activeTool = getActiveTool(activeMode)

  return (
    <>
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
    <div
      role="toolbar"
      aria-label="Map drawing tools"
      className="relative flex max-w-[calc(100vw-1rem)] items-center rounded-full bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)] will-change-transform"
    >
      {/* Left fade edge */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 rounded-l-full bg-linear-to-r from-white/90 to-transparent" />
      )}

      {/* Scrollable inner */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-clip overflow-y-visible py-1.5 pl-2.5 pr-2"
      >
        {/* ── Search ── */}
        {onLocationSelect && (
          <>
            <div className={`shrink-0 ${isTablet ? 'w-48' : 'w-56'}`}>
              <LocationSearch onLocationSelect={onLocationSelect} compact />
            </div>
            {/* Vertical divider */}
            <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" />
          </>
        )}

        {/* ── History group ── */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/4 px-1 py-0.5">
          <button
            onClick={() => {
              if (isDrawing && onDrawUndo) onDrawUndo()
              else undoAction()
            }}
            disabled={!isDrawing && !canUndo}
            aria-label="Undo"
            className={`${btnBase} ${btnSize} ${btnFocusRing} ${
              isDrawing || canUndo
                ? `text-slate-700 ${btnInteractive}`
                : 'cursor-not-allowed text-slate-400'
            }`}
          >
            <Undo2 size={iconSize} strokeWidth={2} />
            {!activeMode && <Tip label="Undo" shortcut={`${MOD}Z`} />}
          </button>
          <button
            onClick={() => {
              if (isDrawing && onDrawRedo) onDrawRedo()
              else redoAction()
            }}
            disabled={!isDrawing && !canRedo}
            aria-label="Redo"
            className={`${btnBase} ${btnSize} ${btnFocusRing} ${
              isDrawing || canRedo
                ? `text-slate-700 ${btnInteractive}`
                : 'cursor-not-allowed text-slate-400'
            }`}
          >
            <Redo2 size={iconSize} strokeWidth={2} />
            {!activeMode && <Tip label="Redo" shortcut={`${MOD}⇧Z`} />}
          </button>
        </div>

        {/* Done — finishes drawing or exits placement mode */}
        {isDrawing && onDrawFinish && (
          <button
            onClick={onDrawFinish}
            disabled={!canFinish}
            aria-label={canFinish ? 'Finish drawing' : activeMode === 'boundary' ? 'Need at least 3 points' : 'Need at least 2 points'}
            className={`${btnBase} ${btnFocusRing} shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
              canFinish
                ? 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:bg-emerald-600'
                : 'cursor-not-allowed bg-black/4 text-slate-400'
            }`}
          >
            <span className="flex items-center gap-1">
              <Check size={isTablet ? 16 : 14} strokeWidth={2.5} />
              Done
              {vertexCount > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums ${
                  canFinish ? 'bg-white/25' : 'bg-black/8'
                }`}>
                  {vertexCount}
                </span>
              )}
            </span>
            {!activeMode && <Tip label="Finish" shortcut="Enter" />}
          </button>
        )}
        {isPlacing && (
          <button
            onClick={() => onModeChange(null)}
            aria-label="Done placing"
            className={`${btnBase} ${btnFocusRing} shrink-0 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:bg-emerald-600`}
          >
            <span className="flex items-center gap-1">
              <Check size={isTablet ? 16 : 14} strokeWidth={2.5} />
              Done
            </span>
            {!activeMode && <Tip label="Exit mode" shortcut="Esc" />}
          </button>
        )}

        {/* ── Divider dot ── */}
        <div className="mx-0.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />

        {/* ── Drawing tools group ── */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/4 px-1 py-0.5">
          {TOOLS.map(({ mode, label, Icon, desc, shortcut }) => {
            const isActive = activeMode === mode
            const isDisabledTool = mode === 'boundary' && hasBoundary

            return (
              <button
                key={mode}
                onClick={() => onModeChange(isActive ? null : mode)}
                disabled={isDisabledTool}
                aria-label={label}
                aria-pressed={isActive}
                className={`${btnBase} ${btnSize} ${btnFocusRing} ${
                  isActive
                    ? 'bg-brand text-white shadow-[0_2px_10px_rgba(75,108,167,0.35)]'
                    : isDisabledTool
                      ? 'cursor-not-allowed text-slate-400'
                      : `text-slate-700 ${btnInteractive}`
                }`}
              >
                <Icon size={iconSize} strokeWidth={isActive ? 2.2 : 2} />
                {!activeMode && <Tip label={label} desc={desc} shortcut={shortcut} />}
              </button>
            )
          })}
        </div>

        {/* ── Clear boundary ── */}
        {hasBoundary && onClearBoundary && (
          <button
            onClick={onClearBoundary}
            aria-label="Clear boundary"
            className={`${btnBase} shrink-0 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 ${btnFocusRing} ${btnSize}`}
          >
            <Trash2 size={iconSize} strokeWidth={2} />
            {!activeMode && <Tip label="Clear" shortcut="Del" align="end" />}
          </button>
        )}
      </div>

      {/* Right fade edge */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 rounded-r-full bg-linear-to-l from-white/90 to-transparent" />
      )}
    </div>
    </div>

    {/* Contextual helper card — top-right, replaces FloatingSettings during active mode */}
    {hintMessage && activeTool && (
      <div className={`absolute right-3 z-10 ${isTablet ? 'top-22' : 'top-14'}`}>
        <div className={`animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-divider/40 bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl ${
          isTablet ? 'w-72' : 'w-64'
        }`}>
          {/* Header row: icon + title + actions */}
          <div className="flex items-center gap-3 px-4 pt-3.5 pb-2">
            <div className={`flex shrink-0 items-center justify-center rounded-xl bg-brand text-white ${
              isTablet ? 'h-10 w-10' : 'h-9 w-9'
            }`}>
              <activeTool.Icon size={isTablet ? 20 : 18} strokeWidth={2} className="text-white" />
            </div>
            <span className="flex-1 text-[14px] font-bold text-heading">{activeTool.label}</span>
            {isDrawing && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); if (onDrawUndo) onDrawUndo() }}
                aria-label="Undo last point"
                className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 active:scale-90 ${
                  isTablet ? 'h-9 w-9' : 'h-8 w-8'
                }`}
              >
                <Undo2 size={isTablet ? 16 : 15} strokeWidth={2} />
              </button>
            )}
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); onModeChange(null) }}
              aria-label="Exit tool"
              className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 active:scale-90 ${
                isTablet ? 'h-9 w-9' : 'h-8 w-8'
              }`}
            >
              <X size={isTablet ? 16 : 15} strokeWidth={2} />
            </button>
          </div>
          {/* Description */}
          <div className="px-4 pb-3.5">
            <p className="text-[13px] leading-relaxed text-heading/80">{hintMessage}</p>
          </div>
        </div>
      </div>
    )}

    {/* Floating undo pill — tablet only, during drawing */}
    {isTablet && isDrawing && vertexCount > 0 && (
      <div className="absolute right-3 z-10" style={{ top: isTablet ? 'calc(5.5rem + 8.5rem)' : 'calc(3.5rem + 7rem)' }}>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); if (onDrawUndo) onDrawUndo() }}
          className="flex items-center gap-1.5 rounded-full border border-divider/40 bg-white/95 px-3.5 py-2 text-[12px] font-semibold text-slate-600 shadow-[0_4px_12px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-150 active:scale-90 active:bg-slate-50"
        >
          <Undo2 size={15} strokeWidth={2} />
          Undo point
        </button>
      </div>
    )}
    </>
  )
}
