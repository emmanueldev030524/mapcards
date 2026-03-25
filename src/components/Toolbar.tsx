import { useStore } from '../store'
import type { DrawMode } from '../types/project'

interface ToolbarProps {
  activeMode: DrawMode
  onModeChange: (mode: DrawMode) => void
  hasBoundary: boolean
  onClearBoundary?: () => void
}

const TOOLS: { mode: DrawMode; label: string; icon: string; description: string }[] = [
  { mode: 'boundary', label: 'Boundary', icon: '⬡', description: 'Draw territory boundary' },
  { mode: 'road', label: 'Road', icon: '—', description: 'Draw custom road' },
  { mode: 'house', label: 'House', icon: '⌂', description: 'Place house icon' },
  { mode: 'bulkFill', label: 'Bulk Fill', icon: '⌂⌂', description: 'Place houses along street' },
  { mode: 'select', label: 'Select', icon: '↖', description: 'Select & edit features' },
]

export default function Toolbar({ activeMode, onModeChange, hasBoundary, onClearBoundary }: ToolbarProps) {
  const boundaryOpacity = useStore((s) => s.boundaryOpacity)
  const setBoundaryOpacity = useStore((s) => s.setBoundaryOpacity)
  const houseIconSize = useStore((s) => s.houseIconSize)
  const setHouseIconSize = useStore((s) => s.setHouseIconSize)
  const badgeIconSize = useStore((s) => s.badgeIconSize)
  const setBadgeIconSize = useStore((s) => s.setBadgeIconSize)
  const hasBadges = useStore((s) => s.housePoints.some((p) => (p.properties.tags?.length ?? 0) > 0))
  const houseCount = useStore((s) => s.housePoints.length)
  const clearAllHouses = useStore((s) => s.clearAllHouses)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const setSnapToGrid = useStore((s) => s.setSnapToGrid)
  const gridSpacingMeters = useStore((s) => s.gridSpacingMeters)
  const setGridSpacing = useStore((s) => s.setGridSpacing)

  return (
    <div className="space-y-1">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Drawing Tools
      </h3>
      {TOOLS.map(({ mode, label, icon, description }) => {
        const isActive = activeMode === mode
        const isDisabled = mode === 'boundary' && hasBoundary

        return (
          <div key={mode} className="flex items-center gap-1">
            <button
              onClick={() => onModeChange(isActive ? null : mode)}
              disabled={isDisabled}
              title={isDisabled ? 'Boundary already drawn. Clear to redraw.' : description}
              className={`flex flex-1 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-white'
                  : isDisabled
                    ? 'cursor-not-allowed text-gray-300'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="w-6 text-center text-base">{icon}</span>
              <span>{label}</span>
            </button>
            {mode === 'boundary' && hasBoundary && onClearBoundary && (
              <button
                onClick={onClearBoundary}
                title="Clear boundary and redraw"
                className="rounded-md px-2 py-2 text-xs text-red-500 transition-colors hover:bg-red-50 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
        )
      })}

      {hasBoundary && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Fill Opacity</span>
            <span className="text-xs tabular-nums text-gray-400">
              {Math.round(boundaryOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={boundaryOpacity}
            onChange={(e) => setBoundaryOpacity(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
          />
        </div>
      )}

      {houseCount > 0 && (
        <div className="mt-3 space-y-1 border-t border-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">House Size</span>
            <span className="text-xs tabular-nums text-gray-400">
              {Math.round(houseIconSize * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.3"
            max="2"
            step="0.1"
            value={houseIconSize}
            onChange={(e) => setHouseIconSize(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
          />
          {hasBadges && (
            <>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-500">Tag Badge Size</span>
                <span className="text-xs tabular-nums text-gray-400">
                  {Math.round(badgeIconSize * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={badgeIconSize}
                onChange={(e) => setBadgeIconSize(parseFloat(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
              />
            </>
          )}
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-400">Drag houses to reposition</p>
            <button
              onClick={clearAllHouses}
              className="text-[10px] text-red-500 transition-colors hover:text-red-700"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {hasBoundary && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={snapToGrid}
              onChange={(e) => setSnapToGrid(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
            />
            <span className="text-xs text-gray-600">Snap to Grid</span>
          </label>

          {snapToGrid && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Grid Spacing</span>
                <span className="text-xs tabular-nums text-gray-400">
                  {gridSpacingMeters}m
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={gridSpacingMeters}
                onChange={(e) => setGridSpacing(parseInt(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
