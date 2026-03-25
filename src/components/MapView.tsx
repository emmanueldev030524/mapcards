import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { buildStreetsOnlyStyle } from '../lib/mapStyle'
import { useStore } from '../store'
import { snapToGrid as snapCoord, generateGridPoints, generateGridLines } from '../lib/grid'
import { loadPinImages } from '../lib/mapPins'

interface MapViewProps {
  center?: [number, number]
  zoom?: number
  onMapReady?: (map: maplibregl.Map) => void
}

const HOUSE_SOURCE = 'house-points'
const HOUSE_LAYER = 'house-icons'
const HOUSE_NUMBER_LAYER = 'house-numbers'
const BADGE_SOURCE = 'house-badges'
const BADGE_LAYER = 'house-badge-icons'
const BOUNDARY_SOURCE = 'territory-boundary'
const BOUNDARY_FILL = 'territory-boundary-fill'
const BOUNDARY_OUTLINE = 'territory-boundary-outline'
const MASK_SOURCE = 'territory-mask'
const MASK_LAYER = 'territory-mask-fill'
const GRID_SOURCE = 'snap-grid'
const GRID_LAYER = 'snap-grid-dots'
const GRID_LINES_SOURCE = 'snap-grid-lines'
const GRID_LINES_LAYER = 'snap-grid-lines-layer'
const SELECTED_SOURCE = 'selected-house'
const SELECTED_LAYER = 'selected-house-ring'

