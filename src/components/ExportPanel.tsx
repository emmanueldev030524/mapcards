import { useState, useCallback } from 'react'
import { saveAs } from 'file-saver'
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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Export
      </h3>
      {!boundary && (
        <p className="text-xs text-amber-600">Draw a boundary first to enable export.</p>
      )}
      <div className="flex gap-1.5">
        <button
          onClick={handleExportPng}
          disabled={!boundary || exporting !== null}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting === 'png' ? 'Exporting...' : 'PNG'}
        </button>
        <button
          onClick={handleExportPdf}
          disabled={!boundary || exporting !== null}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-white hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting === 'pdf' ? 'Exporting...' : 'PDF'}
        </button>
      </div>
    </div>
  )
}
