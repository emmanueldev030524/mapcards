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
      color: '#95a5a6',
      layerIds: ['toggle-buildings-fill', 'toggle-buildings-outline'],
    },
    {
      id: 'housenumbers',
      label: 'House Numbers',
      color: '#7f8c8d',
      layerIds: ['toggle-housenumbers'],
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

  // Warm off-white background for clean/street modes
  const bgLayer = allBaseLayers.find((l) => l.id === 'background')
  if (bgLayer && 'paint' in bgLayer) {
    bgLayer.paint = { 'background-color': '#f8f7f5' }
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
        'park', '#e8f0e4',
        'grass', '#edf3e8',
        'cemetery', '#e6ebe0',
        'forest', '#dde8d5',
        'farmland', '#f0efe8',
        'residential', '#f4f3f0',
        'commercial', '#f2f0ed',
        'industrial', '#f0eeed',
        'transparent',
      ],
      'fill-opacity': 0.7,
    },
  })

  // Water fill
  customCleanLayers.push({
    id: 'water-fill',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'water',
    paint: { 'fill-color': '#c6ddf0', 'fill-opacity': 0.5 },
  })

  // Waterway lines
  customCleanLayers.push({
    id: 'waterway-line',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    paint: { 'line-color': '#b8d4ea', 'line-width': 1.5, 'line-opacity': 0.6 },
  })

  // --- Toggle layers (managed by LayerToggle) ---
  const toggleLayers: LayerSpecification[] = [
    {
      id: 'toggle-buildings-fill',
      type: 'fill',
      source: 'openmaptiles',
      'source-layer': 'building',
      paint: { 'fill-color': '#dddad5', 'fill-opacity': 0.7 },
    },
    {
      id: 'toggle-buildings-outline',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'building',
      paint: { 'line-color': '#b8b3ab', 'line-width': 1 },
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

// Keep the old name as an alias for compatibility (used in exportPng.ts)
export const buildStreetsOnlyStyle = buildMapStyle

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

/**
 * Old compat function — replaced by the mode system but kept for reference.
 * @deprecated Use applyMapMode instead
 */
export function isVectorOverlayLayer(layerId: string): boolean {
  if (layerId === SATELLITE_LAYER || layerId === 'background') return false
  if (isToggleLayer(layerId)) return false
  if (isDynamicLayer(layerId)) return false
  return true
}
