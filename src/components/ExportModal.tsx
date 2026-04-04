import { useState, useCallback, useEffect, useRef } from 'react'
import { saveAs } from 'file-saver'
import { X, Download, FileText, Loader2, CheckCircle2, AlertCircle, FileCheck2, MapPinned, Home, Route } from 'lucide-react'
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
  const titleId = useRef(`export-modal-title-${Math.random().toString(36).slice(2, 8)}`)
  const descriptionId = useRef(`export-modal-description-${Math.random().toString(36).slice(2, 8)}`)

  const boundary = useStore((s) => s.boundary)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)
  const housePoints = useStore((s) => s.housePoints)
  const treePoints = useStore((s) => s.treePoints)
  const customRoads = useStore((s) => s.customRoads)
  const customStatuses = useStore((s) => s.customStatuses)
  const legendEntries = collectLegend(
    housePoints.map((h) => ({ tags: (h.properties.tags as string[]) || [] })),
    customStatuses,
  )

  const getExportOptions = useCallback(() => {
    return {
      map: map!,
      boundary: boundary!,
      cardWidthInches,
      cardHeightInches,
      territoryNumber,
      legendEntries,
    }
  }, [map, boundary, cardWidthInches, cardHeightInches, territoryNumber, legendEntries])

  // Stable ref to latest export options — reused by async preview generation
  const exportOptionsRef = useRef(getExportOptions)
  const previewUrlRef = useRef<string | null>(null)
  exportOptionsRef.current = getExportOptions

  // Regenerate the preview whenever export-relevant inputs change while the modal is open.
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
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = url
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
  }, [
    open,
    map,
    boundary,
    territoryNumber,
    cardWidthInches,
    cardHeightInches,
    housePoints,
    treePoints,
    customRoads,
    customStatuses,
  ])

  // Reset progressStage when modal opens fresh
  useEffect(() => {
    if (open) {
      setProgressStage('')
      setPreviewNaturalWidth(null)
    }
  }, [open])

  // Reset image dimensions when preview URL changes
  useEffect(() => {
    previewUrlRef.current = previewUrl
    setPreviewNaturalWidth(null)
  }, [previewUrl])

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

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
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setPngBlob(null)
    setState('preview')
    setProgressStage('')
    setPreviewNaturalWidth(null)
    onClose()
  }

  if (!open) return null

  const dpi = previewNaturalWidth ? Math.round(previewNaturalWidth / cardWidthInches) : null
  const exportTitle = territoryNumber ? `Territory ${territoryNumber}` : territoryName || 'Territory Map'
  const checklist = [
    {
      label: 'Boundary is ready',
      detail: boundary ? 'Territory outline will frame the export.' : 'Draw a boundary before exporting.',
      ok: boundary !== null,
    },
    {
      label: 'Card identity is set',
      detail: territoryNumber || territoryName ? exportTitle : 'Add a territory name or number for a clearer export.',
      ok: Boolean(territoryNumber || territoryName),
    },
    {
      label: 'Preview is export-quality',
      detail: dpi === null ? 'Preparing preview resolution...' : dpi >= 250 ? `${dpi} DPI preview is print ready.` : `${dpi} DPI preview may print softer than expected.`,
      ok: dpi === null ? true : dpi >= 250,
    },
    {
      label: 'Legend matches used tags',
      detail: legendEntries.length > 0 ? `${legendEntries.length} legend item${legendEntries.length === 1 ? '' : 's'} will be included.` : 'No legend items detected from current house tags.',
      ok: true,
    },
  ]

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
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        aria-describedby={descriptionId.current}
        className="relative mx-4 flex max-h-[90vh] w-full max-w-150 flex-col overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_rgba(0,0,0,0.16),0_8px_16px_rgba(0,0,0,0.08)]"
      >

        {/* Header */}
        <div className="flex items-center justify-between border-b border-divider px-5 py-3.5">
          <div>
            <h2 id={titleId.current} className="text-[15px] font-semibold text-heading">Export Territory Card</h2>
            <p id={descriptionId.current} className="mt-0.5 text-[12px] text-body">
              {exportTitle}
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
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_20rem]">
            <div className="rounded-2xl border border-divider/60 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-body/70">Export Summary</p>
                  <h3 className="mt-1 text-[14px] font-semibold text-heading">{exportTitle}</h3>
                  <p className="mt-1 text-[12px] text-body/70">
                    What you see in the preview is what will export in PNG and PDF.
                  </p>
                </div>
                <div className="rounded-2xl bg-brand/7 p-2 text-brand">
                  <FileCheck2 size={18} strokeWidth={2} />
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-body/60">
                    <MapPinned size={14} strokeWidth={2} />
                    <span className="text-[11px] font-medium">Size</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-heading">
                    {cardWidthInches} x {cardHeightInches} in
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-body/60">
                    <Home size={14} strokeWidth={2} />
                    <span className="text-[11px] font-medium">Houses</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-heading">{housePoints.length}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2 text-body/60">
                    <Route size={14} strokeWidth={2} />
                    <span className="text-[11px] font-medium">Roads</span>
                  </div>
                  <p className="mt-1 text-[13px] font-semibold text-heading">{customRoads.length}</p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-body/70">
                  Trees: {treePoints.length}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-body/70">
                  Legend items: {legendEntries.length}
                </span>
                {dpiBadge}
              </div>
            </div>

            <div className="rounded-2xl border border-divider/60 bg-white px-4 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-body/70">Checklist</p>
              <div className="mt-2 space-y-2.5">
                {checklist.map((item) => (
                  <div key={item.label} className="rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      {item.ok ? (
                        <CheckCircle2 size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-emerald-600" />
                      ) : (
                        <AlertCircle size={16} strokeWidth={2.2} className="mt-0.5 shrink-0 text-amber-600" />
                      )}
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-heading">{item.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-body/68">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {state === 'generating' && (
            <div className="flex flex-col items-center justify-center py-16" role="status" aria-live="polite">
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
              </div>
              {legendEntries.length > 0 && (
                <div className="border-t border-divider/50 px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-body/70">Legend Preview</p>
                  <div className="flex flex-wrap gap-2">
                    {legendEntries.map((entry) => (
                      <span
                        key={`${entry.type}-${entry.label}`}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-body/80"
                      >
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        {entry.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
