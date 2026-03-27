import { useState, useCallback, useEffect, useRef } from 'react'
import type { Feature, Polygon, LineString } from 'geojson'
import maplibregl from 'maplibre-gl'
import MapView from './components/MapView'
import MapToolbar from './components/MapToolbar'
import Toolbar from './components/Toolbar'
import LocationSearch from './components/LocationSearch'
import type { LocationSelection } from './components/LocationSearch'
import CardSettings from './components/CardSettings'
import LayerToggle from './components/LayerToggle'
import ProjectManager from './components/ProjectManager'
import ExportPanel from './components/ExportPanel'
import BulkFillDialog from './components/BulkFillDialog'
import HouseEditPopup from './components/HouseEditPopup'
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

  const { initDraw, setMode, undo, redo, clearAll } = useDraw({
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
      const marker = new maplibregl.Marker({ color: '#4a6da7' })
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
        className={`flex w-75 shrink-0 flex-col border-r border-slate-200 bg-white shadow-[2px_0_12px_rgba(0,0,0,0.06)] ${
          activeDrawMode === 'boundary' || activeDrawMode === 'road' ? 'sidebar-drawing' : ''
        }`}
        onMouseEnter={(e) => {
          // Re-enable sidebar on hover even during drawing
          if (activeDrawMode) e.currentTarget.classList.remove('sidebar-drawing')
        }}
        onMouseLeave={(e) => {
          // Re-fade when leaving sidebar during drawing
          if (activeDrawMode === 'boundary' || activeDrawMode === 'road')
            e.currentTarget.classList.add('sidebar-drawing')
        }}
      >
        <div className="bg-linear-to-b from-header-bg to-primary-dark px-4 pb-5 pt-4">
          <h1 className="text-lg font-bold tracking-tight text-white">MapCards</h1>
          <p className="text-[11px] font-medium text-white/60">Territory Card Maker</p>
        </div>

        <div className="sidebar-scroll flex-1 overflow-y-auto">
          {/* Project + Search — always visible, no card */}
          <div className="space-y-3 px-4 pt-4 pb-2">
            <ProjectManager />
            <LocationSearch onLocationSelect={handleLocationSelect} />
          </div>

          <div className="mx-4 border-t border-slate-200" />

          {/* Card Settings */}
          <div className="px-4 py-2">
            <SidebarSection title="Card Settings">
              <CardSettings />
            </SidebarSection>
          </div>

          <div className="mx-4 border-t border-slate-200" />

          {/* Settings — sliders, grid snap (contextual) */}
          <div className="px-4 py-2">
            <SidebarSection title="Settings">
              <Toolbar />
            </SidebarSection>
          </div>

          <div className="mx-4 border-t border-slate-200" />

          {/* Map View & Layers */}
          <div className="px-4 py-2">
            <SidebarSection title="Map View & Layers">
              <LayerToggle map={mapInstance} />
            </SidebarSection>
          </div>

          <div className="mx-4 border-t border-slate-200" />

          {/* Export */}
          <div className="px-4 py-2">
            <SidebarSection title="Export">
              <ExportPanel />
            </SidebarSection>
          </div>

          {/* Empty state guidance */}
          {!boundary && housePoints.length === 0 && customRoads.length === 0 && (
            <div className="mx-4 mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-center">
              <p className="text-sm font-semibold text-heading">Get started</p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Use the toolbar above the map to draw a territory boundary, then add houses and roads.
              </p>
            </div>
          )}

          {/* Status */}
          <div className="px-4 py-3">
            <div className="rounded-lg bg-slate-50 p-3.5">
              <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-heading">
                Status
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-label">Boundary</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                    boundary
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  }`}>
                    {boundary ? 'Drawn' : 'Not set'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-label">Custom roads</span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary-dark">
                    {customRoads.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-label">Houses</span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary-dark">
                    {housePoints.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Map */}
      <main className="relative flex-1">
        <MapView onMapReady={handleMapReady} />
        <MapToolbar
          activeMode={activeDrawMode}
          onModeChange={handleModeChange}
          hasBoundary={boundary !== null}
          onClearBoundary={() => { setBoundary(null); clearAll() }}
          onDrawUndo={undo}
          onDrawRedo={redo}
        />
        <HouseEditPopup />
      </main>

      <BulkFillDialog
        map={mapInstance}
        open={bulkFillOpen}
        onClose={() => setBulkFillOpen(false)}
      />
    </div>
  )
}
