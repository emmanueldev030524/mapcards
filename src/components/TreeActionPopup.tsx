import { useCallback } from 'react'
import { useStore } from '../store'
import { Trash2, X, TreePine } from 'lucide-react'
import { showConfirm } from './ConfirmDialog'

export default function TreeActionPopup() {
  const selectedId = useStore((s) => s.selectedTreeId)
  const treePoints = useStore((s) => s.treePoints)
  const removeTree = useStore((s) => s.removeTreePoint)
  const setSelected = useStore((s) => s.setSelectedTreeId)

  const tree = selectedId ? treePoints.find((p) => p.id === selectedId) : null
  const treeIndex = tree ? treePoints.indexOf(tree) + 1 : 0

  const handleDelete = useCallback(() => {
    if (!selectedId) return
    showConfirm(
      'Delete Tree?',
      `Remove Tree #${treeIndex} from the map.`,
      { variant: 'destructive', confirmLabel: 'Delete Tree' },
    ).then((ok) => {
      if (!ok) return
      removeTree(selectedId)
      setSelected(null)
    }).catch(console.error)
  }, [selectedId, removeTree, setSelected, treeIndex])

  if (!tree) return null

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="min-w-[18rem] rounded-2xl border border-slate-200/85 bg-white/97 px-3 py-3 shadow-[0_20px_44px_rgba(15,23,42,0.18),0_8px_18px_rgba(15,23,42,0.08)] backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                <TreePine size={15} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-[12px] font-semibold text-heading">Tree #{treeIndex}</p>
                <p className="text-[11px] text-body/78">Selected landmark marker</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSelected(null)}
            aria-label="Close"
            className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-black/6 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/72 px-3 py-2.5">
          <p className="text-[11px] text-body/82">Delete this marker if it no longer belongs on the card.</p>
          <button
            onClick={handleDelete}
            className="btn-press flex shrink-0 items-center gap-1 rounded-full border border-red-100 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
          >
            <Trash2 size={13} strokeWidth={2.2} />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
