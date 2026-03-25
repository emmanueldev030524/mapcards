import { useState, useCallback, useEffect, useRef } from 'react'
import type { Feature, Polygon, LineString } from 'geojson'
import maplibregl from 'maplibre-gl'
import MapView from './components/MapView'
import Toolbar from './components/Toolbar'
import LocationSearch from './components/LocationSearch'
import type { LocationSelection } from './components/LocationSearch'
import CardSettings from './components/CardSettings'
import LayerToggle from './components/LayerToggle'
import ProjectManager from './components/ProjectManager'
import ExportPanel from './components/ExportPanel'
import BulkFillDialog from './components/BulkFillDialog'
import HouseEditPopup from './components/HouseEditPopup'
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
      }
      // Ctrl+Z / Cmd+Z = undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      }
      // Ctrl+Shift+Z / Cmd+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        redo()
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

      // Fly to location
      mapInstance.flyTo({
        center: [selection.lng, selection.lat],
        zoom: 16,
        duration: 1500,
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
      <aside className="flex w-75 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="bg-header-bg p-4">
          <h1 className="text-lg font-semibold text-white">MapCards</h1>
          <p className="text-xs text-white/70">Territory Card Maker</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <ProjectManager />

          <LocationSearch onLocationSelect={handleLocationSelect} />

          <CardSettings />

          <Toolbar
            activeMode={activeDrawMode}
            onModeChange={handleModeChange}
            hasBoundary={boundary !== null}
            onClearBoundary={() => { setBoundary(null); clearAll() }}
          />

          <LayerToggle map={mapInstance} />

          <ExportPanel />

          {/* Status */}
          <div className="space-y-1 border-t border-border pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Status
            </h3>
            <p className="text-xs text-gray-500">
              Boundary: {boundary ? 'Drawn' : 'Not set'}
            </p>
            <p className="text-xs text-gray-500">
              Custom roads: {customRoads.length}
            </p>
            <p className="text-xs text-gray-500">
              Houses: {housePoints.length}
            </p>
          </div>
        </div>
      </aside>

      {/* Map */}
      <main className="relative flex-1">
        <MapView onMapReady={handleMapReady} />
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
