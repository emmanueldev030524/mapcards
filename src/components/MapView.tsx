import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { buildMapStyle, applyMapMode } from '../lib/mapStyle'
import type { MapViewMode } from '../lib/mapStyle'
import { CompassControl } from '../lib/CompassControl'
import { useStore } from '../store'
import { snapToGrid as snapCoord, generateGridPoints, generateGridLines } from '../lib/grid'
import { loadPinImages, ensureHouseIcons, resolveHouseIcon } from '../lib/mapPins'

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
const SELECTED_ROAD_SOURCE = 'selected-road'
const SELECTED_ROAD_LAYER = 'selected-road-highlight'
const TREE_SOURCE = 'tree-points'
const TREE_LAYER = 'tree-icons'
const ROAD_SOURCE = 'custom-roads'
const ROAD_CASING = 'custom-roads-casing'
const ROAD_FILL = 'custom-roads-fill'

// World-extent polygon ring (covers the entire map)
const WORLD_RING: [number, number][] = [
  [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
]

export default function MapView({ center = [124.955, 8.333], zoom = 16, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const selectedTreeRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const housePoints = useStore((s) => s.housePoints)
  const treePoints = useStore((s) => s.treePoints)
  const customRoads = useStore((s) => s.customRoads)
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
  const mapMode = useStore((s) => s.mapMode)

  // Derive the effective view mode
  const effectiveMode: MapViewMode = mapMode === 'auto'
    ? (boundary === null ? 'satellite' : 'street')
    : mapMode

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    async function initMap() {
      try {
        const style = await buildMapStyle()
        if (cancelled) return

        const map = new maplibregl.Map({
          container: containerRef.current!,
          style,
          center,
          zoom,
          attributionControl: false,
          fadeDuration: 200,
        })

        // Smooth inertial scrolling
        map.scrollZoom.setWheelZoomRate(1 / 150)
        map.scrollZoom.setZoomRate(1 / 100)

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
        map.addControl(new CompassControl(), 'bottom-right')
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

        map.on('load', () => {
          if (cancelled) return

          // Boundary polygon layer (rendered after drawing completes)
          map.addSource(BOUNDARY_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          // Territory fill — visible tint so the area is clearly defined
          map.addLayer({
            id: BOUNDARY_FILL,
            type: 'fill',
            source: BOUNDARY_SOURCE,
            paint: {
              'fill-color': '#39577F',
              'fill-opacity': 0.08,
            },
          })

          // Outer drop shadow (wide, soft — makes boundary "sit" on the map)
          map.addLayer({
            id: BOUNDARY_OUTLINE + '-shadow',
            type: 'line',
            source: BOUNDARY_SOURCE,
            paint: {
              'line-color': '#1e293b',
              'line-width': 12,
              'line-opacity': 0.06,
              'line-blur': 6,
            },
          })

          // Mid glow (brand blue halo)
          map.addLayer({
            id: BOUNDARY_OUTLINE + '-glow',
            type: 'line',
            source: BOUNDARY_SOURCE,
            paint: {
              'line-color': '#39577F',
              'line-width': 6,
              'line-opacity': 0.12,
              'line-blur': 3,
            },
          })

          // Main boundary line — solid, not dashed
          map.addLayer({
            id: BOUNDARY_OUTLINE,
            type: 'line',
            source: BOUNDARY_SOURCE,
            paint: {
              'line-color': '#39577F',
              'line-width': 2.5,
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

          // Custom roads — two-layer system like real map roads (casing + fill)
          map.addSource(ROAD_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: ROAD_CASING,
            type: 'line',
            source: ROAD_SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#cfcdca',
              'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 1, 14, 6, 18, 16, 20, 22],
            },
          })

          map.addLayer({
            id: ROAD_FILL,
            type: 'line',
            source: ROAD_SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#ffffff',
              'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 0.5, 14, 4, 18, 12, 20, 18],
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

          // Selected house highlight — outer pulse ring + inner solid ring
          map.addSource(SELECTED_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          // Outer pulse ring (animated via JS)
          map.addLayer({
            id: SELECTED_LAYER + '-pulse',
            type: 'circle',
            source: SELECTED_SOURCE,
            paint: {
              'circle-radius': 20,
              'circle-color': 'transparent',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#39577F',
              'circle-stroke-opacity': 0.3,
            },
          })

          // Inner solid selection ring
          map.addLayer({
            id: SELECTED_LAYER,
            type: 'circle',
            source: SELECTED_SOURCE,
            paint: {
              'circle-radius': 16,
              'circle-color': '#39577F',
              'circle-opacity': 0.1,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#39577F',
              'circle-stroke-opacity': 0.5,
            },
          })

          // Animate the outer pulse ring
          let pulsePhase = 0
          const animatePulse = () => {
            pulsePhase = (pulsePhase + 0.03) % (Math.PI * 2)
            const scale = 1 + Math.sin(pulsePhase) * 0.3 // oscillate 0.7–1.3
            const opacity = 0.15 + Math.sin(pulsePhase) * 0.15 // oscillate 0–0.3
            try {
              map.setPaintProperty(SELECTED_LAYER + '-pulse', 'circle-radius', 18 + scale * 6)
              map.setPaintProperty(SELECTED_LAYER + '-pulse', 'circle-stroke-opacity', opacity)
            } catch { /* layer may not exist */ }
            requestAnimationFrame(animatePulse)
          }
          requestAnimationFrame(animatePulse)

          // Selected road highlight (glowing line behind selected road)
          map.addSource(SELECTED_ROAD_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: SELECTED_ROAD_LAYER,
            type: 'line',
            source: SELECTED_ROAD_SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#3b82f6',
              'line-width': 10,
              'line-opacity': 0.35,
              'line-blur': 3,
            },
          })

          // House + badge layers
          const setupHouseLayers = async () => {
            // Ensure default house icon exists (others generated on-demand in sync effect)
            await ensureHouseIcons(map, [])

            // Load Google Maps-style pin icons for status badges (notHome, dnc)
            await loadPinImages(map)

            // House points source
            map.addSource(HOUSE_SOURCE, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            })

            // House marker — house icon with compact number below
            map.addLayer({
              id: HOUSE_LAYER,
              type: 'symbol',
              source: HOUSE_SOURCE,
              layout: {
                'icon-image': ['get', 'iconImage'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.3, 16, 0.6, 19, 0.8],
                'icon-allow-overlap': true,
                'icon-anchor': 'center',
                // #N below icon (# smaller), name on second line if set
                'text-field': [
                  'format',
                  '#', { 'font-scale': 0.7 },
                  ['get', 'num'], { 'font-scale': 1.0 },
                  ['case', ['!=', ['get', 'label'], ''],
                    ['concat', '\n', ['get', 'label']],
                    '',
                  ], { 'font-scale': 0.85 },
                ],
                'text-size': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 8, 19, 10],
                'text-anchor': 'top',
                'text-offset': [0, 0.8],
                'text-line-height': 1.3,
                'text-max-width': 8,
                'text-allow-overlap': true,
                'text-padding': 0,
                'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
                'text-rotation-alignment': 'viewport',
                'text-pitch-alignment': 'viewport',
              },
              paint: {
                'text-color': '#1e293b',
                'text-halo-color': 'rgba(255,255,255,1)',
                'text-halo-width': 2,
                'text-halo-blur': 0,
              },
            })

            // Keep layer reference for icon-size updates
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

            if (!map.hasImage('house-default')) {
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

            // Tree points — simple circle layer (no SVG image dependency)
            map.addSource(TREE_SOURCE, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            })
            // Load tree SVG icon
            const treeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2L6 10h2.5L5 16h5v5h4v-5h5l-3.5-6H18L12 2z" fill="#2d8a4e" stroke="#1a6b35" stroke-width="0.8" stroke-linejoin="round"/><rect x="10.5" y="16" width="3" height="5" fill="#7a5230" stroke="#5c3d22" stroke-width="0.6" rx="0.5"/></svg>'
            try {
              const treeImg = await new Promise<HTMLImageElement>((res, rej) => {
                const img = new Image(24, 24)
                img.onload = () => res(img)
                img.onerror = rej
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(treeSvg)
              })
              if (!map.hasImage('tree-icon')) map.addImage('tree-icon', treeImg)
            } catch { /* circle fallback below */ }

            map.addLayer(map.hasImage('tree-icon') ? {
              id: TREE_LAYER,
              type: 'symbol',
              source: TREE_SOURCE,
              layout: {
                'icon-image': 'tree-icon',
                'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 16, 0.7, 19, 0.9],
                'icon-allow-overlap': true,
                'icon-anchor': 'bottom',
              },
            } : {
              id: TREE_LAYER,
              type: 'circle',
              source: TREE_SOURCE,
              paint: {
                'circle-radius': 6,
                'circle-color': '#2d8a4e',
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
              },
            })

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

  // Sync custom roads to map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(ROAD_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (source) {
      // Ensure id is in properties for queryRenderedFeatures
      const features = customRoads.map((r) => ({
        ...r,
        properties: { ...r.properties, id: r.id },
      }))
      source.setData({ type: 'FeatureCollection', features })
    }
  }, [customRoads, mapReady])

  // Sync boundary fill opacity
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      map.setPaintProperty(BOUNDARY_FILL, 'fill-opacity', boundaryOpacity)
    } catch { /* layer may not exist yet */ }
  }, [boundaryOpacity, mapReady])

  // Switch map view mode (satellite / street / clean)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try { applyMapMode(map, effectiveMode) } catch { /* layers may not exist yet */ }
  }, [effectiveMode, mapReady])

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
      } else if (activeDrawMode === 'tree') {
        useStore.getState().addTreePoint(e.lngLat.lng, e.lngLat.lat)
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

  // Sync selected road highlight
  const selectedRoadId = useStore((s) => s.selectedRoadId)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(SELECTED_ROAD_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (selectedRoadId) {
      const road = customRoads.find((r) => r.id === selectedRoadId)
      if (road) {
        source.setData({ type: 'FeatureCollection', features: [road] })
        return
      }
    }
    source.setData({ type: 'FeatureCollection', features: [] })
  }, [selectedRoadId, customRoads, mapReady])

  // Sync house points + badges to map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(HOUSE_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (source) {
      // Build features with resolved icon keys
      const features = housePoints.map((p, i) => {
        const num = i + 1
        const label = p.properties.label || ''
        const tags = p.properties.tags || []
        const { key } = resolveHouseIcon(tags)
        return {
          ...p,
          properties: {
            ...p.properties,
            id: p.id,
            iconImage: key,
            num: String(num),
            label,
          },
        }
      })

      // Ensure all needed icon variants exist, then set data
      ensureHouseIcons(map, housePoints.map((p) => ({ tags: p.properties.tags || [] }))).then(() => {
        source.setData({ type: 'FeatureCollection', features })
      })
    }

    // Status + place tags are now baked into the house icon — clear badge layer
    const badgeSource = map.getSource(BADGE_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (badgeSource) {
      badgeSource.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [housePoints, mapReady])

  // Sync tree points to map
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource(TREE_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: treePoints.map((t) => ({
          ...t,
          properties: { ...t.properties, id: t.id },
        })),
      })
    }
  }, [treePoints, mapReady])

  // Sync house icon size
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try {
      // Multiply zoom interpolation by slider scale (preserves zoom-based sizing)
      const scale = houseIconSize
      map.setLayoutProperty(HOUSE_LAYER, 'icon-size', [
        'interpolate', ['linear'], ['zoom'],
        13, 0.3 * scale,
        16, 0.6 * scale,
        19, 0.8 * scale,
      ])
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
        // Clear move tracking so next drag creates a new undo snapshot
        useStore.getState()._lastMoveId && useStore.setState({ _lastMoveId: null })
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

  // Click-to-select house or road + Delete/Backspace to remove
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const selectHouse = useStore.getState().setSelectedHouseId
    const selectRoad = useStore.getState().setSelectedRoadId
    const removeRoad = useStore.getState().removeCustomRoad

    const onClick = (e: maplibregl.MapMouseEvent) => {
      // Only select when no draw mode is active
      if (activeDrawMode && activeDrawMode !== 'select') return

      const tolerance = 12
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]

      // Check houses first
      const houseFeatures = map.queryRenderedFeatures(bbox, { layers: [HOUSE_LAYER] })
      if (houseFeatures.length > 0) {
        const id = houseFeatures[0].properties?.id as string | undefined
        if (id) {
          selectHouse(id)
          selectRoad(null)
          return
        }
      }

      // Check trees
      if (map.getLayer(TREE_LAYER)) {
        const treeFeatures = map.queryRenderedFeatures(bbox, { layers: [TREE_LAYER] })
        if (treeFeatures.length > 0) {
          const id = treeFeatures[0].properties?.id as string | undefined
          if (id) {
            selectedTreeRef.current = id
            selectHouse(null)
            selectRoad(null)
            return
          }
        }
      }

      // Check roads
      const roadLayers = [ROAD_FILL, ROAD_CASING].filter((l) => map.getLayer(l))
      if (roadLayers.length > 0) {
        const roadFeatures = map.queryRenderedFeatures(bbox, { layers: roadLayers })
        if (roadFeatures.length > 0) {
          const id = roadFeatures[0].properties?.id as string | undefined
          if (id) {
            selectRoad(id)
            selectHouse(null)
            selectedTreeRef.current = null
            return
          }
        }
      }

      // Clicked empty area — deselect all
      selectHouse(null)
      selectRoad(null)
      selectedTreeRef.current = null
    }

    const onKeyDown = (e: KeyboardEvent) => {
      // Don't delete when typing in an input
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useStore.getState()
        if (state.selectedHouseId) {
          e.preventDefault()
          removeHousePoint(state.selectedHouseId)
          selectHouse(null)
        } else if (selectedTreeRef.current) {
          e.preventDefault()
          useStore.getState().removeTreePoint(selectedTreeRef.current)
          selectedTreeRef.current = null
        } else if (state.selectedRoadId) {
          e.preventDefault()
          removeRoad(state.selectedRoadId)
          selectRoad(null)
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

    if (activeDrawMode === 'house' || activeDrawMode === 'tree') {
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
