import { useRef, useCallback, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import type { Feature, Polygon, LineString } from 'geojson'
import type { DrawMode } from '../types/project'

interface UseDrawOptions {
  onBoundaryComplete: (feature: Feature<Polygon>) => void
  onRoadComplete: (feature: Feature<LineString>) => void
}

type ActiveLineMode = 'boundary' | 'road' | null

const DRAW_SOURCE = 'draw-line'
const DRAW_LAYER = 'draw-line-layer'
const VERTEX_SOURCE = 'draw-vertices'
const VERTEX_LAYER = 'draw-vertices-dots'
const CURSOR_SOURCE = 'draw-cursor-line'
const CURSOR_LAYER = 'draw-cursor-line-layer'

export function useDraw(options: UseDrawOptions) {
  const mapRef = useRef<maplibregl.Map | null>(null)
  const optionsRef = useRef(options)
  const activeModeRef = useRef<ActiveLineMode>(null)
  const coordsRef = useRef<[number, number][]>([])
  const undoStackRef = useRef<[number, number][]>([])
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

    const sources: string[] = [VERTEX_SOURCE, DRAW_SOURCE, CURSOR_SOURCE]
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

    // Drawn line layer
    if (!map.getSource(DRAW_SOURCE)) {
      map.addSource(DRAW_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: DRAW_LAYER,
        type: 'line',
        source: DRAW_SOURCE,
        paint: {
          'line-color': '#4a6da7',
          'line-width': 3,
        },
      })
    }

    // Cursor follow line (from last vertex to mouse)
    if (!map.getSource(CURSOR_SOURCE)) {
      map.addSource(CURSOR_SOURCE, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: CURSOR_LAYER,
        type: 'line',
        source: CURSOR_SOURCE,
        paint: {
          'line-color': '#4a6da7',
          'line-width': 2,
          'line-dasharray': [4, 3],
        },
      })
    }

    // Vertex dots layer
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
          'circle-radius': ['case', ['==', ['get', 'isClose'], 1], 8, 6],
          'circle-color': ['case', ['==', ['get', 'isClose'], 1], '#e74c3c', '#4a6da7'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      })
    }

    // Click to add vertex (or close polygon by clicking near first point)
    map.on('click', (e: maplibregl.MapMouseEvent) => {
      if (!activeModeRef.current) return
      const coords = coordsRef.current

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

      coords.push([e.lngLat.lng, e.lngLat.lat])
      undoStackRef.current = []
      updateLayers()
    })

    // Mouse move — dashed line from last vertex to cursor + close hint
    map.on('mousemove', (e: maplibregl.MapMouseEvent) => {
      if (!activeModeRef.current) return
      const coords = coordsRef.current
      if (coords.length === 0) return

      // Show pointer cursor when near first vertex (closable)
      if (activeModeRef.current === 'boundary' && coords.length >= 3) {
        const firstPx = map.project(new maplibregl.LngLat(coords[0][0], coords[0][1]))
        const dist = Math.sqrt((firstPx.x - e.point.x) ** 2 + (firstPx.y - e.point.y) ** 2)
        map.getCanvas().style.cursor = dist < 15 ? 'pointer' : 'crosshair'
      }

      const cursorSource = map.getSource(CURSOR_SOURCE) as maplibregl.GeoJSONSource | undefined
      if (cursorSource) {
        const lastCoord = coords[coords.length - 1]
        cursorSource.setData({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [lastCoord, [e.lngLat.lng, e.lngLat.lat]],
          },
          properties: {},
        })
      }
    })

    // Double-click to finish
    map.on('dblclick', (e: maplibregl.MapMouseEvent) => {
      if (!activeModeRef.current) return
      e.preventDefault()
      // Remove the double-click's extra point (last click already added it)
      finishDrawing()
    })
  }, [updateLayers, clearDraw, finishDrawing])

  const setMode = useCallback((mode: DrawMode) => {
    clearDraw()
    const map = mapRef.current

    switch (mode) {
      case 'boundary':
        activeModeRef.current = 'boundary'
        // Set line color to boundary blue
        if (map) {
          try {
            map.setPaintProperty(DRAW_LAYER, 'line-color', '#4a6da7')
            map.setPaintProperty(CURSOR_LAYER, 'line-color', '#4a6da7')
          } catch { /* ok */ }
        }
        break
      case 'road':
        activeModeRef.current = 'road'
        // Set line color to road gray
        if (map) {
          try {
            map.setPaintProperty(DRAW_LAYER, 'line-color', '#888888')
            map.setPaintProperty(CURSOR_LAYER, 'line-color', '#888888')
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
  }, [clearDraw])

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

  const removeFeature = useCallback((_id: string) => {
    // Not needed with manual drawing
  }, [])

  const clearAll = useCallback(() => {
    clearDraw()
  }, [clearDraw])

  useEffect(() => {
    return () => {
      mapRef.current = null
    }
  }, [])

  return { initDraw, setMode, undo, redo, removeFeature, clearAll }
}
