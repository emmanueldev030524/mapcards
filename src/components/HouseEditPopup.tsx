import { useCallback } from 'react'
import { useStore } from '../store'
import { PIN_CATEGORIES } from '../lib/mapPins'
import { X } from 'lucide-react'

export default function HouseEditPopup() {
  const selectedId = useStore((s) => s.selectedHouseId)
  const housePoints = useStore((s) => s.housePoints)
  const updateLabel = useStore((s) => s.updateHouseLabel)
  const toggleTag = useStore((s) => s.toggleHouseTag)
  const removeHouse = useStore((s) => s.removeHousePoint)
  const setSelected = useStore((s) => s.setSelectedHouseId)

  const house = selectedId ? housePoints.find((p) => p.id === selectedId) : null
  const houseIndex = house ? housePoints.indexOf(house) + 1 : 0

  const handleDelete = useCallback(() => {
    if (selectedId) {
      removeHouse(selectedId)
      setSelected(null)
    }
  }, [selectedId, removeHouse, setSelected])

  if (!house) return null

  const tags = house.properties.tags || []
  const statusCats = PIN_CATEGORIES.filter((c) => c.group === 'status')
  const placeCats = PIN_CATEGORIES.filter((c) => c.group === 'place')

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="hover-lift w-72 rounded-xl border border-slate-200/80 bg-white/95 shadow-[0_12px_28px_rgba(0,0,0,0.12),0_4px_8px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {houseIndex}
            </span>
            <span className="text-xs font-medium text-gray-500">House #{houseIndex}</span>
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
              className="rounded px-1 py-0.5 text-gray-300 transition-colors hover:text-gray-500"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3 px-3 py-2.5">
          {/* Label */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Name
            </label>
            <input
              type="text"
              value={house.properties.label || ''}
              onChange={(e) => updateLabel(house.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelected(null) }}
              placeholder="e.g. Garcia Family"
              autoFocus
              className="w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm text-gray-700 placeholder:text-gray-300 focus:border-primary focus:outline-none"
            />
          </div>

          {/* Status tags */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-400">
              Status
            </label>
            <div className="flex gap-1.5">
              {statusCats.map((cat) => {
                const active = tags.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleTag(house.id, cat.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ${
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                    }`}
                    style={active ? { backgroundColor: cat.color } : undefined}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Place type icons */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-400">
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
                    className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center transition-all ${
                      active
                        ? 'text-white shadow-sm'
                        : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
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
