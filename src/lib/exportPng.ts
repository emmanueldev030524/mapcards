import maplibregl from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import type { FeatureWithMeta } from '../types/project'
import type { LineString, Point } from 'geojson'
import { buildMapStyle, SATELLITE_LAYER, isBaseStreetLayer, isCleanOnlyLayer } from './mapStyle'

interface ExportOptions {
  boundary: Feature<Polygon>
  customRoads: FeatureWithMeta<LineString>[]
  housePoints: FeatureWithMeta<Point>[]
  territoryName: string
  territoryNumber: string
  cardWidthInches: number
  cardHeightInches: number
}

const DPI = 300
const HEADER_RATIO = 0.10
const LEGEND_RATIO = 0.08

export async function exportToPng(options: ExportOptions): Promise<Blob> {
  const {
    boundary,
    customRoads,
    housePoints,
    territoryName,
    territoryNumber,
    cardWidthInches,
    cardHeightInches,
  } = options

  const totalWidth = Math.round(cardWidthInches * DPI)
  const totalHeight = Math.round(cardHeightInches * DPI)
  const headerHeight = Math.round(totalHeight * HEADER_RATIO)
  const legendHeight = Math.round(totalHeight * LEGEND_RATIO)
  const mapHeight = totalHeight - headerHeight - legendHeight

  // Get boundary bbox for fitting
  const bbox = turf.bbox(boundary) as [number, number, number, number]

  // Create offscreen container
  const container = document.createElement('div')
  container.style.width = `${totalWidth}px`
  container.style.height = `${mapHeight}px`
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  document.body.appendChild(container)

  try {
    const style = await buildMapStyle()

    // Force clean vector view for export (hide satellite + street layers, show clean layers)
    for (const layer of style.layers) {
      const setVis = (v: string) => {
        if ('layout' in layer && layer.layout) {
          layer.layout = { ...layer.layout, visibility: v as 'visible' | 'none' }
        } else {
          (layer as Record<string, unknown>).layout = { visibility: v }
        }
      }
      if (layer.id === SATELLITE_LAYER) {
        setVis('none')
      } else if (layer.id === 'background') {
        setVis('visible')
      } else if (isBaseStreetLayer(layer.id)) {
        // Use street layers in export for road detail
        setVis('visible')
      } else if (isCleanOnlyLayer(layer.id)) {
        setVis('visible')
      }
    }

    const map = new maplibregl.Map({
      container,
      style,
      bounds: bbox,
      fitBoundsOptions: { padding: 40 },
      interactive: false,
      attributionControl: false,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true },
    } as maplibregl.MapOptions)

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Map render timed out')), 30000)
      map.on('idle', () => {
        clearTimeout(timeout)

        // Add custom roads to offscreen map
        if (customRoads.length > 0) {
          map.addSource('export-roads', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: customRoads },
          })
          map.addLayer({
            id: 'export-roads-casing',
            type: 'line',
            source: 'export-roads',
            paint: { 'line-color': '#b8b8b8', 'line-width': 5 },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          })
          map.addLayer({
            id: 'export-roads-fill',
            type: 'line',
            source: 'export-roads',
            paint: { 'line-color': '#ffffff', 'line-width': 3 },
            layout: { 'line-cap': 'round', 'line-join': 'round' },
          })
        }

        // Add house points to offscreen map
        if (housePoints.length > 0) {
          map.addSource('export-houses', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: housePoints },
          })
          map.addLayer({
            id: 'export-houses',
            type: 'circle',
            source: 'export-houses',
            paint: {
              'circle-radius': 5,
              'circle-color': '#4a6da7',
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
            },
          })
        }

        // Wait one more frame for layers to render
        map.once('idle', () => resolve())
        map.triggerRepaint()
      })
    })

    // Get map canvas
    const mapCanvas = map.getCanvas()

    // Create output canvas
    const output = document.createElement('canvas')
    output.width = totalWidth
    output.height = totalHeight
    const ctx = output.getContext('2d')!

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalWidth, totalHeight)

    // Draw header
    ctx.fillStyle = '#4a6da7'
    ctx.fillRect(0, 0, totalWidth, headerHeight)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(headerHeight * 0.45)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const headerText = territoryNumber
      ? `Territory ${territoryNumber} — ${territoryName}`
      : territoryName || 'Territory Map'
    ctx.fillText(headerText, totalWidth / 2, headerHeight / 2)

    // Draw map with boundary clip
    ctx.save()
    ctx.translate(0, headerHeight)

    // Create clip path from boundary polygon
    const coords = boundary.geometry.coordinates[0]
    ctx.beginPath()
    for (let i = 0; i < coords.length; i++) {
      const point = map.project(coords[i] as [number, number])
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
    ctx.clip()

    // Draw the map canvas
    ctx.drawImage(mapCanvas, 0, 0, totalWidth, mapHeight)
    ctx.restore()

    // Draw boundary outline on top
    ctx.save()
    ctx.translate(0, headerHeight)
    ctx.beginPath()
    for (let i = 0; i < coords.length; i++) {
      const point = map.project(coords[i] as [number, number])
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
    ctx.strokeStyle = '#4a6da7'
    ctx.lineWidth = 3
    ctx.setLineDash([10, 5])
    ctx.stroke()
    ctx.restore()

    // Draw legend
    const legendY = headerHeight + mapHeight
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, legendY, totalWidth, legendHeight)
    ctx.fillStyle = '#666666'
    ctx.font = `${Math.round(legendHeight * 0.4)}px system-ui, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    const legendText = `Houses: ${housePoints.length}  |  Roads: ${customRoads.length}`
    ctx.fillText(legendText, 20, legendY + legendHeight / 2)

    // Cleanup
    map.remove()

    return new Promise<Blob>((resolve, reject) => {
      output.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Failed to create PNG blob'))
        },
        'image/png',
        1.0,
      )
    })
  } finally {
    document.body.removeChild(container)
  }
}
