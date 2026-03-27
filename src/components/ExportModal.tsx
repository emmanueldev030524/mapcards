import { useState, useCallback, useEffect } from 'react'
import { saveAs } from 'file-saver'
import { X, Download, FileText, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { exportToPng } from '../lib/exportPng'
import { exportToPdf } from '../lib/exportPdf'
import { collectLegend } from '../lib/mapPins'
import type maplibregl from 'maplibre-gl'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  map: maplibregl.Map | null
}

type ExportState = 'preview' | 'generating' | 'ready' | 'error'

export default function ExportModal({ open, onClose, map }: ExportModalProps) {
  const [state, setState] = useState<ExportState>('preview')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pngBlob, setPngBlob] = useState<Blob | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const boundary = useStore((s) => s.boundary)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)
  const housePoints = useStore((s) => s.housePoints)
  const customStatuses = useStore((s) => s.customStatuses)

  const getExportOptions = useCallback(() => {
    const legendEntries = collectLegend(
      housePoints.map((h) => ({ tags: (h.properties.tags as string[]) || [] })),
      customStatuses,
    )
    return {
      map: map!,
      boundary: boundary!,
      cardWidthInches,
      cardHeightInches,
      territoryNumber,
      legendEntries,
    }
  }, [map, boundary, cardWidthInches, cardHeightInches, territoryNumber, housePoints, customStatuses])

  // Generate preview when modal opens
  useEffect(() => {
    if (!open || !boundary || !map) return

    let cancelled = false
    setState('generating')
    setPreviewUrl(null)
    setPngBlob(null)
    setErrorMsg('')

    exportToPng(getExportOptions())
      .then((blob) => {
        if (cancelled) return
        setPngBlob(blob)
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setState('ready')
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Export failed:', err)
        setErrorMsg(err instanceof Error ? err.message : 'Export failed')
        setState('error')
      })

    return () => { cancelled = true }
  }, [open, boundary, getExportOptions])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handleDownloadPng = useCallback(() => {
    if (!pngBlob) return
    const filename = `territory-${territoryNumber || territoryName || 'map'}.png`
    saveAs(pngBlob, filename)
  }, [pngBlob, territoryName, territoryNumber])

  const handleDownloadPdf = useCallback(async () => {
    if (!boundary) return
    setState('generating')
    try {
      const blob = await exportToPdf(getExportOptions())
      const filename = `territory-${territoryNumber || territoryName || 'map'}.pdf`
      saveAs(blob, filename)
      setState('ready')
    } catch (err) {
      console.error('PDF export failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'PDF export failed')
      setState('error')
    }
  }, [boundary, getExportOptions, territoryName, territoryNumber])

  const handleClose = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPngBlob(null)
    setState('preview')
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_rgba(0,0,0,0.16),0_8px_16px_rgba(0,0,0,0.08)]">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold text-heading">Export Territory Card</h2>
            <p className="mt-0.5 text-[12px] text-body">
              {territoryNumber ? `Territory ${territoryNumber}` : territoryName || 'Territory Map'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-body transition-colors hover:bg-input-bg hover:text-heading"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-y-auto bg-input-bg p-5">
          {state === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={32} strokeWidth={2} className="animate-spin text-brand" />
              <p className="mt-4 text-[14px] font-medium text-heading">Generating your printable file...</p>
              <p className="mt-1 text-[12px] text-body">This may take a few seconds</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <X size={24} strokeWidth={2} className="text-red-500" />
              </div>
              <p className="mt-4 text-[14px] font-medium text-heading">Export failed</p>
              <p className="mt-1 text-[12px] text-body">{errorMsg}</p>
              <button
                onClick={handleClose}
                className="mt-4 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Close
              </button>
            </div>
          )}

          {state === 'ready' && previewUrl && (
            <div className="overflow-hidden rounded-xl border border-divider bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
              <img
                src={previewUrl}
                alt="Territory card preview"
                className="w-full"
              />
            </div>
          )}
        </div>

        {/* Footer — download buttons */}
        {state === 'ready' && (
          <div className="flex items-center gap-3 border-t border-divider px-5 py-3.5">
            <button
              onClick={handleDownloadPng}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(75,108,167,0.3)] transition-colors hover:bg-brand-dark"
            >
              <Download size={15} strokeWidth={2} />
              Download PNG
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-brand px-4 py-2.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-hover"
            >
              <FileText size={15} strokeWidth={2} />
              Download PDF
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
