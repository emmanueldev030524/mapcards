import { Download, PencilLine } from 'lucide-react'
import { useIsTablet } from '../hooks/useMediaQuery'

interface ReviewOverlayProps {
  territoryName: string
  territoryNumber: string
  cardWidthInches: number
  cardHeightInches: number
  onExport: () => void
  onExitReview: () => void
}

export default function ReviewOverlay({
  territoryName,
  territoryNumber,
  cardWidthInches,
  cardHeightInches,
  onExport,
  onExitReview,
}: ReviewOverlayProps) {
  const isTablet = useIsTablet()

  const heading = territoryNumber
    ? `Territory ${territoryNumber}`
    : territoryName || 'Territory Review'

  const subtitle = territoryName && territoryNumber
    ? territoryName
    : `${cardWidthInches} × ${cardHeightInches} in`

  return (
    <div className={`absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-900/72 backdrop-blur-xl ${
      isTablet ? 'px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))]' : 'px-5 py-2.5'
    }`}>
      {/* Left: mode label + territory info */}
      <div className="flex min-w-0 items-center gap-3">
        <span className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">
          Review
        </span>
        <div className="min-w-0">
          <p className={`truncate font-bold tracking-tight text-white ${isTablet ? 'text-[14px]' : 'text-[15px]'}`}>{heading}</p>
          <p className="truncate text-[11px] text-white/55">{subtitle}</p>
        </div>
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onExitReview}
          className={`inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 font-semibold text-white transition-colors hover:bg-white/18 ${
            isTablet ? 'min-h-[44px] px-3.5 py-2.5 text-[12px]' : 'px-3 py-1.5 text-[12px]'
          }`}
        >
          <PencilLine size={13} strokeWidth={2.2} />
          Edit
        </button>
        <button
          onClick={onExport}
          className={`inline-flex items-center gap-1.5 rounded-full bg-white font-semibold text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.15)] transition-colors hover:bg-white/92 ${
            isTablet ? 'min-h-[44px] px-3.5 py-2.5 text-[12px]' : 'px-3 py-1.5 text-[12px]'
          }`}
        >
          <Download size={13} strokeWidth={2.2} />
          Export
        </button>
      </div>
    </div>
  )
}
