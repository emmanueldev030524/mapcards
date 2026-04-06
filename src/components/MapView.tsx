import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import { point } from '@turf/helpers'
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { buildMapStyle, applyMapMode } from '../lib/mapStyle'
import type { MapViewMode } from '../lib/mapStyle'
import { CompassControl } from '../lib/CompassControl'
import { useStore } from '../store'
import { snapToGrid as snapCoord, generateGridPoints, generateGridLines } from '../lib/grid'
import { loadPinImages, ensureHouseIcons, allHouseIconsExist, resolveHouseIcon, generateStartMarkerSVG } from '../lib/mapPins'
import { BRAND } from '../lib/colors'
import { showToast } from './Toast'

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
const SELECTED_TREE_SOURCE = 'selected-tree'
const SELECTED_TREE_LAYER = 'selected-tree-ring'
const SELECTED_ROAD_SOURCE = 'selected-road'
const SELECTED_ROAD_LAYER = 'selected-road-highlight'
const SELECTED_START_SOURCE = 'selected-start-marker'
const SELECTED_START_LAYER = 'selected-start-marker-ring'
const TREE_SOURCE = 'tree-points'
const TREE_LAYER = 'tree-icons'
const START_MARKER_SOURCE = 'start-marker'
const START_MARKER_LAYER = 'start-marker-pin'
const START_MARKER_LABEL_LAYER = 'start-marker-label'
const START_MARKER_IMAGE = 'start-marker-icon'
const ROAD_SOURCE = 'custom-roads'
const ROAD_CASING = 'custom-roads-casing'
const ROAD_FILL = 'custom-roads-fill'
const DEFAULT_CENTER: [number, number] = [124.955, 8.333]

