import { useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { Trash2 } from 'lucide-react'
import { showConfirm } from './ConfirmDialog'

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
      className="min-h-7 rounded-full bg-brand-tint px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-brand transition-colors duration-150 hover:bg-brand/15 active:scale-95"
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
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium text-body">{label}</span>
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

/** iOS-style toggle switch */
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-1 py-1 transition-colors duration-150 active:bg-brand-hover">
      <span className="text-[12px] font-medium text-body">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6.5 w-11.5 shrink-0 rounded-full transition-colors duration-200 ease-out ${
          checked ? 'bg-brand' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute left-0.75 top-0.75 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.15)] transition-transform duration-200 ease-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </label>
  )
}

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
    <div className="space-y-3">

      {/* ── Boundary controls card ── */}
      {hasBoundary && (
        <div className="rounded-xl bg-input-bg/50 px-3.5 py-1">
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
          <div className="border-t border-divider/40" />
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
        <div className="rounded-xl bg-input-bg/50 px-3.5 py-1">
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
          <div className="border-t border-divider/40" />
          <button
            onClick={async () => {
              const ok = await showConfirm(
                'Clear All Houses?',
                `Remove all ${houseCount} houses from the map.`,
                { variant: 'destructive', confirmLabel: 'Clear All' },
              )
              if (ok) clearAllHouses()
            }}
            className="flex min-h-10 w-full items-center gap-2 rounded-lg py-2 text-[12px] font-medium text-red-500 transition-colors duration-150 active:bg-red-50"
          >
            <Trash2 size={14} strokeWidth={2} />
            Clear all houses
          </button>
        </div>
      )}

      {/* ── Grid controls card ── */}
      {hasBoundary && (
        <div className="rounded-xl bg-input-bg/50 px-3.5 py-1">
          <ToggleSwitch
            checked={snapToGrid}
            onChange={setSnapToGrid}
            label="Snap to Grid"
          />
          {snapToGrid && (
            <>
              <div className="border-t border-divider/40" />
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
