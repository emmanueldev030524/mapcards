import type maplibregl from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'

interface ExportOptions {
  map: maplibregl.Map
  boundary: Feature<Polygon>
  cardWidthInches: number
  cardHeightInches: number
}

const DPI = 300

export async function exportToPng(options: ExportOptions): Promise<Blob> {
  const { map, cardWidthInches, cardHeightInches } = options

  const totalWidth = Math.round(cardWidthInches * DPI)
  const totalHeight = Math.round(cardHeightInches * DPI)

  // Save original container size
  const container = map.getContainer()
  const origWidth = container.style.width
  const origHeight = container.style.height

  // Resize the live map to match the card dimensions
  container.style.width = `${totalWidth}px`
  container.style.height = `${totalHeight}px`
  map.resize()

  // Fit boundary to fill the card — account for bearing rotation
  const bearing = map.getBearing()
  const centroid = turf.centroid(options.boundary)
  const [cx, cy] = centroid.geometry.coordinates

  // First fit with axis-aligned bbox
  const bbox = turf.bbox(options.boundary) as [number, number, number, number]
  map.fitBounds(bbox, { padding: 0, bearing, animate: false })

  // Now check how much of the viewport the boundary fills and zoom to compensate
  const coords = options.boundary.geometry.coordinates[0]
  const projected = coords.map((c) => map.project(c as [number, number]))
  const minX = Math.min(...projected.map((p) => p.x))
  const maxX = Math.max(...projected.map((p) => p.x))
  const minY = Math.min(...projected.map((p) => p.y))
  const maxY = Math.max(...projected.map((p) => p.y))
  const boundaryW = maxX - minX
  const boundaryH = maxY - minY
  const viewW = totalWidth
  const viewH = totalHeight
  const padding = 120
  const scaleX = (viewW - padding * 2) / boundaryW
  const scaleY = (viewH - padding * 2) / boundaryH
  const fillScale = Math.min(scaleX, scaleY)
  const zoomAdjust = Math.log2(fillScale)

  map.jumpTo({
    center: [cx, cy],
    zoom: map.getZoom() + zoomAdjust,
    bearing,
    animate: false,
  } as maplibregl.JumpToOptions)

  // Wait for tiles and layers to render at new size
  await new Promise<void>((resolve) => {
    let resolved = false
    const done = () => {
      if (resolved) return
      resolved = true
      map.off('idle', done)
      resolve()
    }
    map.on('idle', done)
    setTimeout(done, 4000)
    map.triggerRepaint()
  })

  // Capture the canvas — now sized to the card, with everything exactly as on screen
  const mapCanvas = map.getCanvas()
  const output = document.createElement('canvas')
  output.width = totalWidth
  output.height = totalHeight
  const ctx = output.getContext('2d')!
  ctx.drawImage(mapCanvas, 0, 0, totalWidth, totalHeight)

  // Restore original size
  container.style.width = origWidth
  container.style.height = origHeight
  map.resize()

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
}