// World-extent polygon ring (covers the entire map)
const WORLD_RING: [number, number][] = [
  [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
]

export default function MapView({ center = DEFAULT_CENTER, zoom = 16, onMapReady }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const resizeFrameRef = useRef<number | null>(null)
  const justDraggedRef = useRef(false)
  const initialCenterRef = useRef(center)
  const initialZoomRef = useRef(zoom)
  const onMapReadyRef = useRef(onMapReady)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // housePoints, treePoints, customRoads, opacity/size sliders are synced via
  // direct Zustand subscription (bypasses React render cycle for instant updates)
  const boundary = useStore((s) => s.boundary)
  const snapToGrid = useStore((s) => s.snapToGrid)
  const gridSpacingMeters = useStore((s) => s.gridSpacingMeters)
  const activeDrawMode = useStore((s) => s.activeDrawMode)
  const moveHousePoint = useStore((s) => s.moveHousePoint)
  const moveTreePoint = useStore((s) => s.moveTreePoint)
  const moveStartMarker = useStore((s) => s.moveStartMarker)
  const removeHousePoint = useStore((s) => s.removeHousePoint)
  const selectedHouseId = useStore((s) => s.selectedHouseId)
  const selectedTreeId = useStore((s) => s.selectedTreeId)
  const treePoints = useStore((s) => s.treePoints)
  const startMarker = useStore((s) => s.startMarker)
  const selectedStartMarker = useStore((s) => s.selectedStartMarker)
  const addHousePoint = useStore((s) => s.addHousePoint)
  const mapMode = useStore((s) => s.mapMode)
  // Derive the effective view mode
  const effectiveMode: MapViewMode = mapMode === 'auto'
    ? (boundary === null ? 'satellite' : 'street')
    : mapMode

  useEffect(() => {
    onMapReadyRef.current = onMapReady
  }, [onMapReady])

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
          center: initialCenterRef.current,
          zoom: initialZoomRef.current,
          attributionControl: false,
          fadeDuration: 200,
          canvasContextAttributes: { preserveDrawingBuffer: true },
        } as maplibregl.MapOptions)

        // Smooth inertial scrolling
        map.scrollZoom.setWheelZoomRate(1 / 150)
        map.scrollZoom.setZoomRate(1 / 100)

        // Disable double-tap-to-zoom on touch devices — conflicts with
        // rapid tapping to select/place houses. Users have pinch-to-zoom instead.
        if ('ontouchstart' in window) {
          map.doubleClickZoom.disable()
        }

        // Compass first, then zoom — Google Earth layout (compass | − | +)
        const compassCtrl = new CompassControl()
        map.addControl(compassCtrl, 'bottom-right')
        const navCtrl = new maplibregl.NavigationControl({ showCompass: false })
        map.addControl(navCtrl, 'bottom-right')
        // Attribution hidden — OpenFreeMap + OpenMapTiles credited in app docs

        map.on('load', () => {
          if (cancelled) return

          // Boundary polygon layer (rendered after drawing completes)
          map.addSource(BOUNDARY_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          // --- Z-ORDER: fill → mask → roads → boundary stroke → icons ---

          // 1. Territory fill — 7% brand tint
          map.addLayer({
            id: BOUNDARY_FILL,
            type: 'fill',
            source: BOUNDARY_SOURCE,
            paint: {
              'fill-color': BRAND,
              'fill-opacity': 0.07,
            },
          })

          // 2. Mask — dims everything outside boundary
          map.addSource(MASK_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: MASK_LAYER,
            type: 'fill',
            source: MASK_SOURCE,
            paint: {
              'fill-color': '#C0BDB8',
              'fill-opacity': 0.85,
            },
          })

          // 3. Custom roads — interleaved with base roads for seamless merging
          map.addSource(ROAD_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          // Find insertion points: casing with base casings, fill with base fills
          const styleLayers = map.getStyle()?.layers || []
          let casingBefore: string | undefined
          let fillBefore: string | undefined
          for (const sl of styleLayers) {
            if (!casingBefore && sl.id.startsWith('highway-') && !sl.id.includes('casing')) {
              casingBefore = sl.id
            }
            if (!fillBefore && sl.id.startsWith('bridge-')) {
              fillBefore = sl.id
            }
          }

          // Custom roads — casing+fill, interleaved with base roads
          map.addLayer({
            id: ROAD_CASING,
            type: 'line',
            source: ROAD_SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#A8B4C4',
              'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 0.5, 13, 1, 14, 4, 20, 15],
            },
          }, casingBefore)

          map.addLayer({
            id: ROAD_FILL,
            type: 'line',
            source: ROAD_SOURCE,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': '#ffffff',
              'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13.5, 0, 14, 2.5, 20, 11.5],
            },
          }, fillBefore)

          // 4. Boundary glow — soft brand halo, renders ABOVE roads
          map.addLayer({
            id: BOUNDARY_OUTLINE + '-glow',
            type: 'line',
            source: BOUNDARY_SOURCE,
            layout: { 'line-join': 'round' },
            paint: {
              'line-color': BRAND,
              'line-width': 6,
              'line-opacity': 0.25,
              'line-blur': 6,
            },
          })

          // 5. Boundary stroke — dominant, 2.5px solid brand blue, ON TOP
          map.addLayer({
            id: BOUNDARY_OUTLINE,
            type: 'line',
            source: BOUNDARY_SOURCE,
            layout: { 'line-join': 'round' },
            paint: {
              'line-color': BRAND,
              'line-width': 2.5,
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
              'line-color': '#94A3B8',
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
              'circle-color': '#94A3B8',
              'circle-opacity': 0.3,
            },
          })

          // Selected house highlight — outer pulse ring + inner solid ring
          map.addSource(SELECTED_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          // Outer pulse ring (animated via JS)
          // circle-translate shifts the ring up to align with the icon's visual center
          // (house icon is bottom-anchored, so the center is ~14px above the anchor point)
          map.addLayer({
            id: SELECTED_LAYER + '-pulse',
            type: 'circle',
            source: SELECTED_SOURCE,
            paint: {
              'circle-radius': 20,
              'circle-color': 'transparent',
              'circle-stroke-width': 2,
              'circle-stroke-color': BRAND,
              'circle-stroke-opacity': 0.3,
              'circle-translate': [0, -14],
              'circle-translate-anchor': 'viewport',
            },
          })

          // Inner solid selection ring
          map.addLayer({
            id: SELECTED_LAYER,
            type: 'circle',
            source: SELECTED_SOURCE,
            paint: {
              'circle-radius': 16,
              'circle-color': BRAND,
              'circle-opacity': 0.1,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': BRAND,
              'circle-stroke-opacity': 0.5,
              'circle-translate': [0, -14],
              'circle-translate-anchor': 'viewport',
            },
          })

          // Pulse animation is started/stopped by the selectedHouseId effect (not always-on)

          map.addSource(SELECTED_TREE_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: SELECTED_TREE_LAYER + '-pulse',
            type: 'circle',
            source: SELECTED_TREE_SOURCE,
            paint: {
              'circle-radius': 18,
              'circle-color': 'transparent',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#15803d',
              'circle-stroke-opacity': 0.28,
              'circle-translate': [0, -12],
              'circle-translate-anchor': 'viewport',
            },
          })
          map.addLayer({
            id: SELECTED_TREE_LAYER,
            type: 'circle',
            source: SELECTED_TREE_SOURCE,
            paint: {
              'circle-radius': 14,
              'circle-color': '#22c55e',
              'circle-opacity': 0.1,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#15803d',
              'circle-stroke-opacity': 0.45,
              'circle-translate': [0, -12],
              'circle-translate-anchor': 'viewport',
            },
          })

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

          map.addSource(SELECTED_START_SOURCE, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })
          map.addLayer({
            id: SELECTED_START_LAYER + '-pulse',
            type: 'circle',
            source: SELECTED_START_SOURCE,
            paint: {
              'circle-radius': 19,
              'circle-color': 'transparent',
              'circle-stroke-width': 2,
              'circle-stroke-color': '#15803d',
              'circle-stroke-opacity': 0.28,
              'circle-translate': [0, -17],
              'circle-translate-anchor': 'viewport',
            },
          })
          map.addLayer({
            id: SELECTED_START_LAYER,
            type: 'circle',
            source: SELECTED_START_SOURCE,
            paint: {
              'circle-radius': 15,
              'circle-color': '#22c55e',
              'circle-opacity': 0.12,
              'circle-stroke-width': 2.5,
              'circle-stroke-color': '#15803d',
              'circle-stroke-opacity': 0.45,
              'circle-translate': [0, -17],
              'circle-translate-anchor': 'viewport',
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

            // House marker — crisp SVG icon anchored at bottom, number below
            map.addLayer({
              id: HOUSE_LAYER,
              type: 'symbol',
              source: HOUSE_SOURCE,
              layout: {
                'icon-image': ['get', 'iconImage'],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.35, 16, 0.55, 19, 0.7],
                'icon-allow-overlap': true,
                'icon-anchor': 'bottom',
                'text-field': useStore.getState().visibleLayers['housenumbers']
                  ? [
                      'format',
                      ['get', 'num'], { 'font-scale': 1.0 },
                      ['case', ['!=', ['get', 'label'], ''],
                        ['concat', '\n', ['get', 'label']],
                        '',
                      ], { 'font-scale': 0.85 },
                    ]
                  : '',
                'text-size': ['interpolate', ['linear'], ['zoom'], 13, 7, 16, 9, 19, 11],
                'text-anchor': 'top',
                'text-offset': [0, 0.2],
                'text-line-height': 1.3,
                'text-max-width': 8,
                'text-allow-overlap': true,
                'text-padding': 0,
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-rotation-alignment': 'viewport',
                'text-pitch-alignment': 'viewport',
              },
              paint: {
                'text-color': ['coalesce', ['get', 'bodyColor'], BRAND],
                'text-halo-color': 'rgba(255,255,255,1)',
                'text-halo-width': 1.5,
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

            map.addSource(START_MARKER_SOURCE, {
              type: 'geojson',
              data: { type: 'FeatureCollection', features: [] },
            })

            try {
              const startMarkerImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image(40, 48)
                img.onload = () => resolve(img)
                img.onerror = reject
                img.src = generateStartMarkerSVG()
              })
              if (!map.hasImage(START_MARKER_IMAGE)) map.addImage(START_MARKER_IMAGE, startMarkerImg)
            } catch {
              void 0
            }

            map.addLayer(map.hasImage(START_MARKER_IMAGE) ? {
              id: START_MARKER_LAYER,
              type: 'symbol',
              source: START_MARKER_SOURCE,
              layout: {
                'icon-image': START_MARKER_IMAGE,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.72, 16, 0.9, 19, 1.06],
                'icon-anchor': 'bottom',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
              },
            } : {
              id: START_MARKER_LAYER,
              type: 'circle',
              source: START_MARKER_SOURCE,
              paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 16, 8.5, 19, 10.5],
                'circle-color': '#22c55e',
                'circle-opacity': 0.98,
                'circle-stroke-width': 2.5,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-opacity': 1,
              },
            })

            map.addLayer({
              id: START_MARKER_LABEL_LAYER,
              type: 'symbol',
              source: START_MARKER_SOURCE,
              layout: {
                'text-field': ['get', 'label'],
                'text-size': ['interpolate', ['linear'], ['zoom'], 13, 9, 16, 11, 19, 13],
                'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
                'text-anchor': 'bottom',
                'text-offset': [0, -3.05],
                'text-padding': 2,
                'text-max-width': 8,
                'text-allow-overlap': true,
                'text-rotation-alignment': 'viewport',
                'text-pitch-alignment': 'viewport',
              },
              paint: {
                'text-color': '#166534',
                'text-halo-color': 'rgba(255,255,255,0.98)',
                'text-halo-width': 2,
                'text-halo-blur': 0.2,
              },
            })

            setLoading(false)
            mapRef.current = map
            setMapReady(true)
          onMapReadyRef.current?.(map)
          }

          setupHouseLayers().catch((err) => {
            if (import.meta.env.DEV) console.error('House layer setup failed:', err)
            setLoading(false)
            mapRef.current = map
            setMapReady(true)
            onMapReadyRef.current?.(map)
          })
        })

        map.on('error', (e) => {
          if (import.meta.env.DEV) console.error('MapLibre error:', e)
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

  // Keep MapLibre in sync with layout changes such as the desktop sidebar
  // collapsing, otherwise the canvas gets visually stretched mid-transition.
  useEffect(() => {
    const container = containerRef.current
    const map = mapRef.current
    if (!container || !mapReady || !map) return

    const queueResize = () => {
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current)
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null
        mapRef.current?.resize()
      })
    }

    queueResize()

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      if (entry.contentRect.width === 0 || entry.contentRect.height === 0) return
      queueResize()
    })

    observer.observe(container)

    return () => {
      observer.disconnect()
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current)
        resizeFrameRef.current = null
      }
    }
  }, [mapReady])

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

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(START_MARKER_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (!startMarker) {
      source.setData({ type: 'FeatureCollection', features: [] })
      return
    }

    source.setData({
      type: 'FeatureCollection',
      features: [{
        ...startMarker,
        properties: {
          ...(startMarker.properties || {}),
          id: 'start-marker',
          label: 'Start Here',
        },
      }],
    })
  }, [startMarker, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(SELECTED_TREE_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (selectedTreeId) {
      const tree = treePoints.find((p) => p.id === selectedTreeId)
      if (tree) {
        source.setData({ type: 'FeatureCollection', features: [tree] })
        return
      }
    }

    source.setData({ type: 'FeatureCollection', features: [] })
  }, [selectedTreeId, treePoints, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const source = map.getSource(SELECTED_START_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (!source) return

    if (selectedStartMarker && startMarker) {
      source.setData({ type: 'FeatureCollection', features: [startMarker] })
      return
    }

    source.setData({ type: 'FeatureCollection', features: [] })
  }, [selectedStartMarker, startMarker, mapReady])

  // boundaryOpacity, maskOpacity synced via direct Zustand subscription below

  // Switch map view mode (satellite / street / clean)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    try { applyMapMode(map, effectiveMode) } catch { /* layers may not exist yet */ }
  }, [effectiveMode, mapReady])

  // Handle click-to-place houses, trees, start marker
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const state = useStore.getState()
      const mode = state.activeDrawMode

      // Enforce boundary containment for point markers
      if (state.boundary && (mode === 'house' || mode === 'tree' || mode === 'startMarker')) {
        const pt = point([e.lngLat.lng, e.lngLat.lat])
        if (!booleanPointInPolygon(pt, state.boundary)) return
      }

      if (mode === 'house') {
        const snap = state.snapToGrid
        const spacing = state.gridSpacingMeters
        const [lng, lat] = snap
          ? snapCoord(e.lngLat.lng, e.lngLat.lat, spacing)
          : [e.lngLat.lng, e.lngLat.lat]

        // Prevent duplicate — skip if an existing house is within 10px on screen
        const clickPx = map.project([lng, lat])
        const tooClose = state.housePoints.some((h) => {
          const hPx = map.project(h.geometry.coordinates as [number, number])
          const dx = hPx.x - clickPx.x
          const dy = hPx.y - clickPx.y
          return dx * dx + dy * dy < 100 // 10px radius squared
        })
        if (tooClose) { showToast('House already exists here'); return }

        addHousePoint(lng, lat)
      } else if (mode === 'tree') {
        const snap = state.snapToGrid
        const spacing = state.gridSpacingMeters
        const [lng, lat] = snap
          ? snapCoord(e.lngLat.lng, e.lngLat.lat, spacing)
          : [e.lngLat.lng, e.lngLat.lat]

        // Prevent duplicate tree in same spot
        const clickPx = map.project([lng, lat])
        const tooClose = state.treePoints.some((t) => {
          const tPx = map.project(t.geometry.coordinates as [number, number])
          const dx = tPx.x - clickPx.x
          const dy = tPx.y - clickPx.y
          return dx * dx + dy * dy < 100
        })
        if (tooClose) { showToast('Tree already exists here'); return }

        state.addTreePoint(lng, lat)
      } else if (mode === 'startMarker') {
        if (!state.boundary) {
          showToast('Draw a boundary before placing Start Here')
          return
        }

        const snap = state.snapToGrid
        const spacing = state.gridSpacingMeters
        const [lng, lat] = snap
          ? snapCoord(e.lngLat.lng, e.lngLat.lat, spacing)
          : [e.lngLat.lng, e.lngLat.lat]

        const pt = point([lng, lat])
        if (!booleanPointInPolygon(pt, state.boundary)) {
          showToast('Place Start Here inside the boundary')
          return
        }

        state.setStartMarker({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { label: 'Start Here' },
        })
        state.setSelectedStartMarker(false)
      }
    }

    map.on('click', handleClick)
    return () => { map.off('click', handleClick) }
  }, [mapReady, addHousePoint])

  // ─── Direct Zustand subscriptions ───
  // These bypass React's render → effect cycle entirely.
  // State changes pipe straight to MapLibre sources (synchronous, zero-frame-delay).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    /** Helper: sync house features to MapLibre source */
    const syncHouses = () => {
      const source = map.getSource(HOUSE_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!source) return
      const { housePoints, customStatuses: statuses } = useStore.getState()

      const features = housePoints.map((p, i) => {
        const tags = p.properties.tags || []
        const { key, spec } = resolveHouseIcon(tags, statuses)
        return {
          ...p,
          properties: {
            ...p.properties,
            id: p.id,
            iconImage: key,
            bodyColor: spec.bodyColor,
            num: String(i + 1),
            label: p.properties.label || '',
          },
        }
      })

      const houseTags = housePoints.map((p) => ({ tags: p.properties.tags || [] }))
      if (allHouseIconsExist(map, houseTags, statuses)) {
        source.setData({ type: 'FeatureCollection', features })
      } else {
        ensureHouseIcons(map, houseTags, statuses).then(() => {
          source.setData({ type: 'FeatureCollection', features })
        }).catch((err) => {
          if (import.meta.env.DEV) console.error('Failed to load house icons:', err)
        })
      }

      // Clear legacy badge layer
      const badgeSource = map.getSource(BADGE_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (badgeSource) badgeSource.setData({ type: 'FeatureCollection', features: [] })
    }

    /** Helper: sync tree features */
    const syncTrees = () => {
      const source = map.getSource(TREE_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!source) return
      const { treePoints } = useStore.getState()
      source.setData({
        type: 'FeatureCollection',
        features: treePoints.map((t) => ({
          ...t,
          properties: { ...t.properties, id: t.id },
        })),
      })
    }

    /** Helper: sync custom roads */
    const syncRoads = () => {
      const source = map.getSource(ROAD_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!source) return
      const { customRoads } = useStore.getState()
      source.setData({
        type: 'FeatureCollection',
        features: customRoads.map((r) => ({
          ...r,
          properties: { ...r.properties, id: r.id },
        })),
      })
    }

    /** Helper: sync selected house highlight */
    const syncSelectedHouse = () => {
      const source = map.getSource(SELECTED_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!source) return
      const { selectedHouseId: selId, housePoints } = useStore.getState()
      if (selId) {
        const house = housePoints.find((p) => p.id === selId)
        if (house) {
          source.setData({ type: 'FeatureCollection', features: [house] })
          return
        }
      }
      source.setData({ type: 'FeatureCollection', features: [] })
    }

    /** Helper: sync selected road highlight */
    const syncSelectedRoad = () => {
      const source = map.getSource(SELECTED_ROAD_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (!source) return
      const { selectedRoadId: selId, customRoads } = useStore.getState()
      if (selId) {
        const road = customRoads.find((r) => r.id === selId)
        if (road) {
          source.setData({ type: 'FeatureCollection', features: [road] })
          return
        }
      }
      source.setData({ type: 'FeatureCollection', features: [] })
    }

    /** Helper: sync boundary/mask opacity (slider-driven) */
    const syncOpacity = () => {
      const { boundaryOpacity, maskOpacity } = useStore.getState()
      try { map.setPaintProperty(BOUNDARY_FILL, 'fill-opacity', boundaryOpacity) } catch { void 0 }
      try { map.setPaintProperty(MASK_LAYER, 'fill-opacity', maskOpacity) } catch { void 0 }
    }

    /** Helper: sync point-marker sizes (slider-driven) */
    const syncMarkerSize = () => {
      const {
        houseIconSize,
        badgeIconSize,
        treeIconSize,
        startMarkerSize,
      } = useStore.getState()
      try {
        map.setLayoutProperty(HOUSE_LAYER, 'icon-size', [
          'interpolate', ['linear'], ['zoom'],
          13, 0.35 * houseIconSize,
          16, 0.55 * houseIconSize,
          19, 0.7 * houseIconSize,
        ])
      } catch { void 0 }
      try { map.setLayoutProperty(BADGE_LAYER, 'icon-size', badgeIconSize) } catch { void 0 }

      try {
        const treeLayer = map.getLayer(TREE_LAYER) as { type?: string } | undefined
        if (treeLayer?.type === 'symbol') {
          map.setLayoutProperty(TREE_LAYER, 'icon-size', [
            'interpolate', ['linear'], ['zoom'],
            13, 0.4 * treeIconSize,
            16, 0.7 * treeIconSize,
            19, 0.9 * treeIconSize,
          ])
        } else {
          map.setPaintProperty(TREE_LAYER, 'circle-radius', 6 * treeIconSize)
        }
      } catch { void 0 }

      try {
        const startLayer = map.getLayer(START_MARKER_LAYER) as { type?: string } | undefined
        if (startLayer?.type === 'symbol') {
          map.setLayoutProperty(START_MARKER_LAYER, 'icon-size', [
            'interpolate', ['linear'], ['zoom'],
            13, 0.72 * startMarkerSize,
            16, 0.9 * startMarkerSize,
            19, 1.06 * startMarkerSize,
          ])
        } else {
          map.setPaintProperty(START_MARKER_LAYER, 'circle-radius', [
            'interpolate', ['linear'], ['zoom'],
            13, 6 * startMarkerSize,
            16, 8.5 * startMarkerSize,
            19, 10.5 * startMarkerSize,
          ])
        }
      } catch { void 0 }
    }

    // Run all syncs once on mount (populate from loaded project data)
    syncHouses()
    syncTrees()
    syncRoads()
    syncSelectedHouse()
    syncSelectedRoad()
    syncOpacity()
    syncMarkerSize()

    // Subscribe — Zustand fires this synchronously on every state change.
    // We compare slices to only run the sync that actually changed.
    let prev = useStore.getState()
    const unsub = useStore.subscribe((next) => {
      if (next.housePoints !== prev.housePoints || next.customStatuses !== prev.customStatuses) syncHouses()
      if (next.treePoints !== prev.treePoints) syncTrees()
      if (next.customRoads !== prev.customRoads) syncRoads()
      if (next.selectedHouseId !== prev.selectedHouseId || next.housePoints !== prev.housePoints) syncSelectedHouse()
      if (next.selectedRoadId !== prev.selectedRoadId || next.customRoads !== prev.customRoads) syncSelectedRoad()
      if (next.boundaryOpacity !== prev.boundaryOpacity || next.maskOpacity !== prev.maskOpacity) syncOpacity()
      if (
        next.houseIconSize !== prev.houseIconSize ||
        next.badgeIconSize !== prev.badgeIconSize ||
        next.treeIconSize !== prev.treeIconSize ||
        next.startMarkerSize !== prev.startMarkerSize
      ) syncMarkerSize()
      prev = next
    })

    return unsub
  }, [mapReady])

  // Pulse animation for selected house — driven by React selector (changes rarely)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedHouseId) return

    let pulsePhase = 0
    let rafId = requestAnimationFrame(function animate() {
      pulsePhase = (pulsePhase + 0.03) % (Math.PI * 2)
      const scale = 1 + Math.sin(pulsePhase) * 0.3
      const opacity = 0.15 + Math.sin(pulsePhase) * 0.15
      try {
        map.setPaintProperty(SELECTED_LAYER + '-pulse', 'circle-radius', 18 + scale * 6)
        map.setPaintProperty(SELECTED_LAYER + '-pulse', 'circle-stroke-opacity', opacity)
      } catch { /* layer may not exist */ }
      rafId = requestAnimationFrame(animate)
    })

    return () => cancelAnimationFrame(rafId)
  }, [selectedHouseId, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedTreeId) return

    let pulsePhase = 0
    let rafId = requestAnimationFrame(function animate() {
      pulsePhase = (pulsePhase + 0.03) % (Math.PI * 2)
      const scale = 1 + Math.sin(pulsePhase) * 0.3
      const opacity = 0.15 + Math.sin(pulsePhase) * 0.15
      try {
        map.setPaintProperty(SELECTED_TREE_LAYER + '-pulse', 'circle-radius', 16 + scale * 5)
        map.setPaintProperty(SELECTED_TREE_LAYER + '-pulse', 'circle-stroke-opacity', opacity)
      } catch { void 0 }
      rafId = requestAnimationFrame(animate)
    })

    return () => cancelAnimationFrame(rafId)
  }, [selectedTreeId, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedStartMarker) return

    let pulsePhase = 0
    let rafId = requestAnimationFrame(function animate() {
      pulsePhase = (pulsePhase + 0.03) % (Math.PI * 2)
      const scale = 1 + Math.sin(pulsePhase) * 0.3
      const opacity = 0.15 + Math.sin(pulsePhase) * 0.15
      try {
        map.setPaintProperty(SELECTED_START_LAYER + '-pulse', 'circle-radius', 18 + scale * 5.5)
        map.setPaintProperty(SELECTED_START_LAYER + '-pulse', 'circle-stroke-opacity', opacity)
      } catch { void 0 }
      rafId = requestAnimationFrame(animate)
    })

    return () => cancelAnimationFrame(rafId)
  }, [selectedStartMarker, mapReady])

  // house/tree/start sizes synced via direct Zustand subscription below

  // Drag-to-move houses & trees (requires 5px movement before drag starts)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    let pendingId: string | null = null
    let dragId: string | null = null
    let dragType: 'house' | 'tree' | 'start' | null = null
    let startPoint: maplibregl.Point | null = null
    let rafId: number | null = null
    const DRAG_THRESHOLD = 5
    const canvas = map.getCanvas()
    const DRAGGABLE_LAYERS = [HOUSE_LAYER, TREE_LAYER, START_MARKER_LAYER]

    /** Query both house and tree layers, return { id, type } or null */
    const hitTest = (bbox: [maplibregl.PointLike, maplibregl.PointLike]) => {
      for (const layer of DRAGGABLE_LAYERS) {
        if (!map.getLayer(layer)) continue
        const features = map.queryRenderedFeatures(bbox, { layers: [layer] })
        if (features.length > 0) {
          const id = features[0].properties?.id as string | undefined
          if (id) {
            const type =
              layer === HOUSE_LAYER ? 'house' as const :
              layer === TREE_LAYER ? 'tree' as const :
              'start' as const
            return { id, type }
          }
        }
      }
      return null
    }

    /** Move the dragged feature via the appropriate store action */
    const moveDragged = (id: string, type: 'house' | 'tree' | 'start', lng: number, lat: number) => {
      if (type === 'house') moveHousePoint(id, lng, lat)
      else if (type === 'tree') moveTreePoint(id, lng, lat)
      else moveStartMarker(lng, lat)
    }

    const onMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (activeDrawMode && activeDrawMode !== 'select') return

      const tolerance = 12
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [e.point.x - tolerance, e.point.y - tolerance],
        [e.point.x + tolerance, e.point.y + tolerance],
      ]
      const hit = hitTest(bbox)
      if (!hit) return

      pendingId = hit.id
      dragType = hit.type
      startPoint = e.point
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
      // Show grab cursor on hover over editable point markers
      if (!activeDrawMode || activeDrawMode === 'select') {
        const layers = DRAGGABLE_LAYERS.filter((l) => map.getLayer(l))
        const features = layers.length > 0 ? map.queryRenderedFeatures(e.point, { layers }) : []
          canvas.style.cursor = features.length > 0 ? 'grab' : ''
        }
        return
      }

      const snap = useStore.getState().snapToGrid
      const spacing = useStore.getState().gridSpacingMeters
      const [lng, lat] = snap
        ? snapCoord(e.lngLat.lng, e.lngLat.lat, spacing)
        : [e.lngLat.lng, e.lngLat.lat]

      // Block drag outside boundary
      const bnd = useStore.getState().boundary
      if (bnd && !booleanPointInPolygon([lng, lat], bnd)) {
        canvas.style.cursor = 'not-allowed'
        return
      }

      canvas.style.cursor = 'grabbing'
      moveDragged(dragId, dragType!, lng, lat)
    }

    const onMouseUp = () => {
      pendingId = null
      startPoint = null
      if (dragId) {
        dragId = null
        dragType = null
        canvas.style.cursor = ''
        if (useStore.getState()._lastMoveId) useStore.setState({ _lastMoveId: null })
        justDraggedRef.current = true
        setTimeout(() => { justDraggedRef.current = false }, 100)
      }
      map.dragPan.enable()
    }

    // Touch support for tablet users
    // Disables both dragPan AND touchZoomRotate during drag to prevent
    // accidental zoom from a second finger touching the screen.

    /** Cancel any in-progress drag/pending state and restore map gestures */
    const cancelTouchDrag = () => {
      if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
      pendingId = null
      startPoint = null
      if (dragId) {
        dragId = null
        dragType = null
        if (useStore.getState()._lastMoveId) useStore.setState({ _lastMoveId: null })
        justDraggedRef.current = true
        setTimeout(() => { justDraggedRef.current = false }, 300)
      }
      map.dragPan.enable()
      map.touchZoomRotate.enable()
    }

    const onTouchStart = (e: maplibregl.MapTouchEvent) => {
      if (activeDrawMode && activeDrawMode !== 'select') return

      // Multi-touch while pending/dragging → cancel drag, let map handle pinch
      if (e.originalEvent.touches.length !== 1) {
        if (pendingId || dragId) cancelTouchDrag()
        return
      }

      const touch = e.originalEvent.touches[0]
      const rect = canvas.getBoundingClientRect()
      const point = new maplibregl.Point(touch.clientX - rect.left, touch.clientY - rect.top)

      const tolerance = 20
      const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
        [point.x - tolerance, point.y - tolerance],
        [point.x + tolerance, point.y + tolerance],
      ]
      const hit = hitTest(bbox)
      if (!hit) return

      pendingId = hit.id
      dragType = hit.type
      startPoint = point
      // Disable BOTH pan and zoom to fully isolate the drag gesture
      map.dragPan.disable()
      map.touchZoomRotate.disable()
    }

    const onTouchMove = (e: maplibregl.MapTouchEvent) => {
      if (!pendingId && !dragId) return

      // Multi-touch appeared mid-drag → cancel cleanly
      if (e.originalEvent.touches.length !== 1) {
        cancelTouchDrag()
        return
      }

      // Prevent browser from interpreting as scroll/zoom during drag
      if (dragId) e.originalEvent.preventDefault()

      if (rafId !== null) cancelAnimationFrame(rafId)

      const touch = e.originalEvent.touches[0]
      const rect = canvas.getBoundingClientRect()
      const point = new maplibregl.Point(touch.clientX - rect.left, touch.clientY - rect.top)

      if (pendingId && startPoint && !dragId) {
        const dx = point.x - startPoint.x
        const dy = point.y - startPoint.y
        if (Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
          dragId = pendingId
          pendingId = null
        }
        return
      }

      if (!dragId) return

      rafId = requestAnimationFrame(() => {
        rafId = null
        const lngLat = map.unproject(point)
        const snap = useStore.getState().snapToGrid
        const spacing = useStore.getState().gridSpacingMeters
        const [lng, lat] = snap
          ? snapCoord(lngLat.lng, lngLat.lat, spacing)
          : [lngLat.lng, lngLat.lat]

        const bnd = useStore.getState().boundary
        if (bnd && !booleanPointInPolygon([lng, lat], bnd)) return

        moveDragged(dragId!, dragType!, lng, lat)
      })
    }

    const onTouchEnd = (e: maplibregl.MapTouchEvent) => {
      // If fingers remain on screen, don't clean up yet
      if (e.originalEvent.touches.length > 0) return
      cancelTouchDrag()
    }

    map.on('mousedown', onMouseDown)
    map.on('mousemove', onMouseMove)
    map.on('mouseup', onMouseUp)
    map.on('touchstart', onTouchStart)
    map.on('touchmove', onTouchMove)
    map.on('touchend', onTouchEnd)

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      map.off('mousedown', onMouseDown)
      map.off('mousemove', onMouseMove)
      map.off('mouseup', onMouseUp)
      map.off('touchstart', onTouchStart)
      map.off('touchmove', onTouchMove)
      map.off('touchend', onTouchEnd)
    }
  }, [activeDrawMode, moveHousePoint, moveTreePoint, moveStartMarker, mapReady])

  // Click-to-select house or road + Delete/Backspace to remove
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const selectHouse = useStore.getState().setSelectedHouseId
    const selectTree = useStore.getState().setSelectedTreeId
    const selectRoad = useStore.getState().setSelectedRoadId
    const selectStartMarker = useStore.getState().setSelectedStartMarker
    const removeRoad = useStore.getState().removeCustomRoad
    const setStartMarker = useStore.getState().setStartMarker

    const onClick = (e: maplibregl.MapMouseEvent) => {
      // Skip if this click follows a drag (house/tree was moved, not tapped)
      if (justDraggedRef.current) return
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
          selectTree(null)
          selectRoad(null)
          selectStartMarker(false)
          return
        }
      }

      // Check trees
      if (map.getLayer(TREE_LAYER)) {
        const treeFeatures = map.queryRenderedFeatures(bbox, { layers: [TREE_LAYER] })
        if (treeFeatures.length > 0) {
          const id = treeFeatures[0].properties?.id as string | undefined
          if (id) {
            selectTree(id)
            selectHouse(null)
            selectRoad(null)
            selectStartMarker(false)
            return
          }
        }
      }

      if (map.getLayer(START_MARKER_LAYER)) {
        const startFeatures = map.queryRenderedFeatures(bbox, { layers: [START_MARKER_LAYER] })
        if (startFeatures.length > 0) {
          selectStartMarker(true)
          selectHouse(null)
          selectTree(null)
          selectRoad(null)
          return
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
            selectTree(null)
            selectStartMarker(false)
            return
          }
        }
      }

      // Clicked empty area — deselect all
      selectHouse(null)
      selectTree(null)
      selectRoad(null)
      selectStartMarker(false)
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
        } else if (state.selectedTreeId) {
          e.preventDefault()
          useStore.getState().removeTreePoint(state.selectedTreeId)
          selectTree(null)
        } else if (state.selectedRoadId) {
          e.preventDefault()
          removeRoad(state.selectedRoadId)
          selectRoad(null)
        } else if (state.selectedStartMarker) {
          e.preventDefault()
          setStartMarker(null)
          selectStartMarker(false)
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

  // Dynamic cursor: crosshair inside boundary, not-allowed outside (for house/tree/road modes)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const needsBoundaryCheck =
      activeDrawMode === 'house' ||
      activeDrawMode === 'tree' ||
      activeDrawMode === 'road' ||
      activeDrawMode === 'startMarker'

    if (!needsBoundaryCheck) {
      // Boundary drawing or no mode — static cursor
      map.getCanvas().style.cursor = (activeDrawMode === 'boundary') ? 'crosshair' : ''
      return
    }

    const boundary = useStore.getState().boundary
    if (!boundary) {
      map.getCanvas().style.cursor = activeDrawMode === 'startMarker' ? 'not-allowed' : 'crosshair'
      return
    }

    const onMouseMove = (e: maplibregl.MapMouseEvent) => {
      const pt = point([e.lngLat.lng, e.lngLat.lat])
      const inside = booleanPointInPolygon(pt, boundary)
      map.getCanvas().style.cursor = inside ? 'crosshair' : 'not-allowed'
    }

    map.getCanvas().style.cursor = 'not-allowed'
    map.on('mousemove', onMouseMove)
    return () => {
      map.off('mousemove', onMouseMove)
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
          <div className="max-w-80 rounded-lg border border-red-200 bg-red-50 p-4 text-center">
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
