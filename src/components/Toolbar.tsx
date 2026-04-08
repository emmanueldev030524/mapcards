import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { Trash2 } from 'lucide-react'
import { showConfirm } from './ConfirmDialog'
import PopupToggle from './PopupToggle'
import {
  popupSectionFlat,
  popupSectionDivider,
  popupRowLabel,
  popupValueBadge,
} from '../lib/popupStyles'

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
        className="w-14 rounded-full bg-input-bg px-2 py-0.5 text-center text-[12px] font-semibold tabular-nums text-heading outline-none focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit"
      className={popupValueBadge}
    >
      {value}{suffix}
    </button>
  )
}

/** Slider row — label, badge, and range input */
function SliderRow({
  label,
  value,
  displayValue,
  suffix,
  min,
  max,
  step,
  badgeMin,
  badgeMax,
  badgeStep,
  onChange,
  onBadgeChange,
}: {
  label: string
  value: number
  displayValue: number
  suffix: string
  min: string
  max: string
  step: string
  badgeMin: number
  badgeMax: number
  badgeStep: number
  onChange: (v: number) => void
  onBadgeChange: (v: number) => void
}) {
  return (
    <div className="space-y-2 py-1.5">
      <div className="flex items-center justify-between">
        <span className={popupRowLabel}>{label}</span>
        <EditableBadge
          value={displayValue}
          suffix={suffix}
          min={badgeMin}
          max={badgeMax}
          step={badgeStep}
          onChange={onBadgeChange}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ '--range-pct': rangePct(value, parseFloat(min), parseFloat(max)) } as React.CSSProperties}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
      />
    </div>
  )
}

export default function Toolbar() {
  const boundaryOpacity = useStore((s) => s.boundaryOpacity)
  const setBoundaryOpacity = useStore((s) => s.setBoundaryOpacity)
  const maskOpacity = useStore((s) => s.maskOpacity)
  const setMaskOpacity = useStore((s) => s.setMaskOpacity)
  const houseIconSize = useStore((s) => s.houseIconSize)
  const setHouseIconSize = useStore((s) => s.setHouseIconSize)
  const treeIconSize = useStore((s) => s.treeIconSize)
  const setTreeIconSize = useStore((s) => s.setTreeIconSize)
  const startMarkerSize = useStore((s) => s.startMarkerSize)
  const setStartMarkerSize = useStore((s) => s.setStartMarkerSize)
  const houseCount = useStore((s) => s.housePoints.length)
  const treeCount = useStore((s) => s.treePoints.length)
  const startMarker = useStore((s) => s.startMarker)
  const clearAllHouses = useStore((s) => s.clearAllHouses)
  const boundary = useStore((s) => s.boundary)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const setSnapToGrid = useStore((s) => s.setSnapToGrid)
  const gridSpacingMeters = useStore((s) => s.gridSpacingMeters)
  const setGridSpacing = useStore((s) => s.setGridSpacing)

  const hasBoundary = boundary !== null

  if (!hasBoundary && houseCount === 0 && treeCount === 0 && !startMarker) return null

  return (
    <div className="space-y-3.5">

      {/* ── Boundary controls card ── */}
      {hasBoundary && (
        <div className={popupSectionFlat}>
          <SliderRow
            label="Fill Opacity"
            value={boundaryOpacity}
            displayValue={Math.round(boundaryOpacity * 100)}
            suffix="%"
            min="0"
            max="1"
            step="0.05"
            badgeMin={0}
            badgeMax={100}
            badgeStep={5}
            onChange={setBoundaryOpacity}
            onBadgeChange={(v) => setBoundaryOpacity(v / 100)}
          />
          <div className={popupSectionDivider} />
          <SliderRow
            label="Mask Opacity"
            value={maskOpacity}
            displayValue={Math.round(maskOpacity * 100)}
            suffix="%"
            min="0"
            max="1"
            step="0.05"
            badgeMin={0}
            badgeMax={100}
            badgeStep={5}
            onChange={setMaskOpacity}
            onBadgeChange={(v) => setMaskOpacity(v / 100)}
          />
        </div>
      )}

      {/* ── House controls card ── */}
      {houseCount > 0 && (
        <div className={popupSectionFlat}>
          <SliderRow
            label="House Size"
            value={houseIconSize}
            displayValue={Math.round(houseIconSize * 100)}
            suffix="%"
            min="0.3"
            max="2"
            step="0.1"
            badgeMin={30}
            badgeMax={200}
            badgeStep={10}
            onChange={setHouseIconSize}
            onBadgeChange={(v) => setHouseIconSize(v / 100)}
          />
          <div className={popupSectionDivider} />
          <button
            onClick={async () => {
              const ok = await showConfirm(
                'Clear All Houses?',
                `Remove all ${houseCount} houses from the map.`,
                { variant: 'destructive', confirmLabel: 'Clear All' },
              )
              if (ok) clearAllHouses()
            }}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-200/50 bg-rose-50/50 py-2 text-[12px] font-semibold text-rose-600 transition-colors duration-150 hover:border-rose-300/70 hover:bg-rose-100/70 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-300/60 focus-visible:outline-none"
          >
            <Trash2 size={14} strokeWidth={2.2} />
            Clear all houses
          </button>
        </div>
      )}

      {treeCount > 0 && (
        <div className={popupSectionFlat}>
          <SliderRow
            label="Tree Size"
            value={treeIconSize}
            displayValue={Math.round(treeIconSize * 100)}
            suffix="%"
            min="0.3"
            max="2"
            step="0.1"
            badgeMin={30}
            badgeMax={200}
            badgeStep={10}
            onChange={setTreeIconSize}
            onBadgeChange={(v) => setTreeIconSize(v / 100)}
          />
        </div>
      )}

      {startMarker && (
        <div className={popupSectionFlat}>
          <SliderRow
            label="Start Marker Size"
            value={startMarkerSize}
            displayValue={Math.round(startMarkerSize * 100)}
            suffix="%"
            min="0.5"
            max="2"
            step="0.1"
            badgeMin={50}
            badgeMax={200}
            badgeStep={10}
            onChange={setStartMarkerSize}
            onBadgeChange={(v) => setStartMarkerSize(v / 100)}
          />
        </div>
      )}

      {/* ── Grid controls card ── */}
      {hasBoundary && (
        <div className={popupSectionFlat}>
          <PopupToggle
            checked={snapToGrid}
            onChange={setSnapToGrid}
            label="Snap to Grid"
          />
          {snapToGrid && (
            <>
              <div className={popupSectionDivider} />
              <SliderRow
                label="Grid Spacing"
                value={gridSpacingMeters}
                displayValue={gridSpacingMeters}
                suffix="m"
                min="5"
                max="50"
                step="5"
                badgeMin={5}
                badgeMax={50}
                badgeStep={5}
                onChange={(v) => setGridSpacing(Math.round(v))}
                onBadgeChange={setGridSpacing}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
