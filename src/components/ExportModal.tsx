import { useState, useCallback, useEffect, useRef } from 'react'
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
  const [progressStage, setProgressStage] = useState('')
  const [previewNaturalWidth, setPreviewNaturalWidth] = useState<number | null>(null)

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

  // Stable ref to latest export options — avoids re-triggering effect on every render
  const exportOptionsRef = useRef(getExportOptions)
  exportOptionsRef.current = getExportOptions

  // Generate preview when modal opens (only depends on open + boundary identity)
  const boundaryId = boundary ? JSON.stringify(boundary.geometry.coordinates[0].slice(0, 2)) : null
  useEffect(() => {
    if (!open || !boundary || !map) return

    let cancelled = false
    setState('generating')
    setProgressStage('Capturing map...')
    setPreviewUrl(null)
    setPngBlob(null)
    setErrorMsg('')
    setPreviewNaturalWidth(null)

    exportToPng(exportOptionsRef.current())
      .then((blob) => {
        if (cancelled) return
        setPngBlob(blob)
        setProgressStage('Building preview...')
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, boundaryId])

  // Reset progressStage when modal opens fresh
  useEffect(() => {
    if (open) {
      setProgressStage('')
      setPreviewNaturalWidth(null)
    }
  }, [open])

  // Reset image dimensions when preview URL changes
  useEffect(() => {
    setPreviewNaturalWidth(null)
  }, [previewUrl])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const handlePreviewLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget
    setPreviewNaturalWidth(img.naturalWidth)
  }, [])

  const handleDownloadPng = useCallback(() => {
    if (!pngBlob) return
    const filename = `territory-${territoryNumber || territoryName || 'map'}.png`
    saveAs(pngBlob, filename)
  }, [pngBlob, territoryName, territoryNumber])

  const handleDownloadPdf = useCallback(async () => {
    if (!boundary) return
    setState('generating')
    setProgressStage('Capturing map...')
    try {
      setProgressStage('Building legend...')
      const blob = await exportToPdf(getExportOptions())
      setProgressStage('Generating PDF...')
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
    setProgressStage('')
    setPreviewNaturalWidth(null)
    onClose()
  }

  if (!open) return null

  const dpi = previewNaturalWidth ? Math.round(previewNaturalWidth / cardWidthInches) : null

  const dpiBadge = dpi !== null ? (
    dpi >= 250 ? (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Print Ready</span>
    ) : dpi >= 150 ? (
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{dpi} DPI</span>
    ) : (
      <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">Low Resolution</span>
    )
  ) : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-150 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_rgba(0,0,0,0.16),0_8px_16px_rgba(0,0,0,0.08)]">

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
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100/80 text-slate-500 transition-all duration-150 hover:bg-slate-200 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Preview area */}
        <div className="flex-1 overflow-y-auto bg-input-bg p-5">
          {state === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={32} strokeWidth={2} className="animate-spin text-brand" />
              <p className="mt-4 text-[14px] font-medium text-heading">{progressStage || 'Generating your printable file...'}</p>
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
                className="mt-4 rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-dark"
              >
                Close
              </button>
            </div>
          )}

          {state === 'ready' && previewUrl && (
            <div className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,0,0,0.1)]">
              <img
                src={previewUrl}
                alt="Territory card preview"
                className="w-full"
                style={{ aspectRatio: `${cardWidthInches} / ${cardHeightInches}` }}
                onLoad={handlePreviewLoad}
              />
              <div className="flex items-center justify-center gap-2 pb-1 pt-2">
                <span className="text-[11px] text-body/60">{cardWidthInches} &times; {cardHeightInches} in</span>
                {dpiBadge}
              </div>
            </div>
          )}
        </div>

        {/* Footer — download buttons */}
        {state === 'ready' && (
          <div className="flex items-center gap-3 border-t border-divider px-5 py-3.5">
            <button
              onClick={handleDownloadPng}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_1px_3px_rgba(75,108,167,0.3)] transition-colors hover:bg-brand-dark active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <Download size={15} strokeWidth={2} />
              Download PNG
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-brand px-4 py-2.5 text-[13px] font-semibold text-brand transition-colors hover:bg-brand-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
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
