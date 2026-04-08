import { Download } from 'lucide-react'
import { useStore } from '../store'

interface ExportPanelProps {
  onExport: () => void
}

export default function ExportPanel({ onExport }: ExportPanelProps) {
  const boundary = useStore((s) => s.boundary)

  return (
    <button
      onClick={onExport}
      disabled={!boundary}
      title={!boundary ? 'Draw a boundary first' : 'Export territory card'}
      className="sidebar-primary-button flex min-h-11 w-full items-center justify-center gap-2.5 rounded-full px-3.5 py-2.5 text-[13px] font-semibold tracking-[0.01em] text-white disabled:cursor-not-allowed disabled:opacity-55 disabled:shadow-none disabled:hover:translate-y-0 disabled:hover:filter-none focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:ring-offset-1 focus-visible:outline-none"
    >
      <Download size={14} strokeWidth={2} />
      Export Card
    </button>
  )
}
