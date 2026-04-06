import type { StyleSpecification, LayerSpecification, SourceSpecification } from 'maplibre-gl'

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

// Satellite imagery (Esri World Imagery — free, global, high quality)
export const SATELLITE_SOURCE = 'satellite-tiles'
export const SATELLITE_LAYER = 'satellite-raster'
// Multiple satellite tile providers for fallback
const SATELLITE_TILE_URLS = [
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
]

export type MapViewMode = 'satellite' | 'street' | 'clean'

export interface ToggleableLayer {
  id: string
  label: string
  color: string
  layerIds: string[]
}

const POI_CATEGORIES: Array<{ id: string; class: string; label: string; color: string }> = [
  { id: 'poi-shops', class: 'shop', label: 'Stores', color: '#e74c3c' },
  { id: 'poi-schools', class: 'school', label: 'Schools', color: '#3498db' },
  { id: 'poi-churches', class: 'place_of_worship', label: 'Churches', color: '#9b59b6' },
  { id: 'poi-hospitals', class: 'hospital', label: 'Hospitals', color: '#2ecc71' },
]

export function getToggleableLayers(): ToggleableLayer[] {
  return [
    {
      id: 'buildings',
      label: 'Buildings',
      color: '#6B7B8D',
      layerIds: ['toggle-buildings-fill', 'toggle-buildings-outline'],
    },
    {
      id: 'housenumbers',
      label: 'House Labels',
      color: '#E8A54B',
      layerIds: [],
    },
    ...POI_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      color: cat.color,
      layerIds: [cat.id, `${cat.id}-label`],
    })),
  ]
}

/**
 * Builds the full map style containing:
 * - Satellite raster layer (bottom)
 * - Background
 * - ALL OpenFreeMap "street" layers (for Street mode)
 * - Our custom clean layers (landuse-fill, water-fill, etc.)
 * - Toggle layers (buildings, house numbers, POI)
 *
 * Default visibility: satellite + street layers visible (satellite mode with street fallback).
 * MapView switches visibility based on the active mode.
 */
