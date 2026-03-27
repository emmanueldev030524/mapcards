import { useRef, useCallback, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, Polygon, LineString } from 'geojson'
import type { DrawMode } from '../types/project'
import { useStore } from '../store'

interface UseDrawOptions {
  onBoundaryComplete: (feature: Feature<Polygon>) => void
  onRoadComplete: (feature: Feature<LineString>) => void
}

/** Snap radius in screen pixels */
const SNAP_VERTEX_PX = 14
const SNAP_LINE_PX = 10

/**
 * Find nearest snap target from existing roads + boundary.
 * Priority: 1) exact vertices (endpoints/junctions), 2) nearest point on any road line.
 * Vertex snapping gets a wider radius because connecting at endpoints is the most common intent.
 */
function findSnapTarget(
  map: maplibregl.Map,
  clickPoint: maplibregl.Point,
): [number, number] | null {
  const state = useStore.getState()

  // --- Pass 1: vertex snap (road endpoints + boundary vertices) ---
  const vertices: [number, number][] = []

  for (const road of state.customRoads) {
    for (const coord of road.geometry.coordinates) {
      vertices.push(coord as [number, number])
    }
  }

  if (state.boundary) {
    for (const coord of state.boundary.geometry.coordinates[0]) {
      vertices.push(coord as [number, number])
    }
  }

  let bestDist = SNAP_VERTEX_PX
  let bestCoord: [number, number] | null = null

  for (const coord of vertices) {
    const projected = map.project(new maplibregl.LngLat(coord[0], coord[1]))
    const dx = projected.x - clickPoint.x
    const dy = projected.y - clickPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < bestDist) {
      bestDist = dist
      bestCoord = coord
    }
  }

  // Vertex match wins — exact connection at an existing junction/endpoint
  if (bestCoord) return bestCoord

  // --- Pass 2: nearest point on any road line segment ---
  // Enables clean T-intersections by snapping to the middle of a road
  const clickLngLat = map.unproject(clickPoint)
  const clickPt = turf.point([clickLngLat.lng, clickLngLat.lat])

  for (const road of state.customRoads) {
    if (road.geometry.coordinates.length < 2) continue
    const line = turf.lineString(road.geometry.coordinates as [number, number][])
    const nearest = turf.nearestPointOnLine(line, clickPt)
    const nearestCoord = nearest.geometry.coordinates as [number, number]
    const projected = map.project(new maplibregl.LngLat(nearestCoord[0], nearestCoord[1]))
    const dx = projected.x - clickPoint.x
    const dy = projected.y - clickPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < SNAP_LINE_PX && dist < bestDist) {
      bestDist = dist
      bestCoord = nearestCoord
    }
  }

  // Also snap to boundary edges for roads that start/end at the territory border
  if (state.boundary) {
    const ring = state.boundary.geometry.coordinates[0] as [number, number][]
    const boundaryLine = turf.lineString(ring)
    const nearest = turf.nearestPointOnLine(boundaryLine, clickPt)
    const nearestCoord = nearest.geometry.coordinates as [number, number]
    const projected = map.project(new maplibregl.LngLat(nearestCoord[0], nearestCoord[1]))
    const dx = projected.x - clickPoint.x
    const dy = projected.y - clickPoint.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < SNAP_LINE_PX && dist < bestDist) {
      bestDist = dist
      bestCoord = nearestCoord
    }
  }

  return bestCoord
}

type ActiveLineMode = 'boundary' | 'road' | null

const DRAW_SOURCE = 'draw-line'
const DRAW_CASING = 'draw-line-casing'
const DRAW_LAYER = 'draw-line-layer'
const VERTEX_SOURCE = 'draw-vertices'
const VERTEX_LAYER = 'draw-vertices-dots'
const CURSOR_SOURCE = 'draw-cursor-line'
const CURSOR_CASING = 'draw-cursor-line-casing'
const CURSOR_LAYER = 'draw-cursor-line-layer'
const SNAP_SOURCE = 'draw-snap-indicator'
const SNAP_LAYER = 'draw-snap-ring'

