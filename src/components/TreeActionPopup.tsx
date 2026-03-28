import { useCallback } from 'react'
import { useStore } from '../store'
import { Trash2, X, TreePine } from 'lucide-react'

export default function TreeActionPopup() {
  const selectedId = useStore((s) => s.selectedTreeId)
  const treePoints = useStore((s) => s.treePoints)
  const removeTree = useStore((s) => s.removeTreePoint)
  const setSelected = useStore((s) => s.setSelectedTreeId)

  const tree = selectedId ? treePoints.find((p) => p.id === selectedId) : null
  const treeIndex = tree ? treePoints.indexOf(tree) + 1 : 0

  const handleDelete = useCallback(() => {
    if (selectedId) {
      removeTree(selectedId)
      setSelected(null)
    }
  }, [selectedId, removeTree, setSelected])

  if (!tree) return null

  return (
    <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-full border border-divider bg-white/95 py-1.5 pl-3 pr-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_6px_rgba(0,0,0,0.06)] backdrop-blur-sm">
        {/* Tree label */}
        <TreePine size={14} strokeWidth={2.2} className="text-emerald-600" />
        <span className="text-[13px] font-medium text-heading whitespace-nowrap">
          Tree #{treeIndex}
        </span>

        {/* Divider dot */}
        <div className="mx-1 h-1 w-1 rounded-full bg-slate-300" />

        {/* Delete */}
        <button
          onClick={handleDelete}
          className="btn-press flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1.5 text-[12px] font-semibold text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
        >
          <Trash2 size={13} strokeWidth={2.2} />
          Delete
        </button>

        {/* Close */}
        <button
          onClick={() => setSelected(null)}
          aria-label="Close"
          className="btn-press flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-black/6 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  )
}
