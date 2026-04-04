import { Download, FileCheck2, MapPinned, PencilLine } from 'lucide-react'

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
  const heading = territoryNumber
    ? `Territory ${territoryNumber}`
    : territoryName || 'Territory Review'

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-linear-to-b from-black/28 via-black/10 to-transparent" />

      <div className="absolute left-3 top-3 z-20 w-[min(24rem,calc(100vw-5.5rem))] rounded-2xl border border-white/15 bg-slate-950/52 px-4 py-3 text-white shadow-[0_16px_40px_rgba(0,0,0,0.22)] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/65">Review Mode</p>
            <h2 className="mt-1 truncate text-[16px] font-bold tracking-tight text-white">{heading}</h2>
            <p className="mt-1 text-[12px] text-white/72">
              {territoryName && territoryNumber ? territoryName : territoryName || 'Inspect your card without editing chrome.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onExitReview}
              className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/10 px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-white/16"
            >
              <PencilLine size={14} strokeWidth={2.2} />
              Back to Edit
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <MapPinned size={18} strokeWidth={2} className="text-white/90" />
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-white/72">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1">
            <FileCheck2 size={12} strokeWidth={2} />
            {cardWidthInches} x {cardHeightInches} in
          </span>
          <span className="rounded-full bg-white/10 px-2.5 py-1">Presentation view</span>
        </div>

        <button
          onClick={onExport}
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-[12px] font-semibold text-slate-900 transition-colors hover:bg-white/92"
        >
          <Download size={14} strokeWidth={2.2} />
          Export Card
        </button>
      </div>
    </>
  )
}
