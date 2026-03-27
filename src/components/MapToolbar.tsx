import { useState, useEffect } from 'react'
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

const TOOLS: { mode: DrawMode; label: string; Icon: LucideIcon; desc: string }[] = [
  { mode: 'boundary', label: 'Boundary', Icon: Hexagon, desc: 'Draw territory boundary' },
  { mode: 'road', label: 'Road', Icon: Route, desc: 'Draw custom road' },
  { mode: 'house', label: 'House', Icon: Home, desc: 'Place house marker' },
  { mode: 'tree', label: 'Tree', Icon: TreePine, desc: 'Place tree / landmark' },
  { mode: 'bulkFill', label: 'Bulk Fill', Icon: LayoutGrid, desc: 'Place houses along a road' },
  { mode: 'select', label: 'Select', Icon: MousePointer, desc: 'Select & edit elements' },
]

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

  return (
    <div
      className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-2xl border border-white/50 bg-white/85 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] backdrop-blur-xl will-change-transform"
    >
      {/* History: Undo / Redo */}
      <button
        onClick={() => {
          if (isDrawing && onDrawUndo) onDrawUndo()
          else undoAction()
        }}
        disabled={!isDrawing && !canUndo}
        title="Undo (Ctrl+Z)"
        className={`group relative rounded-xl p-2.5 transition-all duration-200 outline-none ${
          isDrawing || canUndo
            ? 'text-slate-800 hover:bg-slate-800/8 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.92]'
            : 'cursor-not-allowed text-slate-300'
        }`}
      >
        <Undo2 size={18} strokeWidth={2} />
        <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Undo
        </span>
      </button>
      <button
        onClick={() => {
          if (isDrawing && onDrawRedo) onDrawRedo()
          else redoAction()
        }}
        disabled={!isDrawing && !canRedo}
        title="Redo (Ctrl+Shift+Z)"
        className={`group relative rounded-xl p-2.5 transition-all duration-200 outline-none ${
          isDrawing || canRedo
            ? 'text-slate-800 hover:bg-slate-800/8 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.92]'
            : 'cursor-not-allowed text-slate-300'
        }`}
      >
        <Redo2 size={18} strokeWidth={2} />
        <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          Redo
        </span>
      </button>

      {/* Done — finishes drawing or exits placement mode */}
      {isDrawing && onDrawFinish && (
        <button
          onClick={onDrawFinish}
          disabled={!canFinish}
          title={canFinish ? 'Finish drawing' : activeMode === 'boundary' ? 'Need at least 3 points' : 'Need at least 2 points'}
          className={`group relative rounded-xl px-3 py-1.5 text-[12px] font-semibold transition-all duration-200 outline-none ${
            canFinish
              ? 'bg-emerald-500 text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] hover:bg-emerald-600 active:scale-[0.92]'
              : 'cursor-not-allowed bg-slate-100 text-slate-300'
          }`}
        >
          <span className="flex items-center gap-1">
            <Check size={14} strokeWidth={2.5} />
            Done
          </span>
        </button>
      )}
      {isPlacing && (
        <button
          onClick={() => onModeChange(null)}
          className="group relative rounded-xl bg-emerald-500 px-3 py-1.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)] transition-all duration-200 outline-none hover:bg-emerald-600 active:scale-[0.92]"
        >
          <span className="flex items-center gap-1">
            <Check size={14} strokeWidth={2.5} />
            Done
          </span>
        </button>
      )}

      {/* Vertical divider */}
      <div className="mx-1.5 h-6 w-px bg-slate-300" />

      {/* Drawing tools */}
      {TOOLS.map(({ mode, label, Icon, desc }) => {
        const isActive = activeMode === mode
        const isDisabledTool = mode === 'boundary' && hasBoundary

        return (
          <button
            key={mode}
            onClick={() => onModeChange(isActive ? null : mode)}
            disabled={isDisabledTool}
            title={isDisabledTool ? 'Boundary already drawn. Clear to redraw.' : desc}
            className={`group relative rounded-xl p-2.5 transition-all duration-200 outline-none ${
              isActive
                ? 'bg-action text-white shadow-[0_2px_8px_rgba(57,87,127,0.3)]'
                : isDisabledTool
                  ? 'cursor-not-allowed text-slate-300'
                  : 'text-slate-800 hover:bg-slate-800/8 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.92]'
            }`}
          >
            <Icon size={18} strokeWidth={2} />
            {/* Tooltip */}
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              {label}
            </span>
          </button>
        )
      })}

      {/* Clear boundary */}
      {hasBoundary && onClearBoundary && (
        <>
          <div className="mx-1.5 h-6 w-px bg-slate-300" />
          <button
            onClick={onClearBoundary}
            title="Clear boundary and start over"
            className="group relative rounded-xl p-2.5 text-slate-500 transition-all duration-200 outline-none hover:bg-red-500/10 hover:text-red-600 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-[0.92]"
          >
            <Trash2 size={18} strokeWidth={2} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
              Clear
            </span>
          </button>
        </>
      )}
    </div>
  )
}