// World-extent polygon ring (covers the entire map)
const WORLD_RING: [number, number][] = [
  [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
]

export default function MapView({ center = [124.955, 8.333], zoom = 16, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const housePoints = useStore((s) => s.housePoints)
  const boundary = useStore((s) => s.boundary)
  const boundaryOpacity = useStore((s) => s.boundaryOpacity)
  const houseIconSize = useStore((s) => s.houseIconSize)
  const badgeIconSize = useStore((s) => s.badgeIconSize)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const gridSpacingMeters = useStore((s) => s.gridSpacingMeters)
  const activeDrawMode = useStore((s) => s.activeDrawMode)
  const moveHousePoint = useStore((s) => s.moveHousePoint)
  const removeHousePoint = useStore((s) => s.removeHousePoint)
  const selectedHouseId = useStore((s) => s.selectedHouseId)
  const addHousePoint = useStore((s) => s.addHousePoint)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    async function initMap() {
      try {
        const style = await buildStreetsOnlyStyle()
        if (cancelled) return

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style,
          center,
          zoom,
          attributionControl: false,
        })

        map.addControl(new maplibregl.NavigationControl(), 'top-right')
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

        map.on('load', () => {
          if (cancelled) return

          // Boundary polygon layer (rendered after drawing completes)
          map.addSource(BOUNDARY_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          // Subtle territory fill tint
          map.addLayer({
            id: BOUNDARY_FILL,
            type: 'fill',
            source: BOUNDARY_SOURCE,
            paint: {
              'fill-color': '#4a6da7',
              'fill-opacity': 0.06,
            },
          })

          // Outer glow (wide, soft)
          map.addLayer({
            id: BOUNDARY_OUTLINE + '-glow',
            type: 'line',
            source: BOUNDARY_SOURCE,
            paint: {
              'line-color': '#4a6da7',
              'line-width': 8,
              'line-opacity': 0.1,
              'line-blur': 4,
            },
          })

          // Main boundary line
          map.addLayer({
            id: BOUNDARY_OUTLINE,
            type: 'line',
            source: BOUNDARY_SOURCE,
            paint: {
              'line-color': '#4a6da7',
              'line-width': 2.5,
              'line-dasharray': [6, 3],
            },
          })

          // Mask layer — white fill covering everything outside boundary
          map.addSource(MASK_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: MASK_LAYER,
            type: 'fill',
            source: MASK_SOURCE,
            paint: {
              'fill-color': '#f8f7f5',
              'fill-opacity': 0.92,
            },
          })

          // Grid lines layer (visible boxes)
          map.addSource(GRID_LINES_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: GRID_LINES_LAYER,
            type: 'line',
            source: GRID_LINES_SOURCE,
            paint: {
              'line-color': '#8a9bb5',
              'line-width': 0.5,
              'line-opacity': 0.2,
            },
          })

          // Grid intersection dots
          map.addSource(GRID_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: GRID_LAYER,
            type: 'circle',
            source: GRID_SOURCE,
            paint: {
              'circle-radius': 2,
              'circle-color': '#8a9bb5',
              'circle-opacity': 0.3,
            },
          })

          // Selected house highlight (ring behind selected icon)
          map.addSource(SELECTED_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: SELECTED_LAYER,
            type: 'circle',
            source: SELECTED_SOURCE,
            paint: {
              'circle-radius': 16,
              'circle-color': '#4a6da7',
              'circle-opacity': 0.12,
              'circle-stroke-width': 2,
              'circle-stroke-color': '#4a6da7',
              'circle-stroke-opacity': 0.4,
              'circle-blur': 0.3,
            },
          })

          // House + badge layers
          const loadImage = (src: string, w: number, h: number): Promise<HTMLImageElement> =>
            new Promise((resolve, reject) => {
              const img = new Image(w, h)
              img.onload = () => resolve(img)
              img.onerror = reject
              img.src = src
            })

          const setupHouseLayers = async () => {
            // Load house icon
            try {
              const houseImg = await loadImage('/icons/house.svg', 24, 24)
              if (!map.hasImage('house-icon')) map.addImage('house-icon', houseImg)
            } catch { /* fallback below */ }

            // Load Google Maps-style pin icons for all categories
            await loadPinImages(map)

            // House points source
            map.addSource(HOUSE_SOURCE, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            })

            // House icon + smart label (combined so collision detection works between icon and text)
            map.addLayer({
              id: HOUSE_LAYER,
              type: 'symbol',
              source: HOUSE_SOURCE,
              layout: {
                'icon-image': map.hasImage('house-icon') ? 'house-icon' : undefined as never,
                'icon-size': 0.8,
                'icon-allow-overlap': true,
                'icon-anchor': 'center',
                'text-field': ['get', 'displayLabel'],
                'text-size': 10,
                'text-variable-anchor': ['top', 'bottom-left', 'bottom-right', 'top-left', 'top-right', 'left', 'right', 'bottom'],
                'text-radial-offset': 1.3,
                'text-justify': 'auto',
                'text-max-width': 10,
                'text-allow-overlap': false,
                'text-optional': true,
                'text-padding': 2,
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                'text-rotation-alignment': 'viewport',
                'text-pitch-alignment': 'viewport',
              },
              paint: {
                'text-color': '#36516e',
                'text-halo-color': '#ffffff',
                'text-halo-width': 2,
                'text-halo-blur': 0,
              },
            })

            // Keep empty number layer reference for icon-size updates
            map.addLayer({
              id: HOUSE_NUMBER_LAYER,
              type: 'symbol',
              source: HOUSE_SOURCE,
              layout: { visibility: 'none' },
            })

            // Badge source (separate — one feature per tag per house)
            map.addSource(BADGE_SOURCE, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            })

            // Badge pin layer (Google Maps-style pins above house)
            map.addLayer({
              id: BADGE_LAYER,
              type: 'symbol',
              source: BADGE_SOURCE,
              layout: {
                'icon-image': ['get', 'badgeIcon'],
                'icon-size': 0.7,
                'icon-allow-overlap': true,
                'icon-anchor': 'bottom',
                'icon-offset': [0, -18],
              },
            })

            if (!map.hasImage('house-icon')) {
              // Fallback: circle layer if SVG failed
              map.removeLayer(HOUSE_LAYER)
              map.addLayer({
                id: HOUSE_LAYER,
                type: 'circle',
                source: HOUSE_SOURCE,
                paint: {
                  'circle-radius': 6,
                  'circle-color': '#4a6da7',
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#ffffff',
                },
              })
            }

            setLoading(false)
            mapRef.current = map
            setMapReady(true)
            onMapReady?.(map)
          }

          setupHouseLayers().catch((err) => {
            console.error('House layer setup failed:', err)
            setLoading(false)
            mapRef.current = map
            setMapReady(true)
            onMapReady?.(map)
          })
        })

        map.on('error', (e) => {
          console.error('MapLibre error:', e)
          setError('Map failed to load. Check your connection.')
        })
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize map')
          setLoading(false)
        }
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  // Sync boundary polygon + mask to map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(BOUNDARY_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData(
        boundary
          ? { type: 'FeatureCollection', features: [boundary] }
          : { type: 'FeatureCollection', features: [] },
      )
    }

    // Update mask — world polygon with boundary as a hole
    const maskSource = map.getSource(MASK_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (maskSource) {
      if (boundary) {
        const hole = boundary.geometry.coordinates[0] as [number, number][]
        maskSource.setData({
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [WORLD_RING, hole],
          },
          properties: {},
        })
      } else {
        maskSource.setData({ type: 'FeatureCollection', features: [] })
      }
    }

    // Auto-fit map to boundary bounds
    if (boundary) {
      const coords = boundary.geometry.coordinates[0] as [number, number][]
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0], coords[0]),
      )
      map.fitBounds(bounds, { padding: 40, duration: 1000 })
    }
  }, [boundary, mapReady])

  // Sync grid lines + dots
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const gridSource = map.getSource(GRID_SOURCE) as maplibregl.GeoJSONSource | undefined
    const linesSource = map.getSource(GRID_LINES_SOURCE) as maplibregl.GeoJSONSource | undefined

    if (snapToGrid && boundary) {
      const points = generateGridPoints(boundary, gridSpacingMeters)
      const lines = generateGridLines(boundary, gridSpacingMeters)
      gridSource?.setData({ type: 'FeatureCollection', features: points })
      linesSource?.setData({ type: 'FeatureCollection', features: lines })
    } else {
      gridSource?.setData({ type: 'FeatureCollection', features: [] })
      linesSource?.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [snapToGrid, gridSpacingMeters, boundary, mapReady])

  // Sync boundary fill opacity
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.setPaintProperty(BOUNDARY_FILL, 'fill-opacity', boundaryOpacity)
    } catch { /* layer may not exist yet */ }
  }, [boundaryOpacity, mapReady])

  // Handle click-to-place houses
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      if (activeDrawMode === 'house') {
        const snap = useStore.getState().snapToGrid
        const spacing = useStore.getState().gridSpacingMeters
        const [lng, lat] = snap
          ? snapCoord(e.lngLat.lng, e.lngLat.lat, spacing)
          : [e.lngLat.lng, e.lngLat.lat]
        addHousePoint(lng, lat)
      }
    }

    map.on('click', handleClick)
    return () => { map.off('click', handleClick) }
  }, [activeDrawMode, addHousePoint])

  // Sync selected house highlight
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(SELECTED_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (selectedHouseId) {
      const house = housePoints.find((p) => p.id === selectedHouseId)
      if (house) {
        source.setData({
          type: 'FeatureCollection',
          features: [house],
        })
        return
      }
    }
    source.setData({ type: 'FeatureCollection', features: [] })
  }, [selectedHouseId, housePoints, mapReady])

  // Sync house points + badges to map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(HOUSE_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: housePoints.map((p, i) => {
          const num = `#${i + 1}`
          const label = p.properties.label || ''
          const displayLabel = label ? `${num}  ${label}` : num
          return {
            ...p,
            properties: { ...p.properties, id: p.id, displayLabel },
          }
        }),
      })
    }

    // Generate badge features — Google Maps-style pins, one per tag per house
    const badgeFeatures: Array<{
      type: 'Feature'
      geometry: { type: 'Point'; coordinates: number[] }
      properties: Record<string, unknown>
    }> = []

    for (const p of housePoints) {
      const tags = p.properties.tags || []
      tags.forEach((tag, i) => {
        const lngOffset = (i - (tags.length - 1) / 2) * 0.00018
        badgeFeatures.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [p.geometry.coordinates[0] + lngOffset, p.geometry.coordinates[1]],
          },
          properties: { badgeIcon: `pin-${tag}` },
        })
      })
    }

    const badgeSource = map.getSource(BADGE_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (badgeSource) {
      badgeSource.setData({ type: 'FeatureCollection', features: badgeFeatures })
    }
  }, [housePoints, mapReady])

  // Sync house icon size
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.setLayoutProperty(HOUSE_LAYER, 'icon-size', houseIconSize)
    } catch { /* layer may not exist yet */ }
  }, [houseIconSize, mapReady])

  // Sync badge icon size
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.setLayoutProperty(BADGE_LAYER, 'icon-size', badgeIconSize)
    } catch { /* layer may not exist yet */ }
  }, [badgeIconSize, mapReady])

  // Drag-to-move houses (requires 5px movement before drag starts)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let pendingId: string | null = null
    let dragId: string | null = null
    let startPoint: maplibregl.Point | null = null
    const DRAG_THRESHOLD = 5
    const canvas = map.getCanvas()

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (activeDrawMode && activeDrawMode !== 'select') return

      const tolerance = 12
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]
      const features = map.queryRenderedFeatures(bbox, { layers: [HOUSE_LAYER] })
      if (features.length === 0) return

      const id = features[0].properties?.id as string | undefined
      if (!id) return

      pendingId = id
      startPoint = e.point
      // Disable pan immediately so mousemove events aren't consumed by the map
      map.dragPan.disable()
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      // Check if threshold exceeded to start drag
      if (pendingId && startPoint && !dragId) {
        const dx = e.point.x - startPoint.x
        const dy = e.point.y - startPoint.y
        if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
          dragId = pendingId
          pendingId = null
          canvas.style.cursor = 'grabbing'
        }
        return
      }

      if (!dragId) {
        // Show grab cursor on hover over houses
        if (!activeDrawMode || activeDrawMode === 'select') {
          const features = map.queryRenderedFeatures(e.point, { layers: [HOUSE_LAYER] })
          canvas.style.cursor = features.length > 0 ? 'grab' : ''
        }
        return
      }

      canvas.style.cursor = 'grabbing'
      const snap = useStore.getState().snapToGrid
      const spacing = useStore.getState().gridSpacingMeters
      const [lng, lat] = snap
        ? snapCoord(e.lngLat.lng, e.lngLat.lat, spacing)
        : [e.lngLat.lng, e.lngLat.lat]
      moveHousePoint(dragId, lng, lat)
    }

    const onMouseUp = () => {
      pendingId = null
      startPoint = null
      if (dragId) {
        dragId = null
        canvas.style.cursor = ''
      }
      // Always re-enable pan on mouseup
      map.dragPan.enable()
    }

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)

    return () => {
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
    }
  }, [activeDrawMode, moveHousePoint, mapReady])

  // Click-to-select house + Delete/Backspace to remove
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const selectHouse = useStore.getState().setSelectedHouseId

    const onClick = (e: maplibregl.MapMouseEvent) => {
      // Only select when no draw mode is active
      if (activeDrawMode && activeDrawMode !== 'select') return

      const tolerance = 12
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]
      const features = map.queryRenderedFeatures(bbox, { layers: [HOUSE_LAYER] })

      if (features.length > 0) {
        const id = features[0].properties?.id as string | undefined
        if (id) {
          selectHouse(id)
          return
        }
      }
      // Clicked empty area — deselect
      selectHouse(null)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't delete house when typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = useStore.getState().selectedHouseId
        if (selectedId) {
          e.preventDefault()
          removeHousePoint(selectedId)
          selectHouse(null)
        }
      }
    }

    map.on('click', onClick)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      map.off('click', onClick)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [activeDrawMode, removeHousePoint, mapReady])

  // Change cursor based on draw mode
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (activeDrawMode === 'house') {
      map.getCanvas().style.cursor = 'crosshair'
    } else if (activeDrawMode === 'boundary' || activeDrawMode === 'road') {
      map.getCanvas().style.cursor = 'crosshair'
    } else {
      map.getCanvas().style.cursor = ''
    }
  }, [activeDrawMode])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-3 border-gray-200 border-t-primary" />
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="max-w-[20rem] rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 text-sm font-medium text-red-600 underline hover:text-red-800"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
