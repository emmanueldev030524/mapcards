import { useCallback, useRef, useState } from 'react'
import { useStore } from '../store'
import { PIN_CATEGORIES } from '../lib/mapPins'
import type { PinCategory } from '../lib/mapPins'
import { X, Plus } from 'lucide-react'
import { showConfirm } from './ConfirmDialog'

/**
 * Renders the SVG icon from a PinCategory at the given size.
 * Safe: iconPaths are hardcoded string literals from mapPins.ts, not user input.
 */
function CategoryIcon({ cat, size = 16, className }: { cat: PinCategory; size?: number; className?: string }) {
  // eslint-disable-next-line react/no-danger -- iconPaths are static SVG fragments from our own codebase
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      dangerouslySetInnerHTML={{ __html: cat.iconPaths }}
    />
  )
}

const PRESET_COLORS = [
  '#f39c12', '#e74c3c', '#e67e22', '#2ecc71', '#3498db',
  '#9b59b6', '#1abc9c', '#34495e', '#95a5a6', '#d35400',
]

export default function HouseEditPopup() {
  const selectedId = useStore((s) => s.selectedHouseId)
  const housePoints = useStore((s) => s.housePoints)
  const updateLabel = useStore((s) => s.updateHouseLabel)
  const toggleTag = useStore((s) => s.toggleHouseTag)
  const removeHouse = useStore((s) => s.removeHousePoint)
  const setSelected = useStore((s) => s.setSelectedHouseId)
  const customStatuses = useStore((s) => s.customStatuses)
  const addCustomStatus = useStore((s) => s.addCustomStatus)
  const removeCustomStatus = useStore((s) => s.removeCustomStatus)

  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newColor, setNewColor] = useState(PRESET_COLORS[0])

  const [swipeY, setSwipeY] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const touchStartY = useRef(0)

  const house = selectedId ? housePoints.find((p) => p.id === selectedId) : null
  const houseIndex = house ? housePoints.indexOf(house) + 1 : 0

  const handleDelete = useCallback(() => {
    if (selectedId) {
      removeHouse(selectedId)
      setSelected(null)
    }
  }, [selectedId, removeHouse, setSelected])

  const handleAddStatus = () => {
    const label = newLabel.trim()
    if (!label) return
    addCustomStatus(label, newColor)
    setNewLabel('')
    setNewColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)])
    setAdding(false)
  }

  if (!house) return null

  const tags = house.properties.tags || []
  const placeCats = PIN_CATEGORIES.filter((c) => c.group === 'place')

  return (
    <div className="absolute bottom-4 left-1/2 z-10 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 px-2 sm:w-auto sm:max-w-none sm:px-0">
      <div
        className="hover-lift w-full rounded-xl border border-divider bg-white/95 shadow-[0_8px_28px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.05)] backdrop-blur-sm sm:w-80"
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY
          setSwiping(true)
        }}
        onTouchMove={(e) => {
          const dy = e.touches[0].clientY - touchStartY.current
          if (dy > 0) setSwipeY(dy) // only track downward swipe
        }}
        onTouchEnd={() => {
          if (swipeY > 60) {
            setSelected(null) // dismiss
          }
          setSwipeY(0)
          setSwiping(false)
        }}
        style={{
          transform: swipeY > 0 ? `translateY(${swipeY}px)` : undefined,
          opacity: swipeY > 0 ? Math.max(0.3, 1 - swipeY / 150) : undefined,
          transition: swiping ? 'none' : 'transform 250ms ease, opacity 250ms ease',
        }}
      >
        {/* Drag handle — swipe down to dismiss */}
        <div className="flex justify-center pt-2 pb-0.5">
          <div className="h-1 w-8 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">
              {houseIndex}
            </span>
            <span className="text-[12px] font-medium text-body">House #{houseIndex}</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              aria-label="Delete house"
              className="rounded-full px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
            >
              Delete
            </button>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-black/6 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 px-3 py-2.5">
          {/* Label */}
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body">
              Name
            </label>
            <input
              type="text"
              value={house.properties.label || ''}
              onChange={(e) => updateLabel(house.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelected(null) }}
              placeholder="e.g. Garcia Family"
              autoFocus
              className="w-full rounded-lg border border-divider bg-surface px-2.5 py-1.5 text-[13px] text-heading placeholder:text-body/70 outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
            />
          </div>

          {/* Status — pill chips, user-manageable */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body">
              Status
            </label>
            <div className="flex flex-wrap gap-1.5">
              {customStatuses.map((status) => {
                const active = tags.includes(status.id)
                // Find matching pin category for icon (if exists)
                const pinCat = PIN_CATEGORIES.find((c) => c.id === status.id)
                return (
                  <button
                    key={status.id}
                    onClick={() => toggleTag(house.id, status.id)}
                    onContextMenu={async (e) => {
                      e.preventDefault()
                      const ok = await showConfirm(
                        `Remove "${status.label}"?`,
                        'This status will be removed from all houses that use it.',
                        { variant: 'destructive', confirmLabel: 'Remove' },
                      )
                      if (ok) removeCustomStatus(status.id)
                    }}
                    title={`${status.label} (right-click to remove)`}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                      active
                        ? 'text-white shadow-sm ring-1 ring-inset ring-white/20'
                        : 'bg-input-bg text-body hover:bg-divider'
                    }`}
                    style={active ? { backgroundColor: status.color } : undefined}
                  >
                    {pinCat ? (
                      <CategoryIcon cat={pinCat} size={12} className={active ? 'opacity-90' : 'opacity-60'} />
                    ) : (
                      <span
                        className="block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: active ? 'rgba(255,255,255,0.35)' : status.color,
                          boxShadow: active ? 'none' : `0 0 0 1px ${status.color}30 inset`,
                        }}
                      />
                    )}
                    {status.label}
                  </button>
                )
              })}

              {/* Add status button */}
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  className="flex items-center gap-1 rounded-full bg-input-bg px-2.5 py-1.5 text-[11px] font-medium text-body transition-colors hover:bg-divider"
                >
                  <Plus size={12} strokeWidth={2.5} />
                  Add
                </button>
              )}
            </div>

            {/* Inline add form */}
            {adding && (
              <div className="mt-2 space-y-2 rounded-lg bg-input-bg p-2.5">
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddStatus(); if (e.key === 'Escape') setAdding(false) }}
                  placeholder="Status name..."
                  autoFocus
                  className="w-full rounded-md border border-divider bg-surface px-2 py-1 text-[12px] text-heading placeholder:text-body/70 outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
                />
                <div className="flex items-center gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={`h-5 w-5 rounded-full transition-transform ${newColor === c ? 'scale-125 ring-2 ring-brand ring-offset-1' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <button
                    onClick={handleAddStatus}
                    disabled={!newLabel.trim()}
                    className="flex-1 rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-brand-dark disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setAdding(false)}
                    className="rounded-md px-2 py-1 text-[11px] font-medium text-body transition-colors hover:bg-divider"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Place type — icon tiles */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body">
              Place Type
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {placeCats.map((cat) => {
                const active = tags.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleTag(house.id, cat.id)}
                    title={cat.label}
                    className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-center transition-all duration-150 ${
                      active
                        ? 'shadow-sm ring-1 ring-inset ring-white/20'
                        : 'bg-input-bg hover:bg-divider'
                    }`}
                    style={active ? { backgroundColor: cat.color } : undefined}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: active ? 'rgba(255,255,255,0.2)' : cat.color + '15',
                      }}
                    >
                      <CategoryIcon
                        cat={{
                          ...cat,
                          // Recolor icon strokes/fills for inactive state
                          iconPaths: active
                            ? cat.iconPaths
                            : cat.iconPaths
                                .replace(/stroke="#fff"/g, `stroke="${cat.color}"`)
                                .replace(/fill="#fff"/g, `fill="${cat.color}"`)
                                .replace(/fill="rgba\(255,255,255,0\.9\)"/g, `fill="${cat.color}"`)
                        }}
                        size={16}
                      />
                    </span>
                    <span className={`text-[9px] font-medium leading-tight ${
                      active ? 'text-white' : 'text-body/70'
                    }`}>
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
