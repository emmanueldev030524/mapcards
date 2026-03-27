import type maplibregl from 'maplibre-gl'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import type { LegendEntry } from './mapPins'

export interface ExportOptions {
  map: maplibregl.Map
  boundary: Feature<Polygon>
  cardWidthInches: number
  cardHeightInches: number
  territoryNumber?: string
  legendEntries?: LegendEntry[]
}

const DPI = 300

function waitForIdle(map: maplibregl.Map, timeout: number): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false
    const done = () => {
      if (resolved) return
      resolved = true
      map.off('idle', done)
      resolve()
    }
    map.on('idle', done)
    setTimeout(done, timeout)
    map.triggerRepaint()
  })
}

function drawLegendBar(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  territoryNumber?: string,
  entries: LegendEntry[] = [],
) {
  const barHeight = 120
  const barY = canvasHeight - barHeight
  const px = 40 // horizontal padding

  // Semi-transparent white bar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.fillRect(0, barY, canvasWidth, barHeight)

  // Top divider line
  ctx.strokeStyle = '#d1d5db'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, barY)
  ctx.lineTo(canvasWidth, barY)
  ctx.stroke()

  // Territory number title — left side
  let textX = px
  if (territoryNumber) {
    ctx.font = 'bold 48px "Outfit", "Inter", system-ui, sans-serif'
    ctx.fillStyle = '#1f2937'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Territory ${territoryNumber}`, textX, barY + barHeight / 2)
    textX += ctx.measureText(`Territory ${territoryNumber}`).width + 60
  }

  // Legend entries — flow right from the title
  if (entries.length > 0) {
    const dotRadius = 14
    const gap = 32
    const entryFont = '32px "Outfit", "Inter", system-ui, sans-serif'
    ctx.font = entryFont

    for (const entry of entries) {
      // Color dot
      ctx.beginPath()
      ctx.arc(textX + dotRadius, barY + barHeight / 2, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = entry.color
      ctx.fill()

      // Label
      ctx.fillStyle = '#4b5563'
      ctx.font = entryFont
      ctx.textBaseline = 'middle'
      ctx.fillText(entry.label, textX + dotRadius * 2 + 12, barY + barHeight / 2)
      textX += dotRadius * 2 + 12 + ctx.measureText(entry.label).width + gap
    }
  }
}

export async function exportToPng(options: ExportOptions): Promise<Blob> {
  const { map, boundary, cardWidthInches, cardHeightInches } = options

  const totalWidth = Math.round(cardWidthInches * DPI)
  const totalHeight = Math.round(cardHeightInches * DPI)

  // Save original map state so we can restore after capture
  const container = map.getContainer()
  const origWidth = container.style.width
  const origHeight = container.style.height
  const origCenter = map.getCenter()
  const origZoom = map.getZoom()
  const origBearing = map.getBearing()

  // Use the user's current bearing exactly
  const exportBearing = map.getBearing()

  // Resize map container to card pixel dimensions
  container.style.width = `${totalWidth}px`
  container.style.height = `${totalHeight}px`
  map.resize()
  await waitForIdle(map, 2000)

  // Fit boundary into the card with padding — extra bottom padding for legend bar
  const bbox = turf.bbox(boundary) as [number, number, number, number]
  const hasLegend = !!(options.territoryNumber || (options.legendEntries && options.legendEntries.length > 0))
  const legendHeight = hasLegend ? 120 : 0
  const pad = 80

  map.fitBounds(bbox, {
    padding: { top: pad, right: pad, bottom: pad + legendHeight, left: pad },
    bearing: exportBearing,
    animate: false,
  })
  await waitForIdle(map, 2000)

  // Refine: project boundary to screen space and zoom to fill precisely
  const coords = boundary.geometry.coordinates[0]
  const projected = coords.map((c) => map.project(c as [number, number]))
  const minX = Math.min(...projected.map((p) => p.x))
  const maxX = Math.max(...projected.map((p) => p.x))
  const minY = Math.min(...projected.map((p) => p.y))
  const maxY = Math.max(...projected.map((p) => p.y))
  const bw = maxX - minX
  const bh = maxY - minY

  if (bw > 0 && bh > 0) {
    const scaleX = (totalWidth - pad * 2) / bw
    const scaleY = (totalHeight - pad * 2 - legendHeight) / bh
    const fillScale = Math.min(scaleX, scaleY)
    const zoomAdjust = Math.log2(fillScale)

    // Center on the screen-space midpoint of the boundary, not the geographic centroid
    const screenCenterX = (minX + maxX) / 2
    const screenCenterY = (minY + maxY) / 2
    const geoCenter = map.unproject([screenCenterX, screenCenterY])

    map.jumpTo({
      center: geoCenter,
      zoom: map.getZoom() + zoomAdjust,
      bearing: exportBearing,
      animate: false,
    } as maplibregl.JumpToOptions)

    // After zoom change, the boundary may have shifted — re-center in the map area above legend
    await waitForIdle(map, 2000)
    const reproject = coords.map((c) => map.project(c as [number, number]))
    const boundaryCX = (Math.min(...reproject.map((p) => p.x)) + Math.max(...reproject.map((p) => p.x))) / 2
    const boundaryCY = (Math.min(...reproject.map((p) => p.y)) + Math.max(...reproject.map((p) => p.y))) / 2
    // Where we want the boundary center on screen (centered in area above legend)
    const desiredX = totalWidth / 2
    const desiredY = (totalHeight - legendHeight) / 2
    const dx = boundaryCX - desiredX
    const dy = boundaryCY - desiredY

    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      // Shift map so boundary center lands at desired position
      const corrected = map.unproject([totalWidth / 2 + dx, totalHeight / 2 + dy])
      map.jumpTo({ center: corrected, animate: false } as maplibregl.JumpToOptions)
    }
  }

  await waitForIdle(map, 4000)

  // --- Canvas capture with boundary clipping ---
  const mapCanvas = map.getCanvas()
  const output = document.createElement('canvas')
  output.width = totalWidth
  output.height = totalHeight
  const ctx = output.getContext('2d')!

  // White background (everything outside boundary)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  // Project boundary to final screen coordinates
  const finalCoords = coords.map((c) => map.project(c as [number, number]))

  // Clip map rendering to boundary shape
  ctx.save()
  ctx.beginPath()
  finalCoords.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
  ctx.clip()

  // Draw map only inside boundary
  ctx.drawImage(mapCanvas, 0, 0, totalWidth, totalHeight)
  ctx.restore()

  // Draw boundary stroke on top (outside the clip so it's fully visible)
  ctx.beginPath()
  finalCoords.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.closePath()
  ctx.strokeStyle = '#4B6CA7'
  ctx.lineWidth = 10
  ctx.lineJoin = 'round'
  ctx.stroke()

  // --- Draw legend bar at bottom ---
  const { territoryNumber, legendEntries } = options
  if (territoryNumber || (legendEntries && legendEntries.length > 0)) {
    drawLegendBar(ctx, totalWidth, totalHeight, territoryNumber, legendEntries || [])
  }

  // Restore original map state
  container.style.width = origWidth
  container.style.height = origHeight
  map.jumpTo({
    center: origCenter,
    zoom: origZoom,
    bearing: origBearing,
    animate: false,
  } as maplibregl.JumpToOptions)
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
