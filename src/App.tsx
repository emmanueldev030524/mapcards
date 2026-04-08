import { useState, useCallback, useEffect, useRef } from 'react'
import type { Feature, Polygon, LineString } from 'geojson'
import maplibregl from 'maplibre-gl'
// No lucide imports needed — sidebar tab uses custom SVG triangles
import BoundaryPolygonIcon from './components/icons/BoundaryPolygonIcon'
import { BRAND } from './lib/colors'
import { useIsTablet } from './hooks/useMediaQuery'
import MapView from './components/MapView'
import MapToolbar from './components/MapToolbar'
import FloatingSettings from './components/FloatingSettings'
import type { LocationSelection } from './components/LocationSearch'
import MapModeThumbnail from './components/MapModeThumbnail'
import CardSettings from './components/CardSettings'
import ProjectManager from './components/ProjectManager'
import ExportPanel from './components/ExportPanel'
import ExportModal from './components/ExportModal'
import BulkFillDialog from './components/BulkFillDialog'
import HouseEditPopup from './components/HouseEditPopup'
import TreeActionPopup from './components/TreeActionPopup'
import RoadDeleteButton from './components/RoadDeleteButton'
import StartMarkerPopup from './components/StartMarkerPopup'
import SidebarSection from './components/SidebarSection'
import ConfirmDialog, { showConfirm } from './components/ConfirmDialog'
import Toast from './components/Toast'
import AriaLiveRegion from './components/AriaLiveRegion'
import TooltipProvider from './components/TooltipProvider'
import SaveStatus from './components/SaveStatus'
import ReviewOverlay from './components/ReviewOverlay'
import { useStore } from './store'
import { useDraw } from './hooks/useDraw'
import { useAutoSave, useLoadOnStart } from './hooks/useProject'
import { tooltipAttrs } from './lib/tooltips'

