import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'

/** Compute CSS percentage for range fill gradient */
function rangePct(value: number, min: number, max: number) {
  return `${((value - min) / (max - min)) * 100}%`
}

/** Clickable badge that becomes an editable input */
function EditableBadge({
  value,
  suffix,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  suffix: string
  onChange: (v: number) => void
  min: number
  max: number
  step?: number
}) {
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = useCallback(() => {
    setEditing(false)
    const raw = parseFloat(inputRef.current?.value || '0')
    const clamped = Math.min(max, Math.max(min, isNaN(raw) ? min : raw))
    onChange(clamped)
  }, [min, max, onChange])

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        autoFocus
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit() }}
        className="w-14 rounded-md bg-input-bg px-1.5 py-0.5 text-center text-[12px] font-semibold tabular-nums text-heading outline-none focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="rounded-md bg-brand-tint px-2 py-0.5 text-[12px] font-semibold tabular-nums text-brand transition-colors duration-150 hover:bg-brand/15"
    >
      {value}{suffix}
    </button>
  )
}

const rangeClass = 'h-2 w-full cursor-pointer appearance-none rounded-full'

export default function Toolbar() {
  const boundaryOpacity = useStore((s) => s.boundaryOpacity)
  const setBoundaryOpacity = useStore((s) => s.setBoundaryOpacity)
  const maskOpacity = useStore((s) => s.maskOpacity)
  const setMaskOpacity = useStore((s) => s.setMaskOpacity)
  const houseIconSize = useStore((s) => s.houseIconSize)
  const setHouseIconSize = useStore((s) => s.setHouseIconSize)
  const houseCount = useStore((s) => s.housePoints.length)
  const clearAllHouses = useStore((s) => s.clearAllHouses)
  const boundary = useStore((s) => s.boundary)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const setSnapToGrid = useStore((s) => s.setSnapToGrid)
  const gridSpacingMeters = useStore((s) => s.gridSpacingMeters)
  const setGridSpacing = useStore((s) => s.setGridSpacing)

  const hasBoundary = boundary !== null

  if (!hasBoundary && houseCount === 0) return null

  return (
    <div className="space-y-2">

      {hasBoundary && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-heading">Fill Opacity</span>
              <EditableBadge
                value={Math.round(boundaryOpacity * 100)}
                suffix="%"
                min={0}
                max={100}
                step={5}
                onChange={(v) => setBoundaryOpacity(v / 100)}
              />
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={boundaryOpacity}
              onChange={(e) => setBoundaryOpacity(parseFloat(e.target.value))}
              style={{ '--range-pct': rangePct(boundaryOpacity, 0, 1) } as React.CSSProperties}
              className={rangeClass}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-heading">Mask Opacity</span>
              <EditableBadge
                value={Math.round(maskOpacity * 100)}
                suffix="%"
                min={0}
                max={100}
                step={5}
                onChange={(v) => setMaskOpacity(v / 100)}
              />
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={maskOpacity}
              onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
              style={{ '--range-pct': rangePct(maskOpacity, 0, 1) } as React.CSSProperties}
              className={rangeClass}
            />
          </div>
        </div>
      )}

      {houseCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-heading">House Size</span>
            <EditableBadge
              value={Math.round(houseIconSize * 100)}
              suffix="%"
              min={30}
              max={200}
              step={10}
              onChange={(v) => setHouseIconSize(v / 100)}
            />
          </div>
          <input
            type="range"
            min="0.3"
            max="2"
            step="0.1"
            value={houseIconSize}
            onChange={(e) => setHouseIconSize(parseFloat(e.target.value))}
            style={{ '--range-pct': rangePct(houseIconSize, 0.3, 2) } as React.CSSProperties}
            className={rangeClass}
          />
          <div className="mt-2 flex items-center gap-2">
            <p className="flex-1 text-[11px] leading-tight text-body/60">Drag to reposition, click to select, Delete key to remove</p>
            <button
              onClick={clearAllHouses}
              className="shrink-0 rounded-full border border-red-200 bg-red-50/60 px-2.5 py-1 text-[11px] font-semibold text-red-500 transition-all duration-150 hover:border-red-300 hover:bg-red-50"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {hasBoundary && (
        <div className="mt-3 space-y-2 border-t border-divider pt-3">
          <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors duration-150 hover:bg-brand-hover">
            <div className="relative flex items-center">
              <input
                type="checkbox"
                checked={snapToGrid}
                onChange={(e) => setSnapToGrid(e.target.checked)}
                className="peer h-4.5 w-4.5 cursor-pointer appearance-none rounded border-[1.5px] border-divider bg-surface transition-colors duration-150 checked:border-brand checked:bg-brand"
              />
              <svg className="pointer-events-none absolute left-1 top-1 hidden h-3 w-3 text-white peer-checked:block" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="2 6 5 9 10 3" />
              </svg>
            </div>
            <span className="text-[13px] font-medium text-heading">Snap to Grid</span>
          </label>

          {snapToGrid && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-heading">Grid Spacing</span>
                <EditableBadge
                  value={gridSpacingMeters}
                  suffix="m"
                  min={5}
                  max={50}
                  step={5}
                  onChange={setGridSpacing}
                />
              </div>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={gridSpacingMeters}
                onChange={(e) => setGridSpacing(parseInt(e.target.value))}
                style={{ '--range-pct': rangePct(gridSpacingMeters, 5, 50) } as React.CSSProperties}
                className={rangeClass}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
