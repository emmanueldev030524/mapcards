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
  Flag,
  MousePointer,
  Undo2,
  Redo2,
  Trash2,
  Check,
  X,
  Eye,
} from 'lucide-react'
import BoundaryPolygonIcon from './icons/BoundaryPolygonIcon'
import { tooltipAttrs, tooltipTargetAttrs } from '../lib/tooltips'

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
type ToolBehavior = 'multi-step-drawing' | 'single-placement' | 'selection'
const TOOLS: { mode: DrawMode; label: string; Icon: ToolIcon; desc: string; shortcut?: string }[] = [
  { mode: 'boundary', label: 'Boundary', Icon: BoundaryPolygonIcon, desc: 'Draw territory boundary' },
  { mode: 'road', label: 'Road', Icon: Road, desc: 'Draw custom road' },
  { mode: 'house', label: 'House', Icon: Home, desc: 'Place house marker' },
  { mode: 'tree', label: 'Tree', Icon: TreePine, desc: 'Place tree / landmark' },
  { mode: 'startMarker', label: 'Start', Icon: Flag, desc: 'Place the Start Here marker' },
  { mode: 'select', label: 'Select', Icon: MousePointer, desc: 'Select & edit elements', shortcut: 'Esc' },
]

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

function getToolBehavior(mode: DrawMode): ToolBehavior | null {
  switch (mode) {
    case 'boundary':
    case 'road':
      return 'multi-step-drawing'
    case 'house':
    case 'tree':
    case 'startMarker':
      return 'single-placement'
    case 'select':
      return 'selection'
    default:
      return null
  }
}

