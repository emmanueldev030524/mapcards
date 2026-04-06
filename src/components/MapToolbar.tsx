import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store'
import type { DrawMode } from '../types/project'
import { useIsTablet } from '../hooks/useMediaQuery'
import LocationSearch from './LocationSearch'
import type { LocationSelection } from './LocationSearch'
import {
  Road,
  Home,
  TreePine,
  Flag,
  LayoutGrid,
  MousePointer,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  Eye,
} from 'lucide-react'
import BoundaryPolygonIcon from './icons/BoundaryPolygonIcon'

interface MapToolbarProps {
  activeMode: DrawMode
  onModeChange: (mode: DrawMode) => void
  hasBoundary: boolean
  canReview?: boolean
  onReviewToggle?: () => void
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
  { mode: 'startMarker', label: 'Start', Icon: Flag, desc: 'Place the Start Here marker' },
  { mode: 'bulkFill', label: 'Bulk Fill', Icon: LayoutGrid, desc: 'Place houses along a road' },
  { mode: 'select', label: 'Select', Icon: MousePointer, desc: 'Select & edit elements', shortcut: 'Esc' },
]

interface HoverTipState {
  label: string
  desc?: string
  shortcut?: string
  left: number
  top: number
}

/* Tooltip with optional description and keyboard shortcut badge */
function Tip({ label, desc, shortcut }: { label: string; desc?: string; shortcut?: string }) {
  return (
    <div className="max-w-56 rounded-xl border border-slate-800/90 bg-slate-950/96 px-3 py-2 text-[11px] font-medium text-white shadow-[0_10px_24px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <span className="flex items-center gap-1.5">
        {label}
        {shortcut && (
          <kbd className="rounded bg-white/15 px-1.5 py-px text-[10px] font-medium tracking-wide text-white/70">
            {shortcut}
          </kbd>
        )}
      </span>
      {desc && (
        <span className="mt-0.5 block whitespace-normal text-[10px] font-normal leading-relaxed text-white/72">
          {desc}
        </span>
      )}
    </div>
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
    case 'startMarker':
      return 'Click inside the boundary to place or replace the Start Here marker'
    case 'select':
      return 'Click on a house, tree, road, or start marker to edit it'
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
const btnInteractive = 'hover:bg-slate-100/88'
const btnFocusRing = 'focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1'

export default function MapToolbar({
  activeMode,
  onModeChange,
  hasBoundary,
  canReview = false,
  onReviewToggle,
  onClearBoundary,
  onDrawUndo,
  onDrawRedo,
  onDrawFinish,
  getVertexCount,
  onLocationSelect,
}: MapToolbarProps) {
  const isDrawing = activeMode === 'boundary' || activeMode === 'road'
  const isPlacing = activeMode === 'house' || activeMode === 'tree' || activeMode === 'startMarker'
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
  const [tooltip, setTooltip] = useState<HoverTipState | null>(null)

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

  const showTooltip = useCallback((event: React.SyntheticEvent<HTMLElement>, next: Omit<HoverTipState, 'left' | 'top'>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    const viewportPadding = 16
    const left = Math.min(window.innerWidth - viewportPadding, Math.max(viewportPadding, center))
    const top = rect.bottom + 10
    setTooltip({ ...next, left, top })
  }, [])

  const hideTooltip = useCallback(() => {
    setTooltip(null)
  }, [])

  const getTooltipProps = useCallback(
    (next: Omit<HoverTipState, 'left' | 'top'>) => ({
      onMouseEnter: (event: React.MouseEvent<HTMLElement>) => showTooltip(event, next),
      onMouseLeave: hideTooltip,
      onFocus: (event: React.FocusEvent<HTMLElement>) => showTooltip(event, next),
      onBlur: hideTooltip,
    }),
    [hideTooltip, showTooltip],
  )

  const hintMessage = getHintMessage(activeMode, vertexCount)
  const activeTool = getActiveTool(activeMode)

  return (
    <>
    <div className="absolute left-1/2 top-3 z-10 w-[calc(100%-1rem)] max-w-max -translate-x-1/2">
    <div className="pointer-events-none absolute inset-x-10 -inset-y-1 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.72),transparent_68%)] blur-xl" />
    <div className="pointer-events-none absolute inset-x-14 top-0 h-5 rounded-full bg-white/52 blur-md" />
    <div
      role="toolbar"
      aria-label="Map drawing tools"
      className="relative flex w-full max-w-[calc(100vw-1rem)] items-center overflow-hidden rounded-full border border-slate-200/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(247,249,252,0.94))] shadow-[0_18px_40px_rgba(15,23,42,0.2),0_6px_16px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur-[22px] will-change-transform"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.46),transparent_36%,rgba(255,255,255,0.24)_68%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/90" />
      {/* Left fade edge */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-7 rounded-l-full bg-linear-to-r from-white via-white/70 to-transparent" />
      )}

      {/* Scrollable inner */}
      <div
        ref={scrollRef}
        className="scrollbar-hide relative flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-visible py-1.5 pl-2.5 pr-2"
      >
        {/* ── Search ── */}
        {onLocationSelect && (
          <>
            <div className={`shrink-0 ${isTablet ? 'w-[min(12rem,34vw)]' : 'w-56'}`}>
              <LocationSearch onLocationSelect={onLocationSelect} compact />
            </div>
            {/* Vertical divider */}
            <div className="mx-0.5 h-5 w-px shrink-0 bg-slate-300/85" />
          </>
        )}

        {/* ── History group ── */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200/85 bg-white/84 px-1 py-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.78)]">
          <button
            onClick={() => {
              if (isDrawing && onDrawUndo) onDrawUndo()
              else undoAction()
            }}
            disabled={!isDrawing && !canUndo}
            aria-label="Undo"
            title="Undo"
            {...getTooltipProps({ label: 'Undo', shortcut: `${MOD}Z` })}
            className={`${btnBase} ${btnSize} ${btnFocusRing} ${
              isDrawing || canUndo
                ? `text-slate-700 ${btnInteractive}`
                : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Undo2 size={iconSize} strokeWidth={2} />
          </button>
          <button
            onClick={() => {
              if (isDrawing && onDrawRedo) onDrawRedo()
              else redoAction()
            }}
            disabled={!isDrawing && !canRedo}
            aria-label="Redo"
            title="Redo"
            {...getTooltipProps({ label: 'Redo', shortcut: `${MOD}⇧Z` })}
            className={`${btnBase} ${btnSize} ${btnFocusRing} ${
              isDrawing || canRedo
                ? `text-slate-700 ${btnInteractive}`
                : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <Redo2 size={iconSize} strokeWidth={2} />
          </button>
        </div>

        {/* Done — finishes drawing or exits placement mode */}
        {isDrawing && onDrawFinish && (
          <button
            onClick={onDrawFinish}
            disabled={!canFinish}
            aria-label={canFinish ? 'Finish drawing' : activeMode === 'boundary' ? 'Need at least 3 points' : 'Need at least 2 points'}
            title={canFinish ? 'Finish drawing' : activeMode === 'boundary' ? 'Need at least 3 points' : 'Need at least 2 points'}
            {...getTooltipProps({ label: 'Finish', shortcut: 'Enter' })}
            className={`${btnBase} ${btnFocusRing} shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold ${
              canFinish
                ? 'bg-emerald-500 text-white shadow-[0_6px_14px_rgba(16,185,129,0.24)] hover:bg-emerald-600'
                : 'cursor-not-allowed bg-slate-100 text-slate-400'
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
          </button>
        )}
        {isPlacing && (
          <button
            onClick={() => onModeChange(null)}
            aria-label="Done placing"
            title="Done placing"
            {...getTooltipProps({ label: 'Exit mode', shortcut: 'Esc' })}
            className={`${btnBase} ${btnFocusRing} shrink-0 rounded-full bg-emerald-500 px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_6px_14px_rgba(16,185,129,0.24)] hover:bg-emerald-600`}
          >
            <span className="flex items-center gap-1">
              <Check size={isTablet ? 16 : 14} strokeWidth={2.5} />
              Done
            </span>
          </button>
        )}

        {/* ── Divider dot ── */}
        <div className="mx-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400/85 shadow-[0_0_0_3px_rgba(255,255,255,0.55)]" />

        {/* ── Drawing tools group ── */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200/85 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(242,246,251,0.76))] px-1 py-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.84)]">
          {TOOLS.map(({ mode, label, Icon, desc, shortcut }) => {
            const isActive = activeMode === mode
            const isDisabledTool =
              (mode === 'boundary' && hasBoundary) ||
              (mode === 'startMarker' && !hasBoundary)
            const toolClass = isTablet ? 'h-11 w-11' : 'h-9 w-9'

            return (
              <button
                key={mode}
                onClick={() => onModeChange(isActive ? null : mode)}
                disabled={isDisabledTool}
                aria-label={label}
                aria-pressed={isActive}
                title={isDisabledTool ? (mode === 'startMarker' ? 'Draw a boundary first' : 'Boundary already exists') : desc}
                {...getTooltipProps({
                  label,
                  desc: isDisabledTool && mode === 'startMarker' ? 'Draw a boundary before placing a Start Here marker.' : desc,
                  shortcut,
                })}
                className={`${btnBase} ${toolClass} ${btnFocusRing} gap-2 ${
                  isActive
                    ? 'bg-brand text-white shadow-[0_2px_10px_rgba(75,108,167,0.35)]'
                    : isDisabledTool
                      ? 'cursor-not-allowed text-slate-300'
                      : `text-slate-700 ${btnInteractive}`
                }`}
              >
                <Icon size={iconSize} strokeWidth={isActive ? 2.2 : 2} />
              </button>
            )
          })}
        </div>

        {(canReview || (hasBoundary && onClearBoundary)) && (
          <div className="flex shrink-0 items-center gap-0.5 rounded-full border border-slate-200/85 bg-white/84 px-1 py-0.5 shadow-[0_1px_2px_rgba(15,23,42,0.03),inset_0_1px_0_rgba(255,255,255,0.78)]">
            {canReview && onReviewToggle && (
              <button
                onClick={onReviewToggle}
                aria-label="Review map"
                title="Review map"
                {...getTooltipProps({ label: 'Review', desc: 'Preview the territory without editing chrome.' })}
                className={`${btnBase} ${btnSize} ${btnFocusRing} text-slate-700 ${btnInteractive}`}
              >
                <Eye size={iconSize} strokeWidth={2} />
              </button>
            )}

            {hasBoundary && onClearBoundary && (
              <button
                onClick={onClearBoundary}
                aria-label="Clear boundary"
                title="Clear boundary"
                {...getTooltipProps({ label: 'Clear boundary', shortcut: 'Del' })}
                className={`${btnBase} ${btnSize} ${btnFocusRing} text-red-500 hover:bg-red-50 hover:text-red-600`}
              >
                <Trash2 size={iconSize} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Right fade edge */}
      {canScrollRight && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-7 rounded-r-full bg-linear-to-l from-white via-white/70 to-transparent" />
      )}
    </div>
    </div>

    {/* Contextual helper card — top-right, replaces FloatingSettings during active mode */}
    {hintMessage && activeTool && (
      <div className={`absolute right-3 z-10 ${isTablet ? 'top-22' : 'top-14'}`}>
        <div className={`animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-slate-200/90 bg-white/97 shadow-[0_18px_40px_rgba(15,23,42,0.18),0_6px_16px_rgba(15,23,42,0.08)] backdrop-blur-xl ${
          isTablet ? 'w-[min(18rem,calc(100vw-1.5rem))]' : 'w-64'
        }`}>
          {/* Header row: icon + title + actions */}
          <div className="flex items-center gap-3 border-b border-slate-200/75 bg-slate-50/75 px-4 pt-3.5 pb-3">
            <div className={`flex shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-[0_8px_18px_rgba(75,108,167,0.24)] ${
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
                className={`flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-90 ${
                  isTablet ? 'h-9 w-9' : 'h-8 w-8'
                }`}
              >
                <Undo2 size={isTablet ? 16 : 15} strokeWidth={2} />
              </button>
            )}
            {isPlacing && canUndo && (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); undoAction() }}
                aria-label="Undo last placement"
                className={`flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-90 ${
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
              className={`flex items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 active:scale-90 ${
                isTablet ? 'h-9 w-9' : 'h-8 w-8'
              }`}
            >
              <X size={isTablet ? 16 : 15} strokeWidth={2} />
            </button>
          </div>
          {/* Description */}
          <div className="px-4 py-3.5">
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/78 px-3 py-2.5">
              <p className="text-[13px] leading-relaxed text-slate-700">{hintMessage}</p>
            </div>
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
          className="flex items-center gap-1.5 rounded-full border border-slate-200/85 bg-white/97 px-3.5 py-2 text-[12px] font-semibold text-slate-700 shadow-[0_10px_20px_rgba(15,23,42,0.12)] backdrop-blur-xl transition-all duration-150 active:scale-90 active:bg-slate-50"
        >
          <Undo2 size={15} strokeWidth={2} />
          Undo point
        </button>
      </div>
    )}

    {tooltip && createPortal(
      <div
        className="pointer-events-none fixed z-[90] -translate-x-1/2"
        style={{ left: tooltip.left, top: tooltip.top }}
      >
        <Tip label={tooltip.label} desc={tooltip.desc} shortcut={tooltip.shortcut} />
      </div>,
      document.body,
    )}
    </>
  )
}
