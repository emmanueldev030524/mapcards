import { Eye, PencilLine } from 'lucide-react'

interface ReviewModeToggleProps {
  active: boolean
  onToggle: () => void
}

export default function ReviewModeToggle({ active, onToggle }: ReviewModeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`absolute right-3 z-20 flex items-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)] backdrop-blur-xl transition-all duration-150 active:scale-[0.97] ${
        active
          ? 'top-3 border-brand/20 bg-white/94 text-brand hover:bg-white'
          : 'bottom-5 border-white/60 bg-white/92 text-heading hover:bg-white'
      }`}
      aria-pressed={active}
      aria-label={active ? 'Exit review mode' : 'Enter review mode'}
      title={active ? 'Exit review mode' : 'Enter review mode'}
    >
      {active ? <PencilLine size={15} strokeWidth={2.2} /> : <Eye size={15} strokeWidth={2.2} />}
      {active ? 'Back to Edit' : 'Review'}
    </button>
  )
}
