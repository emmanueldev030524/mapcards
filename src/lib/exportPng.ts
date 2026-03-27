import maplibregl from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import type { FeatureWithMeta } from '../types/project'
import type { LineString, Point } from 'geojson'
import { buildMapStyle, SATELLITE_LAYER, isBaseStreetLayer, isCleanOnlyLayer } from './mapStyle'
import { ensureHouseIcons, resolveHouseIcon, collectLegend } from './mapPins'

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
const LEGEND_RATIO = 0.12 // increased for color legend

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

  const bbox = turf.bbox(boundary) as [number, number, number, number]

  const container = document.createElement('div')
  container.style.width = `${totalWidth}px`
  container.style.height = `${mapHeight}px`
  container.style.position = 'fixed'
  container.style.left = '-9999px'
  container.style.top = '-9999px'
  document.body.appendChild(container)

  try {
    const style = await buildMapStyle()

    for (const layer of style.layers) {
      const setVis = (v: string) => {
        if ('layout' in layer && layer.layout) {
          layer.layout = { ...layer.layout, visibility: v as 'visible' | 'none' }
        } else {
          (layer as Record<string, unknown>).layout = { visibility: v }
        }
      }
      if (layer.id === SATELLITE_LAYER) setVis('none')
      else if (layer.id === 'background') setVis('visible')
      else if (isBaseStreetLayer(layer.id)) setVis('visible')
      else if (isCleanOnlyLayer(layer.id)) setVis('visible')
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
      map.on('idle', async () => {
        clearTimeout(timeout)

        // Roads
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

        // Houses — dynamic color-coded icons
        if (housePoints.length > 0) {
          await ensureHouseIcons(map, housePoints.map((p) => ({ tags: p.properties.tags || [] })))

          const features = housePoints.map((p, i) => {
            const tags = p.properties.tags || []
            const { key } = resolveHouseIcon(tags)
            return {
              ...p,
              properties: {
                ...p.properties,
                iconImage: key,
                num: String(i + 1),
                label: p.properties.label || '',
              },
            }
          })

          map.addSource('export-houses', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features },
          })
          map.addLayer({
            id: 'export-houses',
            type: 'symbol',
            source: 'export-houses',
            layout: {
              'icon-image': ['get', 'iconImage'],
              'icon-size': 0.6,
              'icon-allow-overlap': true,
              'icon-anchor': 'center',
              'text-field': [
                'format',
                '#', { 'font-scale': 0.7 },
                ['get', 'num'], { 'font-scale': 1.0 },
                ['case', ['!=', ['get', 'label'], ''],
                  ['concat', '\n', ['get', 'label']],
                  '',
                ], { 'font-scale': 0.85 },
              ],
              'text-size': 8,
              'text-anchor': 'top',
              'text-offset': [0, 0.8],
              'text-line-height': 1.3,
              'text-max-width': 8,
              'text-allow-overlap': true,
              'text-padding': 0,
              'text-font': ['Open Sans Semibold', 'Arial Unicode MS Regular'],
            },
            paint: {
              'text-color': '#1e293b',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2,
            },
          })
        }

        map.once('idle', () => resolve())
        map.triggerRepaint()
      })
    })

    const mapCanvas = map.getCanvas()
    const output = document.createElement('canvas')
    output.width = totalWidth
    output.height = totalHeight
    const ctx = output.getContext('2d')!

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalWidth, totalHeight)

    // Header
    ctx.fillStyle = '#39577F'
    ctx.fillRect(0, 0, totalWidth, headerHeight)
    ctx.fillStyle = '#ffffff'
    ctx.font = `bold ${Math.round(headerHeight * 0.45)}px Inter, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const headerText = territoryNumber
      ? `Territory ${territoryNumber} — ${territoryName}`
      : territoryName || 'Territory Map'
    ctx.fillText(headerText, totalWidth / 2, headerHeight / 2)

    // Map with boundary clip
    ctx.save()
    ctx.translate(0, headerHeight)
    const coords = boundary.geometry.coordinates[0]
    ctx.beginPath()
    for (let i = 0; i < coords.length; i++) {
      const point = map.project(coords[i] as [number, number])
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(mapCanvas, 0, 0, totalWidth, mapHeight)
    ctx.restore()

    // Boundary outline
    ctx.save()
    ctx.translate(0, headerHeight)
    ctx.beginPath()
    for (let i = 0; i < coords.length; i++) {
      const point = map.project(coords[i] as [number, number])
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
    ctx.strokeStyle = '#39577F'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.restore()

    // ─── Legend with color coding ───
    const legendY = headerHeight + mapHeight
    ctx.fillStyle = '#f8f9fa'
    ctx.fillRect(0, legendY, totalWidth, legendHeight)

    // Thin top border
    ctx.fillStyle = '#e2e8f0'
    ctx.fillRect(0, legendY, totalWidth, 1)

    const fontSize = Math.round(legendHeight * 0.28)
    const smallFont = Math.round(legendHeight * 0.22)
    const dotSize = Math.round(legendHeight * 0.12)
    let cursorX = 20
    const centerY = legendY + legendHeight / 2

    // House count
    ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`
    ctx.fillStyle = '#1e293b'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${housePoints.length} Houses`, cursorX, centerY - fontSize * 0.6)

    // Road count
    ctx.font = `${smallFont}px Inter, system-ui, sans-serif`
    ctx.fillStyle = '#64748b'
    ctx.fillText(`${customRoads.length} Custom Roads`, cursorX, centerY + fontSize * 0.5)

    // Color legend entries (right-aligned)
    const legend = collectLegend(housePoints.map((p) => ({ tags: p.properties.tags || [] })))

    if (legend.length > 0) {
      ctx.textAlign = 'right'
      let rightX = totalWidth - 20

      for (let i = legend.length - 1; i >= 0; i--) {
        const entry = legend[i]

        // Label
        ctx.font = `${smallFont}px Inter, system-ui, sans-serif`
        ctx.fillStyle = '#334155'
        const labelWidth = ctx.measureText(entry.label).width
        ctx.fillText(entry.label, rightX, centerY)

        // Color dot
        rightX -= labelWidth + dotSize + 6
        ctx.beginPath()
        ctx.arc(rightX + dotSize / 2, centerY, dotSize / 2, 0, Math.PI * 2)
        ctx.fillStyle = entry.color
        ctx.fill()
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1.5
        ctx.stroke()

        rightX -= 16 // gap between entries
      }
    }

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