/* Shared button base — animation handled by .btn-press in CSS */
const btnBase = 'group relative flex items-center justify-center rounded-full outline-none btn-press'
const btnShell = 'border border-white/34 bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(244,247,251,0.24))] text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.68)]'
// Keep tooltip triggers on a stable box. Hover translate made the button move
// after the tooltip had already measured, which read as a wobble in fast passes.
const btnInteractive = 'hover:border-brand/20 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.78),rgba(239,244,252,0.52))] hover:text-brand hover:shadow-[0_10px_18px_-16px_rgba(75,108,167,0.24),0_4px_8px_-8px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.86)]'
const btnFocusRing = 'focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1'
const btnDisabled = 'cursor-not-allowed border border-white/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.22),rgba(244,247,251,0.14))] text-slate-300/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)]'
const btnActive = 'scale-[1.04] border-brand/24 bg-[linear-gradient(180deg,rgba(248,250,254,0.98),rgba(233,240,250,0.96))] text-brand ring-1 ring-inset ring-white/46 shadow-[0_14px_24px_-16px_rgba(75,108,167,0.34),0_6px_12px_-10px_rgba(75,108,167,0.2),inset_0_1px_0_rgba(255,255,255,0.94)]'
const btnDanger = 'border border-rose-200/72 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,241,242,0.9))] text-rose-600 shadow-[0_10px_20px_-18px_rgba(244,63,94,0.3),0_4px_8px_-6px_rgba(15,23,42,0.1),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-rose-300/80 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(255,228,230,0.94))] hover:text-rose-700 hover:shadow-[0_14px_24px_-16px_rgba(244,63,94,0.34),0_6px_10px_-8px_rgba(244,63,94,0.18),inset_0_1px_0_rgba(255,255,255,0.96)]'
// Secondary group container — history + review clusters. Thinner glass,
// subordinate weight so the primary drawing-tools cluster reads as hero.
const groupContainer = 'flex shrink-0 items-center gap-0.5 rounded-full border border-white/66 bg-[linear-gradient(180deg,rgba(255,255,255,0.74),rgba(244,247,252,0.58))] px-1 py-0.5 shadow-[0_10px_18px_-18px_rgba(15,23,42,0.22),inset_0_1px_0_rgba(255,255,255,0.82),inset_0_-1px_0_rgba(255,255,255,0.16)] backdrop-blur-sm'
// Primary group container — drawing tools cluster. Denser glass and a
// stronger inset highlight so it reads as the hero of the toolbar.
const primaryGroupContainer = 'flex shrink-0 items-center gap-0.5 rounded-full border border-white/82 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(244,247,252,0.72))] px-1 py-0.5 shadow-[0_14px_24px_-20px_rgba(15,23,42,0.24),0_4px_10px_-10px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.94),inset_0_-1px_0_rgba(255,255,255,0.18)] backdrop-blur-sm'

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
  // On tablet, the helper popup already explains each tool — tooltips are
  // redundant and visually compete with the popup. Suppress by not emitting
  // data-tooltip attributes. aria-label stays for accessibility.
  const tip: typeof tooltipAttrs = isTablet ? () => ({}) : tooltipAttrs
  const btnSize = isTablet ? 'h-10 w-10' : 'h-9 w-9'
  const iconSize = isTablet ? 18 : 17
  const canUndo = useStore((s) => s.canUndo)
  const canRedo = useStore((s) => s.canRedo)
  const undoAction = useStore((s) => s.undoAction)
  const redoAction = useStore((s) => s.redoAction)
  const houseCount = useStore((s) => s.housePoints.length)
  const treeCount = useStore((s) => s.treePoints.length)
  const startMarker = useStore((s) => s.startMarker)

  // Poll vertex count while drawing so the Done button enables/disables reactively
  const [vertexCount, setVertexCount] = useState(0)
  useEffect(() => {
    if (!isDrawing || !getVertexCount) return
    const id = setInterval(() => setVertexCount(getVertexCount()), 200)
    return () => clearInterval(id)
  }, [isDrawing, getVertexCount])
  const displayedVertexCount = isDrawing ? vertexCount : 0

  const canFinish = isDrawing && (
    (activeMode === 'boundary' && displayedVertexCount >= 3) ||
    (activeMode === 'road' && displayedVertexCount >= 2)
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

  const hintMessage = getHintMessage(activeMode, displayedVertexCount)
  const activeTool = getActiveTool(activeMode)
  const activeToolBehavior = getToolBehavior(activeMode)
  const [singlePlacementBaseline, setSinglePlacementBaseline] = useState<{
    mode: DrawMode
    houseCount: number
    treeCount: number
    startMarker: ReturnType<typeof useStore.getState>['startMarker']
  } | null>(null)

  const placementCount =
    activeToolBehavior !== 'single-placement' || !singlePlacementBaseline
      ? 0
      : activeMode === 'house'
        ? Math.max(0, houseCount - singlePlacementBaseline.houseCount)
        : activeMode === 'tree'
          ? Math.max(0, treeCount - singlePlacementBaseline.treeCount)
          : activeMode === 'startMarker'
            ? (startMarker !== null && startMarker !== singlePlacementBaseline.startMarker ? 1 : 0)
            : 0

  const showDoneButton =
    (activeToolBehavior === 'multi-step-drawing' && displayedVertexCount > 0) ||
    (activeToolBehavior === 'single-placement' && placementCount > 0)
  const doneAriaLabel = isDrawing
    ? (canFinish ? 'Finish drawing' : activeMode === 'boundary' ? 'Need at least 3 points' : 'Need at least 2 points')
    : 'Done placing'
  const handleDone = useCallback(() => {
    if (isDrawing) {
      if (canFinish && onDrawFinish) onDrawFinish()
      return
    }
    if (isPlacing) {
      setSinglePlacementBaseline(null)
      onModeChange(null)
    }
  }, [canFinish, isDrawing, isPlacing, onDrawFinish, onModeChange])

  const handleToolToggle = useCallback((mode: DrawMode) => {
    const nextMode = activeMode === mode ? null : mode
    if (getToolBehavior(nextMode) === 'single-placement') {
      // Capture the session baseline at activation time so Done only appears
      // after a fresh placement, not because matching markers already existed.
      setSinglePlacementBaseline({
        mode: nextMode,
        houseCount,
        treeCount,
        startMarker,
      })
    } else {
      setSinglePlacementBaseline(null)
    }
    onModeChange(nextMode)
  }, [activeMode, houseCount, onModeChange, startMarker, treeCount])

  return (
    <>
    <div data-popup-safe-top="true" className="absolute left-1/2 top-3 z-10 w-[calc(100%-1rem)] max-w-max -translate-x-1/2">
    <div className="pointer-events-none absolute inset-x-10 -inset-y-1 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.72),transparent_68%)] blur-xl" />
    <div className="pointer-events-none absolute inset-x-14 top-0 h-5 rounded-full bg-white/52 blur-md" />
    <div
      role="toolbar"
      aria-label="Map drawing tools"
      className="relative flex w-full max-w-[calc(100vw-1rem)] items-center overflow-hidden rounded-full border border-white/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(247,249,252,0.72))] shadow-[0_28px_56px_-16px_rgba(15,23,42,0.26),0_12px_28px_-10px_rgba(15,23,42,0.16),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95),inset_0_-1px_0_rgba(255,255,255,0.22)] backdrop-blur-[28px] backdrop-saturate-150 will-change-transform"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.5),transparent_38%,rgba(255,255,255,0.22)_72%,transparent)]" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-white/92" />
      {/* Left fade edge */}
      {canScrollLeft && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-7 rounded-l-full bg-linear-to-r from-white via-white/70 to-transparent" />
      )}

      {/* Scrollable inner */}
      <div
        ref={scrollRef}
        className={`scrollbar-hide relative flex min-w-0 items-center gap-1 overflow-x-auto overflow-y-visible pl-2.5 pr-2 ${isTablet ? 'py-1' : 'py-1.5'}`}
      >
        {/* ── Search ── */}
        {onLocationSelect && (
          <>
            <div className={`shrink-0 ${isTablet ? 'w-[min(12rem,34vw)]' : 'w-56'}`}>
              <LocationSearch onLocationSelect={onLocationSelect} compact />
            </div>
            {/* Vertical divider */}
            <div className={`mx-1 w-px shrink-0 bg-linear-to-b from-transparent via-slate-300/75 to-transparent ${isTablet ? 'h-5' : 'h-6'}`} />
          </>
        )}

        {/* ── History group ── */}
        <div className={groupContainer}>
          <button
            onClick={() => {
              if (isDrawing && onDrawUndo) onDrawUndo()
              else undoAction()
            }}
            disabled={!isDrawing && !canUndo}
            aria-label="Undo"
            {...tip({ label: 'Go back one step', shortcut: `${MOD}Z` })}
            className={`${btnBase} ${btnSize} ${btnFocusRing} ${
              isDrawing || canUndo
                ? `${btnShell} ${btnInteractive}`
                : btnDisabled
            }`}
          >
            <Undo2 size={iconSize} strokeWidth={2.15} />
          </button>
          <button
            onClick={() => {
              if (isDrawing && onDrawRedo) onDrawRedo()
              else redoAction()
            }}
            disabled={!isDrawing && !canRedo}
            aria-label="Redo"
            {...tip({ label: 'Redo the last step', shortcut: `${MOD}⇧Z` })}
            className={`${btnBase} ${btnSize} ${btnFocusRing} ${
              isDrawing || canRedo
                ? `${btnShell} ${btnInteractive}`
                : btnDisabled
            }`}
          >
            <Redo2 size={iconSize} strokeWidth={2.15} />
          </button>
        </div>

        {/* ── Section divider (hairline) ── */}
        <div className={`mx-1 w-px shrink-0 bg-linear-to-b from-transparent via-slate-300/75 to-transparent ${isTablet ? 'h-5' : 'h-6'}`} />

        {/* ── Drawing tools group (primary / hero) ── */}
        <div className={primaryGroupContainer}>
          {TOOLS.map(({ mode, label, Icon, desc, shortcut }) => {
            const isActive = activeMode === mode
            const isDisabledTool =
              (mode === 'boundary' && hasBoundary) ||
              (mode === 'startMarker' && !hasBoundary)
            const toolClass = isTablet ? 'h-10 w-10' : 'h-9 w-9'

            return (
              <button
                key={mode}
                onClick={() => handleToolToggle(mode)}
                disabled={isDisabledTool}
                aria-label={label}
                aria-pressed={isActive}
                {...(isTablet ? {} : tooltipTargetAttrs(`toolbar-tool-${mode}`))}
                {...tip({
                  label:
                    mode === 'boundary' ? 'Draw boundary' :
                    mode === 'road' ? 'Draw road' :
                    mode === 'house' ? 'Add a house' :
                    mode === 'tree' ? 'Add a tree or landmark' :
                    mode === 'startMarker' ? 'Add Start Here marker' :
                    'Select and edit items',
                  description: isDisabledTool && mode === 'startMarker' ? 'Draw a boundary before placing the Start Here marker.' : desc,
                  shortcut,
                })}
                className={`${btnBase} ${toolClass} ${btnFocusRing} gap-2 ${
                  isActive
                    ? btnActive
                    : isDisabledTool
                      ? btnDisabled
                      : `${btnShell} ${btnInteractive}`
                }`}
              >
                <Icon size={iconSize} strokeWidth={isActive ? 2.35 : 2.2} />
              </button>
            )
          })}
        </div>

        {(canReview || (hasBoundary && onClearBoundary)) && (
          <>
            <div className={`mx-1 w-px shrink-0 bg-linear-to-b from-transparent via-slate-300/75 to-transparent ${isTablet ? 'h-5' : 'h-6'}`} />
            <div className={groupContainer}>
            {canReview && onReviewToggle && (
              <button
                onClick={onReviewToggle}
                aria-label="Review map"
                {...tip({ label: 'Preview your card', description: 'See the territory without editing controls.' })}
                className={`${btnBase} ${btnSize} ${btnFocusRing} ${btnShell} ${btnInteractive}`}
              >
                <Eye size={iconSize} strokeWidth={2.2} />
              </button>
            )}

            {hasBoundary && onClearBoundary && (
              <button
                onClick={onClearBoundary}
                aria-label="Clear boundary"
                {...tip({ label: 'Clear the map', description: 'Remove the boundary and everything inside it.', shortcut: 'Del' })}
                className={`${btnBase} ${btnSize} ${btnFocusRing} ${btnDanger}`}
              >
                <Trash2 size={iconSize} strokeWidth={2.2} />
              </button>
            )}
            </div>
          </>
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
      <div data-popup-safe-top="true" className={`absolute right-3 z-10 ${isTablet ? 'top-19' : 'top-14'}`}>
        <div className={`animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/97 shadow-[0_18px_40px_rgba(15,23,42,0.18),0_6px_16px_rgba(15,23,42,0.08)] backdrop-blur-xl ${
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
          {showDoneButton && (
            <div className="border-t border-slate-200/75 px-4 pt-3 pb-4">
              {/* Done belongs to the active tool card, not the canvas. Reusing the
                  brand CTA keeps the action visually tied to the current flow. */}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); handleDone() }}
                disabled={isDrawing ? !canFinish : false}
                aria-label={doneAriaLabel}
                className="sidebar-primary-button flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full px-3.5 py-2.5 text-[13px] font-semibold tracking-[0.01em] text-white disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:filter-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1 focus-visible:outline-none"
              >
                <Check size={isTablet ? 16 : 14} strokeWidth={2.5} />
                Done
                {isDrawing && displayedVertexCount > 0 && (
                  <span className="rounded-full bg-white/18 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
                    {displayedVertexCount}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    )}

    {/* Floating undo pill — tablet only, during drawing */}
    {isTablet && isDrawing && displayedVertexCount > 0 && (
      <div data-popup-safe-top="true" className="absolute right-3 z-10" style={{ top: isTablet ? 'calc(5.5rem + 8.5rem)' : 'calc(3.5rem + 7rem)' }}>
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
    </>
  )
}
