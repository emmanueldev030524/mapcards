import { useState, useCallback, useEffect, useRef } from 'react'
import type { Feature, Polygon, LineString } from 'geojson'
import maplibregl from 'maplibre-gl'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import MapView from './components/MapView'
import MapToolbar from './components/MapToolbar'
import Toolbar from './components/Toolbar'
import LocationSearch from './components/LocationSearch'
import type { LocationSelection } from './components/LocationSearch'
import CardSettings from './components/CardSettings'
import LayerToggle from './components/LayerToggle'
import ProjectManager from './components/ProjectManager'
import ExportPanel from './components/ExportPanel'
import ExportModal from './components/ExportModal'
import BulkFillDialog from './components/BulkFillDialog'
import HouseEditPopup from './components/HouseEditPopup'
import RoadDeleteButton from './components/RoadDeleteButton'
import SidebarSection from './components/SidebarSection'
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
    <div className="flex h-dvh w-full">
      {/* Sidebar */}
      <aside
        className={`flex shrink-0 flex-col border-r border-divider bg-sidebar-bg transition-[width] duration-300 ease-out ${
          sidebarOpen ? 'w-68' : 'w-0 overflow-hidden border-r-0'
        } ${
          activeDrawMode === 'boundary' || activeDrawMode === 'road' ? 'sidebar-drawing' : ''
        }`}
        onMouseEnter={(e) => {
          if (activeDrawMode) e.currentTarget.classList.remove('sidebar-drawing')
        }}
        onMouseLeave={(e) => {
          if (activeDrawMode === 'boundary' || activeDrawMode === 'road')
            e.currentTarget.classList.add('sidebar-drawing')
        }}
      >
        {/* Header — flat brand color */}
        <div className="bg-brand px-5 pb-4 pt-4">
          <h1 className="text-[15px] font-bold tracking-tight text-white">MapCards</h1>
          <p className="mt-0.5 text-[11px] font-medium text-white/55">Territory Card Maker</p>
        </div>

        <div className="sidebar-scroll min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          {/* Project + Search */}
          <div className="space-y-3 px-5 pt-5 pb-3">
            <ProjectManager />
            <LocationSearch onLocationSelect={handleLocationSelect} />
          </div>

          <div className="mx-5 border-t border-divider" />

          {/* Card Settings */}
          <div className="px-5 py-2">
            <SidebarSection title="Card Settings">
              <CardSettings />
            </SidebarSection>
          </div>

          <div className="mx-5 border-t border-divider" />

          {/* Settings — sliders, grid snap (contextual) */}
          <div className="px-5 py-2">
            <SidebarSection title="Settings">
              <Toolbar />
            </SidebarSection>
          </div>

          <div className="mx-5 border-t border-divider" />

          {/* Map View & Layers */}
          <div className="px-5 py-2">
            <SidebarSection title="Map View & Layers">
              <LayerToggle map={mapInstance} />
            </SidebarSection>
          </div>

          <div className="mx-5 border-t border-divider" />

          {/* Export */}
          <div className="px-5 py-2">
            <SidebarSection title="Export">
              <ExportPanel onExport={() => setExportOpen(true)} />
            </SidebarSection>
          </div>

          {/* Empty state guidance */}
          {!boundary && housePoints.length === 0 && customRoads.length === 0 && (
            <div className="mx-5 mt-2 rounded-lg border border-dashed border-divider bg-surface px-4 py-4 text-center">
              <p className="text-[13px] font-semibold text-heading">Get started</p>
              <p className="mt-1 text-[12px] leading-relaxed text-body">
                Use the toolbar above the map to draw a territory boundary, then add houses and roads.
              </p>
            </div>
          )}

          {/* Status panel — white card with soft shadow */}
          <div className="px-5 py-4">
            <div className="rounded-xl bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]">
              <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-heading">
                Status
              </h3>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-body">Boundary</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                    boundary
                      ? 'bg-emerald-soft text-emerald-text'
                      : 'bg-input-bg text-body'
                  }`}>
                    {boundary ? 'Drawn' : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-body">Custom roads</span>
                  <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                    {customRoads.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-body">Houses</span>
                  <span className="rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand">
                    {housePoints.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Map */}
      <main className="relative min-w-0 flex-1">
        <MapView onMapReady={handleMapReady} />

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute left-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/50 bg-white/85 text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.1)] backdrop-blur-xl transition-all hover:bg-white hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] active:scale-95"
          title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <PanelLeftClose size={16} strokeWidth={2} /> : <PanelLeftOpen size={16} strokeWidth={2} />}
        </button>

        <MapToolbar
          activeMode={activeDrawMode}
          onModeChange={handleModeChange}
          hasBoundary={boundary !== null}
          onClearBoundary={() => {
            if (!confirm('Clear everything? This removes the boundary, all houses, trees, and roads.')) return
            setBoundary(null)
            clearAll()
            useStore.getState().clearAllHouses()
            useStore.getState().clearAllTrees()
            // Clear custom roads one by one (no bulk clear in store)
            const roads = useStore.getState().customRoads
            for (const r of roads) useStore.getState().removeCustomRoad(r.id as string)
          }}
          onDrawUndo={undo}
          onDrawRedo={redo}
          onDrawFinish={finish}
          getVertexCount={getVertexCount}
        />
        <HouseEditPopup />
        <RoadDeleteButton />
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
    </div>
  )
}
