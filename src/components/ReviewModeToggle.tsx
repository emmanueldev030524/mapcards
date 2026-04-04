import { Eye, PencilLine } from 'lucide-react'

interface ReviewModeToggleProps {
  active: boolean
  onToggle: () => void
}

export default function ReviewModeToggle({ active, onToggle }: ReviewModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`absolute z-20 flex items-center justify-center rounded-full border shadow-[0_4px_16px_rgba(0,0,0,0.08),0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-xl transition-all duration-150 active:scale-[0.97] ${
        active
          ? 'right-3 top-3 gap-2 px-3.5 py-2 text-[12px] font-semibold border-brand/25 bg-white/97 text-brand hover:bg-white'
          : 'bottom-[8px] right-[132px] h-9 w-9 border-white/60 bg-white/88 text-slate-600 hover:bg-white hover:text-slate-800'
      }`}
      aria-pressed={active}
      aria-label={active ? 'Exit review mode' : 'Enter review mode'}
      title={active ? 'Exit review mode' : 'Enter review mode'}
    >
      {active ? <PencilLine size={15} strokeWidth={2.2} /> : <Eye size={14} strokeWidth={2.2} />}
      {active ? 'Back to Edit' : null}
    </button>
  )
}
