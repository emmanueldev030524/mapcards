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
      className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(75,108,167,0.3),0_2px_8px_rgba(75,108,167,0.15)] transition-colors duration-150 hover:bg-brand-dark active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
    >
      <Download size={14} strokeWidth={2} />
      Export Card
    </button>
  )
}
