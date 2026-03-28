import { useState, useCallback, useEffect, useRef } from 'react'
import type { Feature, Polygon, LineString } from 'geojson'
import maplibregl from 'maplibre-gl'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
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
import { useStore } from './store'
import { useDraw } from './hooks/useDraw'
import { useAutoSave, useLoadOnStart } from './hooks/useProject'

export default function App() {
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null)

  useAutoSave()
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
      setMode(mode)
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
          'flex shrink-0 flex-col border-r border-divider bg-sidebar-bg',
          isTablet
            ? `fixed inset-y-0 left-0 z-40 w-[280px] shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out ${
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
        <div className="bg-linear-to-b from-brand to-brand-dark px-5 pb-5 pt-5">
          <h1 className="text-[16px] font-bold tracking-tight text-white">MapCards</h1>
          <p className="mt-0.5 text-[11px] font-medium text-white/50">Territory Card Maker</p>
        </div>

        <div className="sidebar-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* Project */}
          <div className="px-5 pt-5 pb-3">
            <ProjectManager />
          </div>

          <div className="mx-5 border-t border-divider/50" />

          {/* Card Settings */}
          <div className="px-5 py-2.5">
            <SidebarSection title="Card Settings">
              <CardSettings />
            </SidebarSection>
          </div>

          <div className="mx-5 border-t border-divider/50" />

          {/* Export */}
          <div className="px-5 py-2.5">
            <SidebarSection title="Export">
              <ExportPanel onExport={() => setExportOpen(true)} />
            </SidebarSection>
          </div>

          {/* Empty state guidance */}
          {!boundary && housePoints.length === 0 && customRoads.length === 0 && (
            <div className="mx-5 mt-3 rounded-xl bg-brand/5 px-4 py-5 text-center">
              <div className="mx-auto mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-brand/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-brand">
                  <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
                </svg>
              </div>
              <p className="text-[13px] font-semibold text-heading">Draw a territory</p>
              <p className="mt-1 text-[11px] leading-relaxed text-body/70">
                Use the toolbar above the map to trace your boundary, then place houses and roads.
              </p>
            </div>
          )}

          {/* Stats — compact inline */}
          {(boundary || customRoads.length > 0 || housePoints.length > 0) && (
            <div className="px-5 pb-4 pt-2">
              <div className="flex items-center gap-3 text-[13px]">
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
      </aside>

      {/* Map */}
      <main className="relative min-w-0 flex-1">
        <MapView onMapReady={handleMapReady} />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className={`absolute left-3 top-3 z-10 flex items-center justify-center rounded-xl border border-white/50 bg-white/85 text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all hover:bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-95 ${
            isTablet ? 'h-11 w-11' : 'h-9 w-9'
          }`}
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={isTablet ? 20 : 16} strokeWidth={2} /> : <PanelLeftOpen size={isTablet ? 20 : 16} strokeWidth={2} />}
        </button>

        <FloatingSettings />

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
        <HouseEditPopup />
        <TreeActionPopup />
        <RoadDeleteButton />
        <MapModeThumbnail
          currentMode={mapMode === 'auto' ? (boundary === null ? 'satellite' : 'street') : mapMode}
          onModeChange={setMapMode}
          map={mapInstance}
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
    </div>
  )
}
