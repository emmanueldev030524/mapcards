import type maplibregl from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/bbox'
import type { Feature, Polygon } from 'geojson'
import type { LegendEntry } from './mapPins'
import { useStore } from '../store'

export interface ExportOptions {
  map: maplibregl.Map
  boundary: Feature<Polygon>
  cardWidthInches: number
  cardHeightInches: number
  territoryNumber?: string
  legendEntries?: LegendEntry[]
}

const DPI = 300
const HOUSE_LAYER = 'house-icons'
const BADGE_LAYER = 'house-badge-icons'
const BOUNDARY_FILL = 'territory-boundary-fill'
const MASK_LAYER = 'territory-mask-fill'

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function syncCurrentVisualState(map: maplibregl.Map) {
  const { houseIconSize, badgeIconSize, boundaryOpacity, maskOpacity } = useStore.getState()

  try {
    map.setLayoutProperty(HOUSE_LAYER, 'icon-size', [
      'interpolate', ['linear'], ['zoom'],
      13, 0.35 * houseIconSize,
      16, 0.55 * houseIconSize,
      19, 0.7 * houseIconSize,
    ])
  } catch {}

  try { map.setLayoutProperty(BADGE_LAYER, 'icon-size', badgeIconSize) } catch {}
  try { map.setPaintProperty(BOUNDARY_FILL, 'fill-opacity', boundaryOpacity) } catch {}
  try { map.setPaintProperty(MASK_LAYER, 'fill-opacity', maskOpacity) } catch {}

  map.triggerRepaint()
}

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

/** Measure how tall the legend bar needs to be (supports wrapping to multiple rows) */
function measureLegendHeight(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  territoryNumber?: string,
  entries: LegendEntry[] = [],
): number {
  if (!territoryNumber && entries.length === 0) return 0

  const px = 50
  const rowHeight = 52
  const topPad = 28
  const bottomPad = 24
  const dotRadius = 11
  const gap = 40
  const entryFont = '600 28px "Outfit", "Inter", system-ui, sans-serif'
  const titleFont = 'bold 38px "Outfit", "Inter", system-ui, sans-serif'

  // Measure title width
  let legendStartX = px
  if (territoryNumber) {
    ctx.font = titleFont
    legendStartX += ctx.measureText(`Territory ${territoryNumber}`).width + 50
  }

  // Count rows by simulating layout
  if (entries.length === 0) return topPad + rowHeight + bottomPad

  ctx.font = entryFont
  let rows = 1
  let x = legendStartX

  for (const entry of entries) {
    const entryWidth = dotRadius * 2 + 10 + ctx.measureText(entry.label).width + gap
    if (x + entryWidth > canvasWidth - px && x > legendStartX) {
      rows++
      x = px // wrapped rows start from left edge
    }
    x += entryWidth
  }

  return topPad + rowHeight * rows + bottomPad
}

