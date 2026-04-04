import { useState, useCallback, useEffect, useRef } from 'react'
import type { Feature, Polygon, LineString } from 'geojson'
import maplibregl from 'maplibre-gl'
// No lucide imports needed — sidebar tab uses custom SVG triangles
import BoundaryPolygonIcon from './components/icons/BoundaryPolygonIcon'
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
import SidebarSection from './components/SidebarSection'
import ConfirmDialog, { showConfirm } from './components/ConfirmDialog'
import Toast from './components/Toast'
import AriaLiveRegion from './components/AriaLiveRegion'
import { useStore } from './store'
import { useDraw } from './hooks/useDraw'
import { useAutoSave, useLoadOnStart } from './hooks/useProject'

export default function App() {
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)
  const [showSaved, setShowSaved] = useState(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(null)

  useAutoSave(() => {
    setShowSaved(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => setShowSaved(false), 2500)
  })
  useLoadOnStart()

  const activeDrawMode = useStore((s) => s.activeDrawMode)
  const setActiveDrawMode = useStore((s) => s.setActiveDrawMode)
  const boundary = useStore((s) => s.boundary)
  const setBoundary = useStore((s) => s.setBoundary)
  const addCustomRoad = useStore((s) => s.addCustomRoad)
  const customRoads = useStore((s) => s.customRoads)
  const housePoints = useStore((s) => s.housePoints)
  const mapMode = useStore((s) => s.mapMode)
  const setMapMode = useStore((s) => s.setMapMode)

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
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [basemapPanelOpen, setBasemapPanelOpen] = useState(false)
  const isTablet = useIsTablet()

  // Auto-close sidebar on tablet when entering draw mode
  useEffect(() => {
    if (isTablet && (activeDrawMode === 'boundary' || activeDrawMode === 'road')) {
      setSidebarOpen(false)
    }
  }, [isTablet, activeDrawMode])

  // Start with sidebar closed on tablet
  useEffect(() => {
    if (isTablet) setSidebarOpen(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
        useStore.getState().setSelectedHouseId(null)
        useStore.getState().setSelectedRoadId(null)
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
  }, [setActiveDrawMode, setMode, undo, redo])

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
      const marker = new maplibregl.Marker({ color: '#4B6CA7' })
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

  return (
    <div className="touch-lock flex h-dvh w-full">
      {/* Backdrop — tablet overlay only */}
      {isTablet && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={[
          'flex shrink-0 flex-col border-r border-divider bg-sidebar-bg/96 backdrop-blur-sm',
          isTablet
            ? `fixed inset-y-0 left-0 z-40 w-[280px] shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `transition-[width] duration-300 ease-out ${
                sidebarOpen ? 'w-68' : 'w-0 overflow-hidden border-r-0'
              }`,
          !isTablet && (activeDrawMode === 'boundary' || activeDrawMode === 'road') ? 'sidebar-drawing' : '',
        ].filter(Boolean).join(' ')}
        onMouseEnter={(e) => {
          if (!isTablet && activeDrawMode) e.currentTarget.classList.remove('sidebar-drawing')
        }}
        onMouseLeave={(e) => {
          if (!isTablet && (activeDrawMode === 'boundary' || activeDrawMode === 'road'))
            e.currentTarget.classList.add('sidebar-drawing')
        }}
      >
        {/* Header */}
        <div className="bg-linear-to-b from-brand to-brand-dark px-5 pb-5 pt-5 shadow-[inset_0_-1px_0_rgba(255,255,255,0.1)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[16px] font-bold tracking-tight text-white">MapCards</h1>
              <p className="mt-0.5 text-[11px] font-medium text-white/55">Territory Card Maker</p>
            </div>
            <span className="rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-white/80 backdrop-blur-sm">
              STUDIO
            </span>
          </div>
        </div>

        <div className="sidebar-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* Project */}
          <div className="px-4 pt-4 pb-3">
            <ProjectManager />
          </div>

          <div className="mx-4 border-t border-divider/50" />

          {/* Card Settings */}
          <div className="px-4 py-2.5">
            <SidebarSection title="Card Settings">
              <CardSettings />
            </SidebarSection>
          </div>

          <div className="mx-4 border-t border-divider/50" />

          {/* Export */}
          <div className="px-4 py-2.5">
            <SidebarSection title="Export">
              <ExportPanel onExport={() => setExportOpen(true)} />
            </SidebarSection>
          </div>

          {/* Workflow progress dots */}
          <div className="mx-4 mt-2 rounded-2xl border border-divider/60 bg-white/80 px-4 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-body/75">Progress</p>
              <p className="text-[11px] font-medium text-body/55">
                {[boundary !== null, customRoads.length > 0, housePoints.length > 0].filter(Boolean).length}/3 complete
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
            {[
              { label: 'Boundary', done: boundary !== null },
              { label: 'Roads', done: customRoads.length > 0 },
              { label: 'Houses', done: housePoints.length > 0 },
              { label: 'Export', done: false },
            ].map((step, i) => (
              <div key={step.label} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-2 w-2 rounded-full transition-all duration-300 ${
                    step.done ? 'bg-brand scale-100' : 'bg-slate-200 scale-90'
                  }`} style={step.done ? { animation: 'dot-fill 300ms ease-out' } : undefined} />
                  <span className={`text-[9px] font-medium ${step.done ? 'text-brand' : 'text-body/40'}`}>
                    {step.label}
                  </span>
                </div>
                {i < 3 && <div className={`mb-3 h-px w-4 ${step.done ? 'bg-brand/30' : 'bg-slate-200'}`} />}
              </div>
            ))}
            </div>
          </div>

          {/* Contextual guidance */}
          {!boundary && (
            <div className="mx-4 mt-3 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-4 text-center shadow-[0_4px_14px_rgba(75,108,167,0.06)]">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
                <BoundaryPolygonIcon size={16} strokeWidth={2} className="text-brand" />
              </div>
              <p className="text-[12px] font-semibold text-heading">Draw a boundary</p>
              <p className="mt-0.5 text-[10px] leading-relaxed text-body/60">
                Define your territory on the map to get started.
              </p>
            </div>
          )}
          {boundary && customRoads.length === 0 && (
            <div className="mx-4 mt-3 rounded-xl border border-divider/60 bg-white/75 px-3 py-3 text-center">
              <p className="text-[11px] text-body/60">
                <span className="font-medium text-body/80">Next:</span> Add roads to help navigate
              </p>
            </div>
          )}
          {boundary && customRoads.length > 0 && housePoints.length === 0 && (
            <div className="mx-4 mt-3 rounded-xl border border-divider/60 bg-white/75 px-3 py-3 text-center">
              <p className="text-[11px] text-body/60">
                <span className="font-medium text-body/80">Next:</span> Place houses in your territory
              </p>
            </div>
          )}

          {/* Stats — compact inline */}
          {(boundary || customRoads.length > 0 || housePoints.length > 0) && (
            <div className="px-4 pb-4 pt-3">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-divider/60 bg-white/80 px-3.5 py-3 text-[13px] shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
                <span className={`inline-flex items-center gap-1.5 font-medium ${boundary ? 'text-emerald-text' : 'text-body/40'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${boundary ? 'bg-emerald-500' : 'bg-body/20'}`} />
                  Boundary
                </span>
                <span className="font-semibold tabular-nums text-body">
                  {customRoads.length} <span className="font-medium text-body/50">roads</span>
                </span>
                <span className="font-semibold tabular-nums text-body">
                  {housePoints.length} <span className="font-medium text-body/50">houses</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Auto-save indicator */}
        <div className="shrink-0 border-t border-divider/30 bg-white/55 px-4 py-2.5 backdrop-blur-sm">
          <p className={`flex items-center text-[10px] font-medium text-body/45 transition-opacity duration-150 ${showSaved ? 'save-indicator' : 'opacity-0'}`}>
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 mr-1.5 align-middle" />
            Saved
          </p>
        </div>
      </aside>

      {/* Map */}
      <main className={`relative min-w-0 flex-1 ${
        activeDrawMode === 'boundary' ? 'drawing-glow-boundary' :
        activeDrawMode === 'road' ? 'drawing-glow-road' : ''
      }`}>
        <MapView onMapReady={handleMapReady} />

        {/* Sidebar collapse/expand tab — Google Earth style edge handle */}
        {!basemapPanelOpen && (
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'Collapse panel' : 'Expand panel'}
          className={`absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center transition-all duration-200 active:scale-[0.96] ${
            isTablet
              ? 'left-0 h-11 w-6 rounded-r-xl border-y border-r border-white/30 bg-white/85 text-slate-500 shadow-[2px_0_10px_rgba(0,0,0,0.12)] backdrop-blur-md hover:bg-white hover:text-slate-700'
              : 'left-0 h-14 w-6 rounded-r-xl border-y border-r border-divider/60 bg-sidebar-bg/96 text-slate-400 shadow-[2px_0_10px_rgba(0,0,0,0.08)] hover:text-slate-600'
          }`}
          title={sidebarOpen ? 'Collapse panel' : 'Expand panel'}
        >
          <svg width={isTablet ? 8 : 10} height={isTablet ? 12 : 14} viewBox="0 0 8 12" fill="currentColor">
            {sidebarOpen
              ? <path d="M6 0L0 6l6 6V0z" />
              : <path d="M2 0l6 6-6 6V0z" />
            }
          </svg>
        </button>
        )}

        <FloatingSettings map={mapInstance} />

        <MapToolbar
          activeMode={activeDrawMode}
          onModeChange={handleModeChange}
          hasBoundary={boundary !== null}
          onClearBoundary={async () => {
            const ok = await showConfirm(
              'Clear Everything?',
              'This removes the boundary, all houses, trees, and roads. This action cannot be undone.',
              { variant: 'destructive', confirmLabel: 'Clear All' },
            )
            if (!ok) return
            setBoundary(null)
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
        <HouseEditPopup map={mapInstance} />
        <TreeActionPopup />
        <RoadDeleteButton />
        <MapModeThumbnail
          currentMode={mapMode === 'auto' ? (boundary === null ? 'satellite' : 'street') : mapMode}
          onModeChange={setMapMode}
          map={mapInstance}
          onPanelToggle={setBasemapPanelOpen}
        />
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
    </div>
  )
}