export async function buildMapStyle(): Promise<StyleSpecification> {
  const res = await fetch(OPENFREEMAP_STYLE_URL)
  if (!res.ok) throw new Error(`Failed to fetch OpenFreeMap style: ${res.status}`)
  const baseStyle: StyleSpecification = await res.json()

  // Keep ALL base layers — tag street-only ones by collecting their IDs
  const allBaseLayers = [...baseStyle.layers]
  const baseLayerIds = new Set(allBaseLayers.map((l) => l.id))

  // Premium warm off-white background
  const bgLayer = allBaseLayers.find((l) => l.id === 'background')
  if (bgLayer && 'paint' in bgLayer) {
    bgLayer.paint = { 'background-color': '#F5F5F0' }
  }

  // Unify base road styling (slate casing + white fill)
  const ROAD_KEYWORDS = ['highway', 'tunnel', 'bridge', 'road']
  const isRoadLayer = (id: string) => ROAD_KEYWORDS.some((k) => id.startsWith(k))
  const isCasing = (id: string) => id.includes('casing')
  const isPath = (id: string) => id.includes('path')

  for (const layer of allBaseLayers) {
    if (!('paint' in layer) || !layer.paint) continue
    const p = layer.paint as Record<string, unknown>
    const id = layer.id

    if (layer.type === 'line' && isRoadLayer(id)) {
      if (isPath(id)) {
        p['line-color'] = '#9CA3AF'
        p['line-opacity'] = 0.5
        p['line-width'] = 1
      } else if (isCasing(id)) {
        p['line-color'] = '#A8B4C4'
      } else if (id.includes('railway')) {
        p['line-color'] = '#B8B8B8'
      } else {
        p['line-color'] = '#ffffff'
      }
    }

    // Mute road labels
    if (layer.type === 'symbol' && isRoadLayer(id)) {
      p['text-color'] = '#9CA3AF'
      p['text-halo-color'] = '#F5F5F0'
    }
  }

  // --- Add our custom "clean" layers on top of base layers ---
  const customCleanLayers: LayerSpecification[] = []

  // Landuse areas
  customCleanLayers.push({
    id: 'landuse-fill',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'landuse',
    paint: {
      'fill-color': [
        'match', ['get', 'class'],
        'park', '#EBF0E7',
        'grass', '#EEF2EB',
        'cemetery', '#EAEDE6',
        'forest', '#E2EBD9',
        'farmland', '#F2F1EC',
        'residential', '#F5F5F0',
        'commercial', '#F3F2EF',
        'industrial', '#F2F0EF',
        'transparent',
      ],
      'fill-opacity': 0.6,
    },
  })

  // Water fill
  customCleanLayers.push({
    id: 'water-fill',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'water',
    paint: { 'fill-color': '#D6E8F0', 'fill-opacity': 0.55 },
  })

  // Waterway lines
  customCleanLayers.push({
    id: 'waterway-line',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    paint: { 'line-color': '#C4DCF0', 'line-width': 1.5, 'line-opacity': 0.5 },
  })

  // --- Toggle layers (managed by LayerToggle) ---
  const toggleLayers: LayerSpecification[] = [
    {
      id: 'toggle-buildings-fill',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      paint: { 'fill-color': '#E8E6E2', 'fill-opacity': 0.6 },
    },
    {
      id: 'toggle-buildings-outline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'building',
      paint: { 'line-color': '#D5D2CC', 'line-width': 0.8 },
    },
    {
      id: 'toggle-housenumbers',
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'housenumber',
      layout: {
        visibility: 'none',
        'text-field': ['get', 'housenumber'],
        'text-size': 10,
        'text-anchor': 'center',
      },
      paint: { 'text-color': '#7f8c8d', 'text-halo-color': '#ffffff', 'text-halo-width': 1 },
    },
  ]

  // POI categories
  for (const cat of POI_CATEGORIES) {
    toggleLayers.push({
      id: cat.id,
      type: 'circle',
      source: 'openmaptiles',
      'source-layer': 'poi',
      filter: ['==', ['get', 'class'], cat.class],
      layout: { visibility: 'none' },
      paint: {
        'circle-radius': 5,
        'circle-color': cat.color,
        'circle-stroke-width': 1,
        'circle-stroke-color': '#ffffff',
      },
    })
    toggleLayers.push({
      id: `${cat.id}-label`,
      type: 'symbol',
      source: 'openmaptiles',
      'source-layer': 'poi',
      filter: ['==', ['get', 'class'], cat.class],
      layout: {
        visibility: 'none',
        'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
        'text-size': 11,
        'text-anchor': 'top',
        'text-offset': [0, 0.8],
        'text-max-width': 8,
      },
      paint: { 'text-color': cat.color, 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
    })
  }

  // Assemble final layers: satellite → base → custom clean → toggles
  const finalLayers: LayerSpecification[] = [
    // Satellite raster at very bottom
    {
      id: SATELLITE_LAYER,
      type: 'raster',
      source: SATELLITE_SOURCE,
      paint: { 'raster-opacity': 1 },
    },
    ...allBaseLayers,
    ...customCleanLayers,
    ...toggleLayers,
  ]

  // Build final style
  const finalStyle: StyleSpecification = {
    ...baseStyle,
    layers: finalLayers,
    sources: {
      ...baseStyle.sources,
      [SATELLITE_SOURCE]: {
        type: 'raster',
        tiles: SATELLITE_TILE_URLS,
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Esri, Maxar, Earthstar Geographics',
      } as SourceSpecification,
    },
  }
  delete (finalStyle as Record<string, unknown>).terrain
  delete (finalStyle as Record<string, unknown>).hillshade
  delete (finalStyle as Record<string, unknown>).sky

  // Default: satellite mode — hide EVERYTHING except satellite raster
  for (const layer of finalStyle.layers) {
    if (layer.id === SATELLITE_LAYER) continue // keep satellite visible
    // Hide all other layers for pure satellite view
    if ('layout' in layer && layer.layout) {
      layer.layout = { ...layer.layout, visibility: 'none' as const }
    } else {
      (layer as Record<string, unknown>).layout = { visibility: 'none' }
    }
  }

  // Store the base layer IDs so we can classify at runtime
  _baseLayerIds = baseLayerIds

  return finalStyle
}

// --- Layer classification ---

let _baseLayerIds: Set<string> = new Set()

/** Returns true if this is a layer from the OpenFreeMap base style (street-view layers) */
export function isBaseStreetLayer(layerId: string): boolean {
  if (layerId === 'background') return false
  return _baseLayerIds.has(layerId)
}

/** Returns true if this is one of our custom clean-mode layers */
export function isCleanOnlyLayer(layerId: string): boolean {
  return layerId === 'landuse-fill' || layerId === 'water-fill' || layerId === 'waterway-line'
}

/** Returns true if this layer is managed by LayerToggle (buildings, POI) */
function isToggleLayer(layerId: string): boolean {
  if (layerId.startsWith('toggle-')) return true
  if (POI_CATEGORIES.some((c) => layerId === c.id || layerId === `${c.id}-label`)) return true
  return false
}

/** Returns true if this is a dynamically added layer (draw, houses, etc.) — never toggle these */
function isDynamicLayer(layerId: string): boolean {
  return DYNAMIC_LAYER_PREFIXES.some((p) => layerId.startsWith(p))
}

/** Prefixes for layers added dynamically after map load */
const DYNAMIC_LAYER_PREFIXES = [
  'draw-',
  'territory-',
  'custom-roads',
  'house-',
  'tree-',
  'start-marker',
  'snap-grid',
  'selected-',
]

/**
 * Apply visibility for a given map view mode.
 * Called by MapView whenever the mode changes.
 */
export function applyMapMode(map: maplibregl.Map, mode: MapViewMode) {
  const style = map.getStyle()
  if (!style?.layers) return

  for (const layer of style.layers) {
    if (isDynamicLayer(layer.id)) continue  // never touch draw/house/boundary layers

    let vis: 'visible' | 'none' = 'none'

    if (layer.id === SATELLITE_LAYER) {
      vis = mode === 'satellite' ? 'visible' : 'none'
    } else if (layer.id === 'background') {
      // Hide background in satellite mode so raster shows through
      vis = mode === 'satellite' ? 'none' : 'visible'
    } else if (isToggleLayer(layer.id)) {
      // Hide toggle layers (buildings, POI) in satellite mode for pure imagery
      // In street/clean modes, respect their individual toggle state (don't change)
      if (mode === 'satellite') {
        vis = 'none'
      } else {
        continue // let LayerToggle manage these
      }
    } else if (isBaseStreetLayer(layer.id)) {
      vis = mode === 'street' ? 'visible' : 'none'
    } else if (isCleanOnlyLayer(layer.id)) {
      vis = mode === 'clean' ? 'visible' : 'none'
    }

    try {
      map.setLayoutProperty(layer.id, 'visibility', vis)
    } catch { /* skip */ }
  }
}

// Need the import for the applyMapMode function signature
import type maplibregl from 'maplibre-gl'