/** Draw a rounded rectangle path (helper for clipping and stroking) */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function drawLegendBar(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  barHeight: number,
  cornerRadius: number,
  territoryNumber?: string,
  entries: LegendEntry[] = [],
) {
  const barY = canvasHeight - barHeight
  const px = 50
  const rowHeight = 52
  const topPad = 28
  const dotRadius = 11
  const gap = 40
  const entryFont = '600 28px "Outfit", "Inter", system-ui, sans-serif'
  const titleFont = 'bold 38px "Outfit", "Inter", system-ui, sans-serif'

  // Frosted glass legend bar — clip to bottom rounded corners
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(0, barY)
  ctx.lineTo(canvasWidth, barY)
  ctx.lineTo(canvasWidth, canvasHeight - cornerRadius)
  ctx.arcTo(canvasWidth, canvasHeight, canvasWidth - cornerRadius, canvasHeight, cornerRadius)
  ctx.lineTo(cornerRadius, canvasHeight)
  ctx.arcTo(0, canvasHeight, 0, canvasHeight - cornerRadius, cornerRadius)
  ctx.lineTo(0, barY)
  ctx.closePath()
  ctx.clip()

  // Frosted backdrop
  ctx.fillStyle = 'rgba(250, 248, 245, 0.92)'
  ctx.fillRect(0, barY, canvasWidth, barHeight)

  // Top divider — warm subtle line
  ctx.strokeStyle = '#E0DCD6'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(px, barY)
  ctx.lineTo(canvasWidth - px, barY)
  ctx.stroke()

  ctx.restore()

  // Territory title — left side, vertically centered in first row
  const firstRowY = barY + topPad + rowHeight / 2
  let legendStartX = px

  if (territoryNumber) {
    ctx.font = titleFont
    ctx.fillStyle = '#3D4F6B'
    ctx.textBaseline = 'middle'
    ctx.fillText(`Territory ${territoryNumber}`, px, firstRowY)
    legendStartX = px + ctx.measureText(`Territory ${territoryNumber}`).width + 50
  }

  // Legend entries — flow right, wrap to next row if needed
  if (entries.length === 0) return

  ctx.font = entryFont
  let x = legendStartX
  let row = 0

  for (const entry of entries) {
    const labelWidth = ctx.measureText(entry.label).width
    const entryWidth = dotRadius * 2 + 10 + labelWidth + gap

    // Wrap to next row if this entry would overflow
    if (x + entryWidth > canvasWidth - px && x > (row === 0 ? legendStartX : px)) {
      row++
      x = px // wrapped rows start from left edge
    }

    const rowY = barY + topPad + rowHeight * row + rowHeight / 2

    // Color dot with subtle border
    ctx.beginPath()
    ctx.arc(x + dotRadius, rowY, dotRadius, 0, Math.PI * 2)
    ctx.fillStyle = entry.color
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 1
    ctx.stroke()

    // Label
    ctx.fillStyle = '#4B5563'
    ctx.font = entryFont
    ctx.textBaseline = 'middle'
    ctx.fillText(entry.label, x + dotRadius * 2 + 10, rowY)

    x += entryWidth
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

  // All map mutations are wrapped in try/finally so the working canvas
  // is always restored — even if an await or canvas step throws.
  try {
    // Export can start immediately after a slider change, before MapLibre has
    // fully painted the latest layout mutation. Force the current visual state
    // onto the map and wait a frame so capture matches the on-screen preview.
    syncCurrentVisualState(map)
    await nextFrame()
    await waitForIdle(map, 500)

    // Resize map container to card pixel dimensions
    container.style.width = `${totalWidth}px`
    container.style.height = `${totalHeight}px`
    map.resize()
    syncCurrentVisualState(map)
    await waitForIdle(map, 2000)

    // Measure legend bar height dynamically (may wrap to 2+ rows)
    const bbox = turfBbox(boundary) as [number, number, number, number]
    const measureCtx = document.createElement('canvas').getContext('2d')!
    const legendHeight = measureLegendHeight(
      measureCtx, totalWidth,
      options.territoryNumber, options.legendEntries || [],
    )
    const pad = 40

    map.fitBounds(bbox, {
      padding: { top: pad, right: pad, bottom: pad + legendHeight, left: pad },
      bearing: exportBearing,
      animate: false,
    })
    syncCurrentVisualState(map)
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
      syncCurrentVisualState(map)

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
        syncCurrentVisualState(map)
      }
    }

    await waitForIdle(map, 4000)

    // --- Canvas capture with premium card rendering ---
    // Note: The interactive map has preserveDrawingBuffer: true which is required
    // for canvas capture. The performance cost is acceptable for a card-making tool.
    const mapCanvas = map.getCanvas()
    const output = document.createElement('canvas')
    output.width = totalWidth
    output.height = totalHeight
    const ctx = output.getContext('2d')!

    const cornerRadius = Math.round(24 * (DPI / 300)) // ~24px at 300 DPI
    const borderInset = 3

    // --- 1. Cream background with rounded corners ---
    ctx.save()
    roundRect(ctx, 0, 0, totalWidth, totalHeight, cornerRadius)
    ctx.clip()
    ctx.fillStyle = '#FAF8F5'
    ctx.fillRect(0, 0, totalWidth, totalHeight)

    // Project boundary to final screen coordinates
    const finalCoords = coords.map((c) => map.project(c as [number, number]))

    // --- 2. Clip map rendering to boundary shape ---
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

    // --- 3. Floating drop shadow — map area feels lifted off the card ---
    const shadowLayers = [
      { offset: 8, width: 20, opacity: 0.03 },
      { offset: 5, width: 14, opacity: 0.05 },
      { offset: 3, width: 9, opacity: 0.07 },
      { offset: 1.5, width: 5, opacity: 0.10 },
      { offset: 0.5, width: 2, opacity: 0.14 },
    ]
    for (const sl of shadowLayers) {
      ctx.save()
      ctx.beginPath()
      finalCoords.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x + sl.offset, p.y + sl.offset)
        else ctx.lineTo(p.x + sl.offset, p.y + sl.offset)
      })
      ctx.closePath()
      ctx.strokeStyle = `rgba(30, 40, 60, ${sl.opacity})`
      ctx.lineWidth = sl.width
      ctx.lineJoin = 'round'
      ctx.stroke()
      ctx.restore()
    }

    // --- 5. Legend bar at bottom ---
    const { territoryNumber, legendEntries } = options
    if (legendHeight > 0) {
      drawLegendBar(ctx, totalWidth, totalHeight, legendHeight, cornerRadius, territoryNumber, legendEntries || [])
    }

    // --- 6. Thin hairline border around card ---
    ctx.restore() // restore the rounded corner clip
    roundRect(ctx, borderInset, borderInset, totalWidth - borderInset * 2, totalHeight - borderInset * 2, cornerRadius)
    ctx.strokeStyle = '#D5D0C8'
    ctx.lineWidth = 2
    ctx.stroke()

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
    // Always restore the working map, even if export fails
    container.style.width = origWidth
    container.style.height = origHeight
    map.jumpTo({
      center: origCenter,
      zoom: origZoom,
      bearing: origBearing,
      animate: false,
    } as maplibregl.JumpToOptions)
    map.resize()
    syncCurrentVisualState(map)
  }
}
