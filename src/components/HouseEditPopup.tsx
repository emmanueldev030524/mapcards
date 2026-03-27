import { useCallback, useState } from 'react'
import { useStore } from '../store'
import { PIN_CATEGORIES } from '../lib/mapPins'
import { X, Plus } from 'lucide-react'

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
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="hover-lift w-80 rounded-xl border border-divider bg-white/95 shadow-[0_12px_28px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.06)] backdrop-blur-sm">
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
              className="rounded px-1.5 py-0.5 text-[10px] text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              Delete
            </button>
            <button
              onClick={() => setSelected(null)}
              className="rounded px-1 py-0.5 text-body transition-colors hover:text-heading"
            >
              <X size={14} strokeWidth={2} />
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
              className="w-full rounded-lg border border-divider bg-surface px-2.5 py-1.5 text-[13px] text-heading placeholder:text-body/50 outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
            />
          </div>

          {/* Status — grid layout like Place Type, user-manageable */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body">
              Status
            </label>
            <div className="grid grid-cols-5 gap-1">
              {customStatuses.map((status) => {
                const active = tags.includes(status.id)
                return (
                  <button
                    key={status.id}
                    onClick={() => toggleTag(house.id, status.id)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      if (confirm(`Remove "${status.label}" status?`)) {
                        removeCustomStatus(status.id)
                      }
                    }}
                    title={`${status.label} (right-click to remove)`}
                    className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition-colors ${
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-input-bg text-body hover:bg-divider'
                    }`}
                    style={active ? { backgroundColor: status.color } : undefined}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : status.color + '20' }}
                    >
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ backgroundColor: active ? '#fff' : status.color }}
                      />
                    </span>
                    <span className="text-[9px] leading-tight">{status.label}</span>
                  </button>
                )
              })}

              {/* Add status button */}
              {!adding && (
                <button
                  onClick={() => setAdding(true)}
                  className="flex flex-col items-center gap-0.5 rounded-lg bg-input-bg px-1 py-1.5 text-body transition-colors hover:bg-divider"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-divider">
                    <Plus size={10} strokeWidth={2.5} />
                  </span>
                  <span className="text-[9px] leading-tight">Add</span>
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
                  className="w-full rounded-md border border-divider bg-surface px-2 py-1 text-[12px] text-heading placeholder:text-body/50 outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
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

          {/* Place type icons */}
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body">
              Place Type
            </label>
            <div className="grid grid-cols-5 gap-1">
              {placeCats.map((cat) => {
                const active = tags.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleTag(house.id, cat.id)}
                    title={cat.label}
                    className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition-colors ${
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-input-bg text-body hover:bg-divider'
                    }`}
                    style={active ? { backgroundColor: cat.color } : undefined}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: active ? 'rgba(255,255,255,0.25)' : cat.color + '20' }}
                    >
                      <span
                        className="block h-2 w-2 rounded-full"
                        style={{ backgroundColor: active ? '#fff' : cat.color }}
                      />
                    </span>
                    <span className="text-[9px] leading-tight">{cat.label}</span>
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
