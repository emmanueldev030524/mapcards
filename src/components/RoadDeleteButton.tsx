import { Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { showConfirm } from './ConfirmDialog'

export default function RoadDeleteButton() {
  const selectedRoadId = useStore((s) => s.selectedRoadId)
  const customRoads = useStore((s) => s.customRoads)
  const removeRoad = useStore((s) => s.removeCustomRoad)
  const setSelectedRoad = useStore((s) => s.setSelectedRoadId)

  if (!selectedRoadId) return null

  const roadIndex = customRoads.findIndex((road) => road.id === selectedRoadId) + 1

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="min-w-[18rem] rounded-2xl border border-slate-200/85 bg-white/97 px-3 py-3 shadow-[0_20px_44px_rgba(15,23,42,0.18),0_8px_18px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-heading">Road #{roadIndex > 0 ? roadIndex : 'Selected'}</p>
            <p className="text-[11px] text-body/78">Selected custom road</p>
          </div>
          <button
            onClick={() => setSelectedRoad(null)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-black/6 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            aria-label="Close road actions"
          >
            <span className="text-base leading-none">×</span>
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/72 px-3 py-2.5">
          <p className="text-[11px] text-body/82">Delete this road if it should not appear in the final territory card.</p>
          <button
            onClick={async () => {
              const ok = await showConfirm(
                'Delete Road?',
                `Remove ${roadIndex > 0 ? `Road #${roadIndex}` : 'this road'} from the map.`,
                { variant: 'destructive', confirmLabel: 'Delete Road' },
              )
              if (!ok) return
              removeRoad(selectedRoadId)
              setSelectedRoad(null)
            }}
            className="flex shrink-0 items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-600 shadow-[0_4px_12px_rgba(239,68,68,0.08)] transition-all hover:bg-red-100 active:scale-95"
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
