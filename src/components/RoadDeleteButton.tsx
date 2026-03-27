import { Trash2 } from 'lucide-react'
import { useStore } from '../store'

export default function RoadDeleteButton() {
  const selectedRoadId = useStore((s) => s.selectedRoadId)
  const removeRoad = useStore((s) => s.removeCustomRoad)
  const setSelectedRoad = useStore((s) => s.setSelectedRoadId)

  if (!selectedRoadId) return null

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <button
        onClick={() => {
          removeRoad(selectedRoadId)
          setSelectedRoad(null)
        }}
        className="flex items-center gap-2 rounded-xl border border-red-200 bg-white/95 px-4 py-2.5 text-[13px] font-semibold text-red-600 shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all hover:bg-red-50 active:scale-95"
      >
        <Trash2 size={15} strokeWidth={2} />
        Delete Road
      </button>
    </div>
  )
}