export function useDraw(options: UseDrawOptions) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const optionsRef = useRef(options)
  const activeModeRef = useRef<ActiveLineMode>(null)
  const coordsRef = useRef<[number, number][]>([])
  const undoStackRef = useRef<[number, number][]>([])
  const keydownRef = useRef<((e: KeyboardEvent) => void) | null>(null)
  optionsRef.current = options

  const updateLayers = useCallback(() => {
    const map = mapRef.current
    if (!map) return
    const coords = coordsRef.current

    // Update vertex dots — first point is larger/red when closable (boundary, 3+ pts)
    const closable = activeModeRef.current === 'boundary' && coords.length >= 3
    const vertexSource = map.getSource(VERTEX_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (vertexSource) {
      vertexSource.setData({
        type: 'FeatureCollection',
        features: coords.map((coord, i) => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: coord },
          properties: { index: i, isClose: i === 0 && closable ? 1 : 0 },
        })),
      })
    }

    // Update line
    const lineSource = map.getSource(DRAW_SOURCE) as maplibregl.GeoJSONSource | undefined
    if (lineSource) {
      if (coords.length >= 2) {
        lineSource.setData({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: coords },
          properties: {},
        })
      } else {
        lineSource.setData({ type: 'FeatureCollection', features: [] })
      }
    }
  }, [])

  const clearDraw = useCallback(() => {
    coordsRef.current = []
    undoStackRef.current = []
    const map = mapRef.current
    if (!map) return

    const sources: string[] = [VERTEX_SOURCE, DRAW_SOURCE, CURSOR_SOURCE, SNAP_SOURCE]
    for (const src of sources) {
      const s = map.getSource(src) as maplibregl.GeoJSONSource | undefined
      if (s) s.setData({ type: 'FeatureCollection', features: [] })
    }
  }, [])

  const finishDrawing = useCallback(() => {
    const coords = coordsRef.current
    const mode = activeModeRef.current
    if (!mode || coords.length < 2) return

    if (mode === 'boundary' && coords.length >= 3) {
      const closedCoords = [...coords, coords[0]]
      const polygon: Feature<Polygon> = {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [closedCoords] },
        properties: {},
      }
      clearDraw()
      optionsRef.current.onBoundaryComplete(polygon)
    } else if (mode === 'road') {
      const line: Feature<LineString> = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [...coords] },
        properties: {},
      }
      clearDraw()
      optionsRef.current.onRoadComplete(line)
    }
  }, [clearDraw])

  const initDraw = useCallback((map: maplibregl.Map) => {
    if (mapRef.current) return
    mapRef.current = map

    // Drawn line layer — bright yellow with dark outline for max visibility on satellite
    if (!map.getSource(DRAW_SOURCE)) {
      map.addSource(DRAW_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: DRAW_CASING,
        type: 'line',
        source: DRAW_SOURCE,
        paint: {
          'line-color': '#000000',
          'line-width': 7,
          'line-opacity': 0.5,
        },
      })
      map.addLayer({
        id: DRAW_LAYER,
        type: 'line',
        source: DRAW_SOURCE,
        paint: {
          'line-color': '#facc15',
          'line-width': 3.5,
        },
      })
    }

    // Cursor follow line — bright yellow dashed with dark casing
    if (!map.getSource(CURSOR_SOURCE)) {
      map.addSource(CURSOR_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: CURSOR_CASING,
        type: 'line',
        source: CURSOR_SOURCE,
        paint: {
          'line-color': '#000000',
          'line-width': 5,
          'line-opacity': 0.35,
        },
      })
      map.addLayer({
        id: CURSOR_LAYER,
        type: 'line',
        source: CURSOR_SOURCE,
        paint: {
          'line-color': '#facc15',
          'line-width': 2.5,
          'line-dasharray': [4, 3],
        },
      })
    }

    // Vertex dots — bright yellow with dark stroke
    if (!map.getSource(VERTEX_SOURCE)) {
      map.addSource(VERTEX_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: VERTEX_LAYER,
        type: 'circle',
        source: VERTEX_SOURCE,
        paint: {
          'circle-radius': ['case', ['==', ['get', 'isClose'], 1], 9, 6],
          'circle-color': ['case', ['==', ['get', 'isClose'], 1], '#ef4444', '#facc15'],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#000000',
          'circle-stroke-opacity': 0.6,
        },
      })
    }

    // Snap indicator — pulsing ring that appears when near a snap target
    if (!map.getSource(SNAP_SOURCE)) {
      map.addSource(SNAP_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: SNAP_LAYER,
        type: 'circle',
        source: SNAP_SOURCE,
        paint: {
          'circle-radius': 10,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#3b82f6',
          'circle-stroke-opacity': 0.8,
        },
      })
    }

    // Click to add vertex (or close polygon by clicking near first point)
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!activeModeRef.current) return
      const coords = coordsRef.current

      // Enforce boundary containment for road drawing
      if (activeModeRef.current === 'road') {
        const boundary = useStore.getState().boundary
        if (boundary) {
          const pt = turf.point([e.lngLat.lng, e.lngLat.lat])
          if (!turf.booleanPointInPolygon(pt, boundary)) return
        }
      }

      // Check if clicking near first vertex to close (boundary mode, 3+ points)
      if (activeModeRef.current === 'boundary' && coords.length >= 3) {
        const firstPx = map.project(new maplibregl.LngLat(coords[0][0], coords[0][1]))
        const clickPx = e.point
        const dist = Math.sqrt((firstPx.x - clickPx.x) ** 2 + (firstPx.y - clickPx.y) ** 2)
        if (dist < 15) {
          finishDrawing()
          return
        }
      }

      // Magnetic snap: check for nearby existing vertices
      const snapped = findSnapTarget(map, e.point)
      const coord: [number, number] = snapped || [e.lngLat.lng, e.lngLat.lat]

      coords.push(coord)
      undoStackRef.current = []
      updateLayers()
    })

    // Mouse move — dashed line from last vertex to cursor + close hint + snap indicator
    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      if (!activeModeRef.current) return
      const coords = coordsRef.current
      if (coords.length === 0) return

      // Check for snap target
      const snapped = findSnapTarget(map, e.point)
      const snapSource = map.getSource(SNAP_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (snapSource) {
        if (snapped) {
          snapSource.setData({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: snapped },
            properties: {},
          })
        } else {
          snapSource.setData({ type: 'FeatureCollection', features: [] })
        }
      }

      // Resolve the effective cursor coordinate (snapped or raw)
      const cursorCoord: [number, number] = snapped || [e.lngLat.lng, e.lngLat.lat]

      // Cursor logic: not-allowed outside boundary for road mode
      if (activeModeRef.current === 'road') {
        const boundary = useStore.getState().boundary
        if (boundary) {
          const pt = turf.point([e.lngLat.lng, e.lngLat.lat])
          if (!turf.booleanPointInPolygon(pt, boundary)) {
            map.getCanvas().style.cursor = 'not-allowed'
            return
          }
        }
        map.getCanvas().style.cursor = snapped ? 'grab' : 'crosshair'
      } else if (activeModeRef.current === 'boundary' && coords.length >= 3) {
        const firstPx = map.project(new maplibregl.LngLat(coords[0][0], coords[0][1]))
        const dist = Math.sqrt((firstPx.x - e.point.x) ** 2 + (firstPx.y - e.point.y) ** 2)
        map.getCanvas().style.cursor = dist < 15 ? 'pointer' : snapped ? 'grab' : 'crosshair'
      } else {
        map.getCanvas().style.cursor = snapped ? 'grab' : 'crosshair'
      }

      const cursorSource = map.getSource(CURSOR_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (cursorSource) {
        const lastCoord = coords[coords.length - 1]
        cursorSource.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [lastCoord, cursorCoord],
          },
          properties: {},
        })
      }
    })

    // Double-click to finish
    map.on('dblclick', (e: maplibregl.MapMouseEvent) => {
      if (!activeModeRef.current) return
      e.preventDefault()
      finishDrawing()
    })

    // Enter key to finish drawing (stored for cleanup)
    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeModeRef.current) return
      if (e.key === 'Enter' && coordsRef.current.length >= 2) {
        e.preventDefault()
        finishDrawing()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    keydownRef.current = onKeyDown
  }, [updateLayers, clearDraw, finishDrawing])

  const setMode = useCallback((mode: DrawMode) => {
    // If re-clicking the same mode while drawing, finish the current drawing
    if (mode === activeModeRef.current && coordsRef.current.length >= 2) {
      finishDrawing()
      return
    }
    clearDraw()
    const map = mapRef.current

    switch (mode) {
      case 'boundary':
        activeModeRef.current = 'boundary'
        // Bright yellow for satellite visibility
        if (map) {
          try {
            map.setPaintProperty(DRAW_LAYER, 'line-color', '#facc15')
            map.setPaintProperty(DRAW_CASING, 'line-color', '#000000')
            map.setPaintProperty(CURSOR_LAYER, 'line-color', '#facc15')
            map.setPaintProperty(CURSOR_CASING, 'line-color', '#000000')
          } catch { /* ok */ }
        }
        break
      case 'road':
        activeModeRef.current = 'road'
        // Road gray with white casing
        if (map) {
          try {
            map.setPaintProperty(DRAW_LAYER, 'line-color', '#888888')
            map.setPaintProperty(DRAW_CASING, 'line-color', '#ffffff')
            map.setPaintProperty(CURSOR_LAYER, 'line-color', '#888888')
            map.setPaintProperty(CURSOR_CASING, 'line-color', '#ffffff')
          } catch { /* ok */ }
        }
        break
      default:
        activeModeRef.current = null
        break
    }

    // Update cursor
    if (map) {
      map.getCanvas().style.cursor = activeModeRef.current ? 'crosshair' : ''
    }
  }, [clearDraw, finishDrawing])

  const undo = useCallback(() => {
    if (coordsRef.current.length === 0) return
    const removed = coordsRef.current.pop()!
    undoStackRef.current.push(removed)
    updateLayers()
  }, [updateLayers])

  const redo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const restored = undoStackRef.current.pop()!
    coordsRef.current.push(restored)
    updateLayers()
  }, [updateLayers])

  const clearAll = useCallback(() => {
    clearDraw()
  }, [clearDraw])

  useEffect(() => {
    return () => {
      if (keydownRef.current) {
        window.removeEventListener('keydown', keydownRef.current)
        keydownRef.current = null
      }
      mapRef.current = null
    }
  }, [])

  /** Finish the current drawing (boundary needs 3+ pts, road needs 2+) */
  const finish = useCallback(() => {
    finishDrawing()
  }, [finishDrawing])

  /** Get the current vertex count (for enabling/disabling Done button) */
  const getVertexCount = useCallback(() => coordsRef.current.length, [])

  return { initDraw, setMode, undo, redo, clearAll, finish, getVertexCount }
}
