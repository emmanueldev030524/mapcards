import type { StyleSpecification, LayerSpecification } from 'maplibre-gl'

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

const KEEP_SOURCE_LAYERS = new Set([
  'transportation',
  'transportation_name',
  'landuse',
  'water',
  'waterway',
])

export interface ToggleableLayer {
  id: string
  label: string
  color: string
  // Layer IDs on the map that this toggle controls
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

export async function buildStreetsOnlyStyle(): Promise<StyleSpecification> {
  const res = await fetch(OPENFREEMAP_STYLE_URL)
  if (!res.ok) throw new Error(`Failed to fetch OpenFreeMap style: ${res.status}`)
  const baseStyle: StyleSpecification = await res.json()

  const filteredLayers = baseStyle.layers.filter((layer) => {
    if (layer.id === 'background') return true
    const sourceLayer = 'source-layer' in layer ? (layer as Record<string, unknown>)['source-layer'] : null
    if (typeof sourceLayer === 'string' && KEEP_SOURCE_LAYERS.has(sourceLayer)) return true
    return false
  })

  // Warm off-white background
  const bgLayer = filteredLayers.find(l => l.id === 'background')
  if (bgLayer && 'paint' in bgLayer) {
    bgLayer.paint = { 'background-color': '#f8f7f5' }
  }

  // Landuse areas — subtle green tints for parks/fields
  const landuseFill: LayerSpecification = {
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
  }
  filteredLayers.push(landuseFill)

  // Water fill
  const waterFill: LayerSpecification = {
    id: 'water-fill',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'water',
    paint: {
      'fill-color': '#c6ddf0',
      'fill-opacity': 0.5,
    },
  }
  filteredLayers.push(waterFill)

  // Waterway lines (streams, rivers)
  const waterwayLine: LayerSpecification = {
    id: 'waterway-line',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    paint: {
      'line-color': '#b8d4ea',
      'line-width': 1.5,
      'line-opacity': 0.6,
    },
  }
  filteredLayers.push(waterwayLine)

  // Buildings — subtle by default (visible)
  const buildingFill: LayerSpecification = {
    id: 'toggle-buildings-fill',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'building',
    paint: {
      'fill-color': '#e6e4e0',
      'fill-opacity': 0.5,
    },
  }

  const buildingOutline: LayerSpecification = {
    id: 'toggle-buildings-outline',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'building',
    paint: {
      'line-color': '#d4d0ca',
      'line-width': 0.5,
    },
  }

  filteredLayers.push(buildingFill, buildingOutline)

  // Toggleable: House numbers
  const houseNumbers: LayerSpecification = {
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
    paint: {
      'text-color': '#7f8c8d',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  }

  filteredLayers.push(houseNumbers)

  // Toggleable: POI categories
  for (const cat of POI_CATEGORIES) {
    const poiLayer: LayerSpecification = {
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
    }

    const labelLayer: LayerSpecification = {
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
      paint: {
        'text-color': cat.color,
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    }

    filteredLayers.push(poiLayer, labelLayer)
  }

  // Strip terrain/hillshade/sky
  const cleanStyle = { ...baseStyle, layers: filteredLayers }
  delete (cleanStyle as Record<string, unknown>).terrain
  delete (cleanStyle as Record<string, unknown>).hillshade
  delete (cleanStyle as Record<string, unknown>).sky

  return cleanStyle
}