export default function App() {
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)

  const { saveState, lastSavedAt, flushSave } = useAutoSave()
  useLoadOnStart()

  const activeDrawMode = useStore((s) => s.activeDrawMode)
  const setActiveDrawMode = useStore((s) => s.setActiveDrawMode)
  const boundary = useStore((s) => s.boundary)
  const setBoundary = useStore((s) => s.setBoundary)
  const addCustomRoad = useStore((s) => s.addCustomRoad)
  const customRoads = useStore((s) => s.customRoads)
  const housePoints = useStore((s) => s.housePoints)
  const treePoints = useStore((s) => s.treePoints)
  const startMarker = useStore((s) => s.startMarker)
  const mapMode = useStore((s) => s.mapMode)
  const setMapMode = useStore((s) => s.setMapMode)
  const reviewMode = useStore((s) => s.reviewMode)
  const setReviewMode = useStore((s) => s.setReviewMode)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)
  const hasReviewContent =
    boundary !== null ||
    customRoads.length > 0 ||
    housePoints.length > 0 ||
    treePoints.length > 0 ||
    startMarker !== null

  const handleBoundaryComplete = useCallback(
    (feature: Feature<Polygon>) => {
      setBoundary(feature)
      setActiveDrawMode(null)
    },
    [setBoundary, setActiveDrawMode],
  )

  const handleRoadComplete = useCallback(
    (feature: Feature<LineString>) => {
      addCustomRoad(feature)
    },
    [addCustomRoad],
  )

  const { initDraw, setMode, undo, redo, clearAll, finish, getVertexCount } = useDraw({
    onBoundaryComplete: handleBoundaryComplete,
    onRoadComplete: handleRoadComplete,
  })

  const handleMapReady = useCallback(
    (map: maplibregl.Map) => {
      setMapInstance(map)
      initDraw(map)
    },
    [initDraw],
  )

  const [bulkFillOpen, setBulkFillOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(
    () => (typeof window === 'undefined' ? true : window.innerWidth >= 1280),
  )
  const [basemapPanelOpen, setBasemapPanelOpen] = useState(false)
  const isTablet = useIsTablet()

  // Smart sidebar auto-collapse during drawing mode.
  //
  // Rules:
  // 1. When a drawing mode starts (boundary / road / house / tree / startMarker),
  //    collapse the sidebar ONCE so the user gets maximum canvas space.
  // 2. `select` is excluded — it's edit-mode, not drawing, and users often need
  //    sidebar access while selecting items.
  // 3. The `autoCollapsedRef` latch ensures we only fire once per drawing
  //    session. If the user manually reopens the sidebar mid-drawing, we don't
  //    fight them — they can toggle freely and we leave their choice alone.
  // 4. When drawing ends, we reset the latch (so the next session auto-collapses
  //    again) but we do NOT touch `sidebarOpen`. The sidebar stays in whatever
  //    state the user left it — the predictable "respect user intent" behavior.
  const autoCollapsedRef = useRef(false)
  useEffect(() => {
    const isDrawingMode = activeDrawMode !== null && activeDrawMode !== 'select'
    if (isDrawingMode) {
      if (!autoCollapsedRef.current) {
        autoCollapsedRef.current = true
        const frame = window.requestAnimationFrame(() => {
          setSidebarOpen(false)
        })
        return () => window.cancelAnimationFrame(frame)
      }
    } else {
      autoCollapsedRef.current = false
    }
  }, [activeDrawMode])

  const handleModeChange = useCallback(
    (mode: typeof activeDrawMode) => {
      if (mode === 'bulkFill') {
        setBulkFillOpen(true)
        return
      }
      setActiveDrawMode(mode)
      // Only call useDraw's setMode for line-drawing modes it handles
      if (mode === 'boundary' || mode === 'road' || mode === null) {
        setMode(mode)
      } else {
        setMode(null) // clear any active drawing state
      }
    },
    [setMode, setActiveDrawMode],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts while typing in an input
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'Escape') {
        setActiveDrawMode(null)
        setMode(null)
        setBulkFillOpen(false)
        setReviewMode(false)
        useStore.getState().setSelectedHouseId(null)
        useStore.getState().setSelectedTreeId(null)
        useStore.getState().setSelectedRoadId(null)
        useStore.getState().setSelectedStartMarker(false)
      }
      // Ctrl+Z / Cmd+Z = undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        // If actively drawing, undo last vertex; otherwise undo last store action
        if (useStore.getState().activeDrawMode) {
          undo()
        } else {
          useStore.getState().undoAction()
        }
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        if (useStore.getState().activeDrawMode) {
          redo()
        } else {
          useStore.getState().redoAction()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setActiveDrawMode, setMode, setReviewMode, undo, redo])

  const handleLocationSelect = useCallback(
    (selection: LocationSelection) => {
      if (!mapInstance) return

      // Remove previous search marker
      if (searchMarkerRef.current) {
        searchMarkerRef.current.remove()
        searchMarkerRef.current = null
      }

      // Fly to location with smooth easing
      mapInstance.flyTo({
        center: [selection.lng, selection.lat],
        zoom: 16,
        duration: 2000,
        essential: true,
        curve: 1.42,
      })

      // Drop a marker pin with a popup showing the location name
      const marker = new maplibregl.Marker({ color: BRAND })
        .setLngLat([selection.lng, selection.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25, closeButton: false })
            .setText(selection.name.split(',')[0])
        )
        .addTo(mapInstance)

      // Show the popup immediately
      marker.togglePopup()

      searchMarkerRef.current = marker
    },
    [mapInstance],
  )

  const handleReviewToggle = useCallback(() => {
    const next = !reviewMode
    if (next) {
      setActiveDrawMode(null)
      setMode(null)
      setBulkFillOpen(false)
      useStore.getState().setSelectedHouseId(null)
      useStore.getState().setSelectedTreeId(null)
      useStore.getState().setSelectedRoadId(null)
      useStore.getState().setSelectedStartMarker(false)
    }
    setReviewMode(next)
  }, [reviewMode, setActiveDrawMode, setMode, setReviewMode])

  return (
    <div className="touch-lock relative flex h-dvh w-full overflow-hidden">
      {/* Backdrop — tablet overlay only */}
      {!reviewMode && isTablet && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      {!reviewMode && (
        <aside
        data-tooltip-exclusion="sidebar-panel"
        className={
          isTablet
            ? `sidebar-panel-surface fixed inset-y-0 left-0 z-40 flex w-[min(22rem,calc(100vw-1.5rem))] shrink-0 flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `sidebar-panel-surface absolute inset-y-0 left-0 z-20 flex w-68 shrink-0 flex-col transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full border-r-0'
              }`
        }
      >
        {/* Header */}
        <div className="sidebar-header-surface px-4 pb-5 pt-5 sm:px-5">
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <h1 className="text-base font-bold tracking-[-0.02em] text-white sm:text-[17px]">MapCards</h1>
              <p className="mt-1 text-[11px] font-medium tracking-[0.015em] text-white/72 sm:text-[11.5px]">Territory Card Maker</p>
            </div>
            <span className="rounded-full border border-white/18 bg-white/14 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-white/88 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] backdrop-blur-md">
              STUDIO
            </span>
          </div>
        </div>

        <div className="sidebar-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* Project */}
          <div className="px-3.5 pt-3 pb-2.5">
            <ProjectManager
              refreshKey={lastSavedAt}
              flushPendingSave={flushSave}
            />
          </div>

          <div className="mx-4 border-t border-white/55" />

          {/* Card Settings */}
          <div className="px-3.5 py-2">
            <SidebarSection title="Card Settings">
              <CardSettings />
            </SidebarSection>
          </div>

          <div className="mx-4 border-t border-white/55" />

          {/* Export */}
          <div className="px-3.5 py-2">
            <SidebarSection title="Export">
              <ExportPanel onExport={() => setExportOpen(true)} />
            </SidebarSection>
          </div>

          {/* Workflow progress dots */}
          <div className="sidebar-card-surface mx-3.5 mt-2 px-4 py-3.5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="sidebar-section-heading">Progress</p>
              <p className="text-[11px] font-semibold tracking-[0.01em] text-body/58">
                {[boundary !== null, customRoads.length > 0, housePoints.length > 0].filter(Boolean).length}/3 complete
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5">
            {[
              { label: 'Boundary', done: boundary !== null },
              { label: 'Roads', done: customRoads.length > 0 },
              { label: 'Houses', done: housePoints.length > 0 },
              { label: 'Export', done: false },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_rgba(255,255,255,0.78)] transition-all duration-300 ${
                    step.done ? 'scale-100 bg-brand' : 'scale-90 bg-slate-300/80'
                  }`} style={step.done ? { animation: 'dot-fill 300ms ease-out' } : undefined} />
                  <span className={`text-[9.5px] font-semibold tracking-[0.02em] ${step.done ? 'text-brand' : 'text-body/42'}`}>
                    {step.label}
                  </span>
                </div>
                {i < 3 && <div className={`mb-3 h-px w-5 rounded-full ${step.done ? 'bg-brand/28' : 'bg-slate-200/90'}`} />}
              </div>
            ))}
            </div>
          </div>

          {/* Contextual guidance */}
          {!boundary && (
            <div className="sidebar-card-surface mx-3.5 mt-3 border-brand/10 bg-[linear-gradient(180deg,rgba(95,129,191,0.08),rgba(255,255,255,0.88))] px-4 py-4 text-center">
              <div className="mx-auto mb-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-brand/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                <BoundaryPolygonIcon size={16} strokeWidth={2} className="text-brand" />
              </div>
              <p className="text-[12px] font-semibold tracking-[-0.01em] text-heading">Draw a boundary</p>
              <p className="mt-1 text-[10px] leading-relaxed text-body/66">
                Define your territory on the map to get started.
              </p>
            </div>
          )}
          {boundary && customRoads.length === 0 && (
            <div className="sidebar-card-surface-soft mx-3.5 mt-3 px-3.5 py-3 text-center">
              <p className="text-[11px] text-body/64">
                <span className="font-medium text-body/80">Next:</span> Add roads to help navigate
              </p>
            </div>
          )}
          {boundary && customRoads.length > 0 && housePoints.length === 0 && (
            <div className="sidebar-card-surface-soft mx-3.5 mt-3 px-3.5 py-3 text-center">
              <p className="text-[11px] text-body/64">
                <span className="font-medium text-body/80">Next:</span> Place houses in your territory
              </p>
            </div>
          )}

          {/* Stats — compact inline */}
          {(boundary || customRoads.length > 0 || housePoints.length > 0) && (
            <div className="px-3.5 pb-4 pt-3">
              <div className="sidebar-card-surface flex flex-wrap items-center gap-2.5 px-3.5 py-3 text-[12.5px]">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold tracking-[0.01em] ${boundary ? 'bg-emerald-50/90 text-emerald-text' : 'bg-slate-100/80 text-body/45'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${boundary ? 'bg-emerald-500' : 'bg-body/20'}`} />
                  Boundary
                </span>
                <span className="font-semibold tabular-nums tracking-[0.01em] text-body">
                  {customRoads.length} <span className="font-medium text-body/50">roads</span>
                </span>
                <span className="font-semibold tabular-nums tracking-[0.01em] text-body">
                  {housePoints.length} <span className="font-medium text-body/50">houses</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Auto-save indicator */}
        <div className="shrink-0 border-t border-white/55 bg-white/45 px-4 py-2.5 backdrop-blur-md">
          <SaveStatus saveState={saveState} lastSavedAt={lastSavedAt} />
        </div>
      </aside>
      )}

      {/* Map */}
      <main className={`review-shell relative min-w-0 flex-1 ${
        reviewMode ? 'review-mode' : ''
      } ${
        activeDrawMode === 'boundary' ? 'drawing-glow-boundary' :
        activeDrawMode === 'road' ? 'drawing-glow-road' : ''
      }`}>
        <MapView onMapReady={handleMapReady} />

        {/* Sidebar collapse/expand tab — Google Earth style edge handle */}
        {!reviewMode && !basemapPanelOpen && (
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'Collapse panel' : 'Expand panel'}
          data-tooltip-exclusion="sidebar-handle"
          {...tooltipAttrs({
            label: sidebarOpen ? 'Hide side panel' : 'Show side panel',
            description: sidebarOpen ? 'Make more room for the map.' : 'Open the project controls.',
          })}
          className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center transition-all duration-200 active:scale-[0.96] ${
            isTablet
              ? 'left-0 h-11 w-6 rounded-r-xl border-y border-r border-white/45 bg-white/84 text-slate-500 shadow-[2px_0_10px_rgba(15,23,42,0.12),inset_0_1px_0_rgba(255,255,255,0.72)] backdrop-blur-md hover:bg-white/94 hover:text-slate-700'
              : `${sidebarOpen ? 'left-68' : 'left-0'} h-16 w-7 rounded-r-2xl border-y border-r border-white/55 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(244,247,251,0.88))] text-slate-600 shadow-[0_14px_28px_rgba(15,23,42,0.16),0_2px_6px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.82)] backdrop-blur-md hover:bg-white hover:text-slate-800`
          }`}
        >
          {!isTablet && (
            <span
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-7 w-0.75 -translate-y-1/2 rounded-r-full bg-brand/70 shadow-[0_0_10px_rgba(75,108,167,0.35)]"
            />
          )}
          <svg width={isTablet ? 8 : 10} height={isTablet ? 12 : 14} viewBox="0 0 8 12" fill="currentColor">
            {sidebarOpen
              ? <path d="M6 0L0 6l6 6V0z" />
              : <path d="M2 0l6 6-6 6V0z" />
            }
          </svg>
        </button>
        )}

        {reviewMode && (
          <ReviewOverlay
            territoryName={territoryName}
            territoryNumber={territoryNumber}
            cardWidthInches={cardWidthInches}
            cardHeightInches={cardHeightInches}
            onExport={() => setExportOpen(true)}
            onExitReview={handleReviewToggle}
          />
        )}

        {!reviewMode && <FloatingSettings map={mapInstance} />}

        {!reviewMode && (
        <MapToolbar
          activeMode={activeDrawMode}
          onModeChange={handleModeChange}
          hasBoundary={boundary !== null}
          canReview={hasReviewContent}
          onReviewToggle={handleReviewToggle}
          onClearBoundary={async () => {
            const ok = await showConfirm(
              'Clear Everything?',
              'This removes the boundary, start marker, all houses, trees, and roads. This action cannot be undone.',
              { variant: 'destructive', confirmLabel: 'Clear All' },
            )
            if (!ok) return
            setBoundary(null)
            useStore.getState().setStartMarker(null)
            useStore.getState().setSelectedStartMarker(false)
            clearAll()
            useStore.getState().clearAllHouses()
            useStore.getState().clearAllTrees()
            const roads = useStore.getState().customRoads
            for (const r of roads) useStore.getState().removeCustomRoad(r.id as string)
          }}
          onDrawUndo={undo}
          onDrawRedo={redo}
          onDrawFinish={finish}
          getVertexCount={getVertexCount}
          onLocationSelect={handleLocationSelect}
        />
        )}
        {!reviewMode && <HouseEditPopup map={mapInstance} />}
        {!reviewMode && <TreeActionPopup />}
        {!reviewMode && <RoadDeleteButton />}
        {!reviewMode && <StartMarkerPopup />}
        {!reviewMode && <MapModeThumbnail
          currentMode={mapMode === 'auto' ? (boundary === null ? 'satellite' : 'street') : mapMode}
          onModeChange={setMapMode}
          map={mapInstance}
          onPanelToggle={setBasemapPanelOpen}
          sidebarOpen={sidebarOpen}
        />}
      </main>

      <BulkFillDialog
        map={mapInstance}
        open={bulkFillOpen}
        onClose={() => setBulkFillOpen(false)}
      />

      <ExportModal
        map={mapInstance}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />

      <ConfirmDialog />
      <Toast />
      <AriaLiveRegion />
      <TooltipProvider />
    </div>
  )
}
