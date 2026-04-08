import { useState, useCallback, useEffect, useId, useRef } from 'react'
import { saveAs } from 'file-saver'
import { X, Download, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useStore } from '../store'
import { exportToPng } from '../lib/exportPng'
import { exportToPdf } from '../lib/exportPdf'
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
  const [errorMsg, setErrorMsg] = useState('')
  const [progressStage, setProgressStage] = useState('')
  const [previewNaturalWidth, setPreviewNaturalWidth] = useState<number | null>(null)
  const titleId = useId()
  const descriptionId = useId()

  const boundary = useStore((s) => s.boundary)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)
  const housePoints = useStore((s) => s.housePoints)
  const treePoints = useStore((s) => s.treePoints)
  const customRoads = useStore((s) => s.customRoads)
  const houseIconSize = useStore((s) => s.houseIconSize)
  const badgeIconSize = useStore((s) => s.badgeIconSize)
  const treeIconSize = useStore((s) => s.treeIconSize)
  const startMarkerSize = useStore((s) => s.startMarkerSize)
  const boundaryOpacity = useStore((s) => s.boundaryOpacity)
  const maskOpacity = useStore((s) => s.maskOpacity)

  const getExportOptions = useCallback(() => ({
    map: map!,
    boundary: boundary!,
    cardWidthInches,
    cardHeightInches,
  }), [
    map,
    boundary,
    cardWidthInches,
    cardHeightInches,
  ])

  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !boundary || !map) return

    let cancelled = false
    const frameId = requestAnimationFrame(() => {
      if (cancelled) return
      setState('generating')
      setProgressStage('Capturing map...')
      setPreviewUrl(null)
      setErrorMsg('')
      setPreviewNaturalWidth(null)

      exportToPng(getExportOptions())
        .then((blob) => {
          if (cancelled) return
          setProgressStage('Building preview...')
          const url = URL.createObjectURL(blob)
          if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
          previewUrlRef.current = url
          setPreviewUrl(url)
          setState('ready')
        })
        .catch((err) => {
          if (cancelled) return
          if (import.meta.env.DEV) console.error('Export failed:', err)
          setErrorMsg(err instanceof Error ? err.message : 'Export failed')
          setState('error')
        })
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
    }
  }, [
    open,
    map,
    boundary,
    cardWidthInches,
    cardHeightInches,
    housePoints,
    treePoints,
    customRoads,
    houseIconSize,
    badgeIconSize,
    treeIconSize,
    startMarkerSize,
    boundaryOpacity,
    maskOpacity,
    getExportOptions,
  ])

  useEffect(() => {
    if (!open) return
    const frameId = requestAnimationFrame(() => {
      setProgressStage('')
      setPreviewNaturalWidth(null)
    })
    return () => cancelAnimationFrame(frameId)
  }, [open])

  useEffect(() => {
    previewUrlRef.current = previewUrl
    const frameId = requestAnimationFrame(() => setPreviewNaturalWidth(null))
    return () => cancelAnimationFrame(frameId)
  }, [previewUrl])

  useEffect(() => {
    return () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current) }
  }, [])

  const handlePreviewLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setPreviewNaturalWidth(e.currentTarget.naturalWidth)
  }, [])

  const handleDownloadPng = useCallback(() => {
    if (!boundary) return
    setState('generating')
    setProgressStage('Capturing map...')
    exportToPng(getExportOptions())
      .then((blob) => {
        saveAs(blob, `territory-${territoryNumber || territoryName || 'map'}.png`)
        setState('ready')
        setProgressStage('')
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.error('PNG export failed:', err)
        setErrorMsg(err instanceof Error ? err.message : 'PNG export failed')
        setState('error')
      })
  }, [boundary, getExportOptions, territoryName, territoryNumber])

  const handleDownloadPdf = useCallback(async () => {
    if (!boundary) return
    setState('generating')
    setProgressStage('Capturing map...')
    try {
      setProgressStage('Building legend...')
      const blob = await exportToPdf(getExportOptions())
      setProgressStage('Generating PDF...')
      saveAs(blob, `territory-${territoryNumber || territoryName || 'map'}.pdf`)
      setState('ready')
    } catch (err) {
      if (import.meta.env.DEV) console.error('PDF export failed:', err)
      setErrorMsg(err instanceof Error ? err.message : 'PDF export failed')
      setState('error')
    }
  }, [boundary, getExportOptions, territoryName, territoryNumber])

  const handleClose = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setState('preview')
    setProgressStage('')
    setPreviewNaturalWidth(null)
    onClose()
  }

  if (!open) return null

  const dpi = previewNaturalWidth ? Math.round(previewNaturalWidth / cardWidthInches) : null
  const exportTitle = territoryNumber ? `Territory ${territoryNumber}` : territoryName || 'Territory Map'
  const hasIdentity = Boolean(territoryNumber || territoryName)
  const hasBoundary = boundary !== null
  const isPrintReady = dpi === null || dpi >= 250
  const warningCount = [hasBoundary, hasIdentity, isPrintReady].filter((v) => !v).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-[6px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative mx-3 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-[0_30px_60px_rgba(15,23,42,0.22),0_12px_24px_rgba(15,23,42,0.1)]"
      >

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-5 py-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[15px] font-bold text-heading">{exportTitle}</h2>
            <div id={descriptionId} className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-body/55">
              <span>{cardWidthInches}&times;{cardHeightInches} in</span>
              <span className="text-body/25">&bull;</span>
              <span>{housePoints.length} houses</span>
              <span className="text-body/25">&bull;</span>
              <span>{customRoads.length} roads</span>
              {treePoints.length > 0 && (
                <>
                  <span className="text-body/25">&bull;</span>
                  <span>{treePoints.length} trees</span>
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* Status badge */}
            {state === 'ready' && (
              warningCount === 0 ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                  <CheckCircle2 size={12} strokeWidth={2.2} />
                  Ready
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                  <AlertCircle size={12} strokeWidth={2.2} />
                  {warningCount} warning{warningCount > 1 ? 's' : ''}
                </span>
              )
            )}
            <button
              onClick={handleClose}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 active:scale-90"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body — preview is the hero */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-[linear-gradient(180deg,#f1f5f9,#e8ecf1)] px-5 py-4">
            {state === 'generating' && (
              <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 py-20 shadow-[0_1px_3px_rgba(15,23,42,0.06)]" role="status" aria-live="polite">
                <Loader2 size={28} strokeWidth={2} className="animate-spin text-brand" />
                <p className="mt-3 text-[13px] font-medium text-heading">{progressStage || 'Generating preview...'}</p>
                <p className="mt-0.5 text-[11px] text-body/50">This may take a few seconds</p>
              </div>
            )}

            {state === 'error' && (
              <div className="flex flex-col items-center justify-center rounded-xl bg-white/80 py-20 shadow-[0_1px_3px_rgba(15,23,42,0.06)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
                  <X size={22} strokeWidth={2} className="text-red-500" />
                </div>
                <p className="mt-3 text-[13px] font-medium text-heading">Export failed</p>
                <p className="mt-0.5 text-[11px] text-body/50">{errorMsg}</p>
                <button
                  onClick={handleClose}
                  className="mt-4 rounded-full bg-brand px-4 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-brand-dark"
                >
                  Close
                </button>
              </div>
            )}

            {state === 'ready' && previewUrl && (
              <div className="overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(15,23,42,0.1),0_1px_3px_rgba(15,23,42,0.06)]">
                <img
                  src={previewUrl}
                  alt="Territory card preview"
                  className="w-full"
                  style={{ aspectRatio: `${cardWidthInches} / ${cardHeightInches}` }}
                  onLoad={handlePreviewLoad}
                />
              </div>
            )}
          </div>

          {/* Warnings — only show if there are issues */}
          {state === 'ready' && warningCount > 0 && (
            <div className="px-5 py-2.5">
              <div className="space-y-1.5">
                {!hasBoundary && (
                  <p className="flex items-center gap-2 text-[11px] text-amber-700">
                    <AlertCircle size={13} strokeWidth={2.2} className="shrink-0" />
                    Draw a boundary before exporting.
                  </p>
                )}
                {!hasIdentity && (
                  <p className="flex items-center gap-2 text-[11px] text-amber-700">
                    <AlertCircle size={13} strokeWidth={2.2} className="shrink-0" />
                    Add a territory name or number for a clearer export.
                  </p>
                )}
                {!isPrintReady && (
                  <p className="flex items-center gap-2 text-[11px] text-amber-700">
                    <AlertCircle size={13} strokeWidth={2.2} className="shrink-0" />
                    {dpi} DPI — may print softer than expected.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer — download buttons */}
        {state === 'ready' && (
          <div className="flex shrink-0 items-center gap-2.5 border-t border-slate-100 px-5 py-3">
            <button
              onClick={handleDownloadPng}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(75,108,167,0.22)] transition-all hover:bg-brand-dark active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
            >
              <Download size={15} strokeWidth={2} />
              Download PNG
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white py-2.5 text-[13px] font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
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
