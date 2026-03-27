import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import type { DrawMode } from '../types/project'
import {
  Hexagon,
  Route,
  Home,
  TreePine,
  LayoutGrid,
  MousePointer,
  Undo2,
  Redo2,
  Trash2,
  Check,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface MapToolbarProps {
  activeMode: DrawMode
  onModeChange: (mode: DrawMode) => void
  hasBoundary: boolean
  onClearBoundary?: () => void
  onDrawUndo?: () => void
  onDrawRedo?: () => void
  onDrawFinish?: () => void
  getVertexCount?: () => number
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)
const MOD = isMac ? '⌘' : 'Ctrl+'

const TOOLS: { mode: DrawMode; label: string; Icon: LucideIcon; desc: string; shortcut?: string }[] = [
  { mode: 'boundary', label: 'Boundary', Icon: Hexagon, desc: 'Draw territory boundary' },
  { mode: 'road', label: 'Road', Icon: Route, desc: 'Draw custom road' },
  { mode: 'house', label: 'House', Icon: Home, desc: 'Place house marker' },
  { mode: 'tree', label: 'Tree', Icon: TreePine, desc: 'Place tree / landmark' },
  { mode: 'bulkFill', label: 'Bulk Fill', Icon: LayoutGrid, desc: 'Place houses along a road' },
  { mode: 'select', label: 'Select', Icon: MousePointer, desc: 'Select & edit elements', shortcut: 'Esc' },
]

/* Tooltip with optional keyboard shortcut badge */
function Tip({ label, shortcut }: { label: string; shortcut?: string }) {
  return (
    <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-lg bg-slate-900/95 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0 translate-y-1">
      {label}
      {shortcut && (
        <kbd className="rounded bg-white/15 px-1.5 py-px text-[10px] font-medium tracking-wide text-white/70">
          {shortcut}
        </kbd>
      )}
    </span>
  )
}

/* Shared button base — animation handled by .btn-press in CSS */
const btnBase = 'group relative flex items-center justify-center rounded-full outline-none btn-press'
const btnSize = 'h-9 w-9'
const btnInteractive = 'hover:bg-black/[0.06]'
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
}: MapToolbarProps) {
  const isDrawing = activeMode === 'boundary' || activeMode === 'road'
  const isPlacing = activeMode === 'house' || activeMode === 'tree'
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

  return (
    <div
      role="toolbar"
      aria-label="Map drawing tools"
      className="absolute left-1/2 top-3 z-10 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center rounded-full border border-white/60 bg-white/90 shadow-[0_4px_16px_rgba(0,0,0,0.10),0_1px_3px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl will-change-transform"
    >
      {/* Left fade edge */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-6 rounded-l-full bg-linear-to-r from-white/90 to-transparent" />
      )}

      {/* Scrollable inner */}
      <div
        ref={scrollRef}
        className="scrollbar-hide flex items-center gap-1 overflow-x-auto overscroll-x-contain px-1.5 py-1.5"
      >
        {/* ── History group ── */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/[0.04] px-1 py-0.5">
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
                : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Undo2 size={17} strokeWidth={2} />
            <Tip label="Undo" shortcut={`${MOD}Z`} />
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
                : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Redo2 size={17} strokeWidth={2} />
            <Tip label="Redo" shortcut={`${MOD}⇧Z`} />
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
                : 'cursor-not-allowed bg-black/[0.04] text-slate-300'
            }`}
          >
            <span className="flex items-center gap-1">
              <Check size={14} strokeWidth={2.5} />
              Done
            </span>
            <Tip label="Finish" shortcut="Enter" />
          </button>
        )}
        {isPlacing && (
          <button
            onClick={() => onModeChange(null)}
            aria-label="Done placing"
            className={`${btnBase} ${btnFocusRing} shrink-0 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(16,185,129,0.25)] hover:bg-emerald-600`}
          >
            <span className="flex items-center gap-1">
              <Check size={14} strokeWidth={2.5} />
              Done
            </span>
            <Tip label="Exit mode" shortcut="Esc" />
          </button>
        )}

        {/* ── Divider dot ── */}
        <div className="mx-0.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />

        {/* ── Drawing tools group ── */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/[0.04] px-1 py-0.5">
          {TOOLS.map(({ mode, label, Icon, shortcut }) => {
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
                      ? 'cursor-not-allowed text-slate-300'
                      : `text-slate-700 ${btnInteractive}`
                }`}
              >
                <Icon size={17} strokeWidth={isActive ? 2.2 : 2} />
                {/* Active indicator dot */}
                {isActive && (
                  <span className="absolute -bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_4px_rgba(255,255,255,0.6)]" />
                )}
                <Tip label={label} shortcut={shortcut} />
              </button>
            )
          })}
        </div>

        {/* ── Clear boundary ── */}
        {hasBoundary && onClearBoundary && (
          <>
            <div className="mx-0.5 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
            <button
              onClick={onClearBoundary}
              aria-label="Clear boundary"
              className={`${btnBase} ${btnSize} ${btnFocusRing} shrink-0 text-slate-400 hover:bg-red-500/10 hover:text-red-500`}
            >
              <Trash2 size={17} strokeWidth={2} />
              <Tip label="Clear" shortcut="Del" />
            </button>
          </>
        )}
      </div>

      {/* Right fade edge */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-6 rounded-r-full bg-linear-to-l from-white/90 to-transparent" />
      )}
    </div>
  )
}
