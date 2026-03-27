import { useState, useCallback } from 'react'
import { saveAs } from 'file-saver'
import { Image, FileText, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { exportToPng } from '../lib/exportPng'
import { exportToPdf } from '../lib/exportPdf'

export default function ExportPanel() {
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null)

  const boundary = useStore((s) => s.boundary)
  const customRoads = useStore((s) => s.customRoads)
  const housePoints = useStore((s) => s.housePoints)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)

  const getExportOptions = useCallback(() => ({
    boundary: boundary!,
    customRoads,
    housePoints,
    territoryName,
    territoryNumber,
    cardWidthInches,
    cardHeightInches,
  }), [boundary, customRoads, housePoints, territoryName, territoryNumber, cardWidthInches, cardHeightInches])

  const handleExportPng = useCallback(async () => {
    if (!boundary) return
    setExporting('png')
    try {
      const blob = await exportToPng(getExportOptions())
      const filename = `territory-${territoryNumber || territoryName || 'map'}.png`
      saveAs(blob, filename)
    } catch (err) {
      console.error('PNG export failed:', err)
      alert('Export failed. Check console for details.')
    } finally {
      setExporting(null)
    }
  }, [boundary, getExportOptions, territoryName, territoryNumber])

  const handleExportPdf = useCallback(async () => {
    if (!boundary) return
    setExporting('pdf')
    try {
      const blob = await exportToPdf(getExportOptions())
      const filename = `territory-${territoryNumber || territoryName || 'map'}.pdf`
      saveAs(blob, filename)
    } catch (err) {
      console.error('PDF export failed:', err)
      alert('Export failed. Check console for details.')
    } finally {
      setExporting(null)
    }
  }, [boundary, getExportOptions, territoryName, territoryNumber])

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <button
          onClick={handleExportPng}
          disabled={!boundary || exporting !== null}
          title={!boundary ? 'Draw a boundary first' : undefined}
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-action px-3 py-2.5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(57,87,127,0.3)] transition-all duration-150 hover:bg-primary-dark hover:shadow-[0_4px_12px_rgba(57,87,127,0.35)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {exporting === 'png' ? (
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          ) : (
            <Image size={14} strokeWidth={2} />
          )}
          {exporting === 'png' ? 'Exporting...' : 'PNG'}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={!boundary || exporting !== null}
          title={!boundary ? 'Draw a boundary first' : undefined}
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-action px-3 py-2.5 text-sm font-bold text-white shadow-[0_2px_8px_rgba(57,87,127,0.3)] transition-all duration-150 hover:bg-primary-dark hover:shadow-[0_4px_12px_rgba(57,87,127,0.35)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          {exporting === 'pdf' ? (
            <Loader2 size={14} strokeWidth={2} className="animate-spin" />
          ) : (
            <FileText size={14} strokeWidth={2} />
          )}
          {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
        </button>
      </div>
    </div>
  )
}
