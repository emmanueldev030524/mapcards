import type maplibregl from 'maplibre-gl'
import { bbox as turfBbox } from '@turf/bbox'
import type { Feature, Point, Polygon } from 'geojson'
import { BRAND } from './colors'
import { useStore } from '../store'
import { generateStartMarkerSVG } from './mapPins'
import { resolveHouseIconSize, resolveTreeIconSize } from './mapMarkerSizing'
import {
  buildStartMarkerIconSizeExpression,
  getStartMarkerExportGapPx,
  getStartMarkerRenderedHeightPx,
} from './startMarkerLayout'

export interface ExportOptions {
  map: maplibregl.Map
  boundary: Feature<Polygon>
  cardWidthInches: number
  cardHeightInches: number
}

const DPI = 300
const HOUSE_LAYER = 'house-icons'
const BADGE_LAYER = 'house-badge-icons'
const TREE_LAYER = 'tree-icons'
const START_MARKER_LAYER = 'start-marker-pin'
const START_MARKER_LABEL_LAYER = 'start-marker-label'
const BOUNDARY_FILL = 'territory-boundary-fill'
const MASK_LAYER = 'territory-mask-fill'

interface ExportVisualSnapshot {
  houseIconSize: number
  badgeIconSize: number
  treeSymbolIconSize: number
  treeCircleRadius: number
  startMarkerSize: number
  boundaryOpacity: number
  maskOpacity: number
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

function syncCurrentVisualState(map: maplibregl.Map, visualSnapshot: ExportVisualSnapshot) {
  try {
    map.setLayoutProperty(HOUSE_LAYER, 'icon-size', visualSnapshot.houseIconSize)
  } catch { void 0 }

  try { map.setLayoutProperty(BADGE_LAYER, 'icon-size', visualSnapshot.badgeIconSize) } catch { void 0 }
  try {
    const treeLayer = map.getLayer(TREE_LAYER) as { type?: string } | undefined
    if (treeLayer?.type === 'symbol') {
      map.setLayoutProperty(TREE_LAYER, 'icon-size', visualSnapshot.treeSymbolIconSize)
    } else {
      map.setPaintProperty(TREE_LAYER, 'circle-radius', visualSnapshot.treeCircleRadius)
    }
  } catch { void 0 }
  try {
    const startLayer = map.getLayer(START_MARKER_LAYER) as { type?: string } | undefined
    if (startLayer?.type === 'symbol') {
      map.setLayoutProperty(START_MARKER_LAYER, 'icon-size', buildStartMarkerIconSizeExpression(visualSnapshot.startMarkerSize))
    } else {
      map.setPaintProperty(START_MARKER_LAYER, 'circle-radius', [
        'interpolate', ['linear'], ['zoom'],
        13, 6 * visualSnapshot.startMarkerSize,
        16, 8.5 * visualSnapshot.startMarkerSize,
        19, 10.5 * visualSnapshot.startMarkerSize,
      ])
    }
  } catch { void 0 }
  try { map.setPaintProperty(BOUNDARY_FILL, 'fill-opacity', visualSnapshot.boundaryOpacity) } catch { void 0 }
  try { map.setPaintProperty(MASK_LAYER, 'fill-opacity', visualSnapshot.maskOpacity) } catch { void 0 }

  map.triggerRepaint()
}

function captureExportVisualSnapshot(map: maplibregl.Map): ExportVisualSnapshot {
  const {
    houseIconSize,
    badgeIconSize,
    treeIconSize,
    startMarkerSize,
    boundaryOpacity,
    maskOpacity,
  } = useStore.getState()
  const liveZoom = map.getZoom()

  return {
    houseIconSize: resolveHouseIconSize(liveZoom, houseIconSize),
    badgeIconSize,
    treeSymbolIconSize: resolveTreeIconSize(liveZoom, treeIconSize),
    treeCircleRadius: 6 * treeIconSize,
    startMarkerSize,
    boundaryOpacity,
    maskOpacity,
  }
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

function loadImage(src: string, width: number, height: number): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(width, height)
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// ── Responsive print layout metrics ─────────────────────────────────
// Export used to assume one fixed card size (effectively 5x3 @ 300 DPI).
// These metrics scale from the actual card dimensions so smaller cards
// compress margins/legend typography while larger cards breathe a bit more.

const LEGEND_LABEL_COLOR = '#1F2937'
const LEGEND_EXAMPLE_COLOR = '#9CA3AF'      // slate-400 — ghost placeholder
const LEGEND_LINE_COLOR = '#475569'         // slate-600 — write-in stroke
const LEGEND_RV_COLOR = '#2ecc71'           // green — former RV status hue
const LEGEND_BS_COLOR = BRAND               // brand blue — former BS status hue

interface ExportLayoutMetrics {
  sidePad: number
  topPad: number
  bottomPad: number
  mapLegendGap: number
  legendHeight: number
  legendSidePad: number
  legendInterEntryGap: number
  legendEntryMinWidth: number
  legendLabelFont: string
  legendExampleFont: string
  legendSymbolSize: number
  legendSymbolGap: number
  legendLabelGap: number
  legendLineYOffset: number
  legendDividerWidth: number
  cornerRadius: number
  borderInset: number
  typographyScale: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function computeExportLayout(totalWidth: number, totalHeight: number): ExportLayoutMetrics {
  const sizeScale = clamp(Math.min(totalWidth / 1500, totalHeight / 900), 0.72, 1.45)

  const legendLabelFontSize = Math.round(clamp(24 * sizeScale, 18, 31))
  const legendExampleFontSize = Math.round(clamp(18 * sizeScale, 13, 23))

  return {
    sidePad: Math.round(clamp(totalWidth * 0.012, 12, 28)),
    topPad: Math.round(clamp(totalHeight * 0.018, 12, 24)),
    bottomPad: Math.round(clamp(totalHeight * 0.008, 6, 12)),
    mapLegendGap: Math.round(clamp(totalHeight * 0.009, 6, 12)),
    legendHeight: Math.round(clamp(totalHeight * 0.104, 74, 126)),
    legendSidePad: Math.round(clamp(totalWidth * 0.025, 24, 48)),
    legendInterEntryGap: Math.round(clamp(totalWidth * 0.016, 16, 32)),
    legendEntryMinWidth: Math.round(clamp(180 * sizeScale, 140, 240)),
    legendLabelFont: `700 ${legendLabelFontSize}px "Inter", system-ui, sans-serif`,
    legendExampleFont: `500 ${legendExampleFontSize}px "Inter", system-ui, sans-serif`,
    legendSymbolSize: Math.round(clamp(22 * sizeScale, 16, 29)),
    legendSymbolGap: Math.round(clamp(10 * sizeScale, 8, 14)),
    legendLabelGap: Math.round(clamp(12 * sizeScale, 8, 16)),
    legendLineYOffset: Math.round(clamp(14 * sizeScale, 10, 18)),
    legendDividerWidth: clamp(1.5 * sizeScale, 1.1, 2),
    cornerRadius: Math.round(clamp(24 * sizeScale, 18, 34)),
    borderInset: Math.round(clamp(3 * sizeScale, 2, 4)),
    typographyScale: clamp(sizeScale, 0.82, 1.2),
  }
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

/**
 * Draw the fixed annotation legend bar at the bottom of the card.
 * Layout (one row): [● RV: (e.g....) ___] [■ BS: (e.g....) ___]
 *
 * Two fixed entries split the full bar width evenly. Example text in
 * light gray precedes each write-in line as a prefix guide.
 */
function drawLegendBar(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  layout: ExportLayoutMetrics,
) {
  const { legendHeight: barHeight, legendSidePad: px, cornerRadius } = layout
  const barY = canvasHeight - barHeight
  const centerY = barY + barHeight / 2

  // Frosted glass legend bar — clip to bottom rounded corners so the fill
  // doesn't bleed past the card edge.
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

  ctx.fillStyle = 'rgba(250, 248, 245, 0.92)'
  ctx.fillRect(0, barY, canvasWidth, barHeight)

  // Top divider
  ctx.strokeStyle = '#E0DCD6'
  ctx.lineWidth = layout.legendDividerWidth
  ctx.beginPath()
  ctx.moveTo(px, barY)
  ctx.lineTo(canvasWidth - px, barY)
  ctx.stroke()

  ctx.restore()

  // ── Annotation legend (fills full bar width) ──────────────────────
  // Two fixed entries, split bar horizontal space evenly.
  const interEntryGap = layout.legendInterEntryGap
  const totalEntryWidth = canvasWidth - px * 2
  const entryWidth = Math.max(layout.legendEntryMinWidth, (totalEntryWidth - interEntryGap) / 2)
  const legendStartX = px

  const entries: Array<{
    symbol: 'circle' | 'square'
    color: string
    label: string
    example: string
  }> = [
    { symbol: 'circle', color: LEGEND_RV_COLOR, label: 'RV:', example: '(e.g. H1, H24, H7)' },
    { symbol: 'square', color: LEGEND_BS_COLOR, label: 'BS:', example: '(e.g. H3, H5, H37)' },
  ]

  entries.forEach((entry, i) => {
    const entryX = legendStartX + i * (entryWidth + interEntryGap)
    drawAnnotationEntry(ctx, entryX, centerY, entryWidth, entry, layout)
  })
}

/**
 * Draw one annotation entry: symbol + label + write-in line with ghost example.
 * The caller is responsible for horizontal layout (entryX/entryWidth).
 */
function drawAnnotationEntry(
  ctx: CanvasRenderingContext2D,
  entryX: number,
  centerY: number,
  entryWidth: number,
  entry: { symbol: 'circle' | 'square'; color: string; label: string; example: string },
  layout: ExportLayoutMetrics,
) {
  const symbolSize = layout.legendSymbolSize
  const symbolGap = layout.legendSymbolGap
  const labelGap = layout.legendLabelGap

  // Symbol — outlined for print clarity with a filled core
  if (entry.symbol === 'circle') {
    const r = symbolSize / 2
    const cx = entryX + r
    ctx.beginPath()
    ctx.arc(cx, centerY, r, 0, Math.PI * 2)
    ctx.fillStyle = entry.color
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1.2
    ctx.stroke()
  } else {
    const s = symbolSize
    const sx = entryX
    const sy = centerY - s / 2
    roundRect(ctx, sx, sy, s, s, 3)
    ctx.fillStyle = entry.color
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'
    ctx.lineWidth = 1.2
    ctx.stroke()
  }

  // Label ("RV:" or "BS:")
  ctx.font = layout.legendLabelFont
  ctx.fillStyle = LEGEND_LABEL_COLOR
  ctx.textBaseline = 'middle'
  const labelX = entryX + symbolSize + symbolGap
  ctx.fillText(entry.label, labelX, centerY)
  const labelWidth = ctx.measureText(entry.label).width

  // Example text — sits between label and line, in light gray
  ctx.font = layout.legendExampleFont
  ctx.fillStyle = LEGEND_EXAMPLE_COLOR
  ctx.textBaseline = 'middle'
  const exampleX = labelX + labelWidth + labelGap
  ctx.fillText(entry.example, exampleX, centerY)
  const exampleWidth = ctx.measureText(entry.example).width

  // Write-in line — starts after the example and extends to the end of the slot
  const lineStartX = exampleX + exampleWidth + labelGap
  const lineEndX = entryX + entryWidth
  const lineY = centerY + layout.legendLineYOffset
  ctx.strokeStyle = LEGEND_LINE_COLOR
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.moveTo(lineStartX, lineY)
  ctx.lineTo(lineEndX, lineY)
  ctx.stroke()
}

function drawStartMarkerLabel(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  startMarker: Feature<Point>,
  startMarkerSize: number,
  layout: ExportLayoutMetrics,
) {
  const [lng, lat] = startMarker.geometry.coordinates
  const point = map.project([lng, lat])
  const label = 'Start Here'
  const scale = Math.max(0.82, Math.min(1.25, startMarkerSize * layout.typographyScale))
  const fontSize = Math.round(22 * scale)
  const padX = Math.round(14 * scale)
  const padY = Math.round(9 * scale)
  const radius = Math.round(15 * scale)
  const zoom = map.getZoom()

  ctx.save()
  ctx.font = `700 ${fontSize}px "Inter", system-ui, sans-serif`
  const textWidth = ctx.measureText(label).width
  const boxWidth = textWidth + padX * 2 + Math.round(14 * scale)
  const boxHeight = fontSize + padY * 2

  // Anchor from the marker's actual rendered height at the current export zoom
  // so the pill remains visually attached as the marker scales.
  const renderedMarkerHeight = getStartMarkerRenderedHeightPx(zoom, startMarkerSize)
  const gapAbovePin = getStartMarkerExportGapPx(zoom, startMarkerSize)
  const boxX = Math.round(point.x - boxWidth / 2)
  const boxY = Math.round(point.y - renderedMarkerHeight - gapAbovePin - boxHeight)

  ctx.shadowColor = 'rgba(15, 23, 42, 0.12)'
  ctx.shadowBlur = 12
  ctx.shadowOffsetY = 4
  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius)
  ctx.fillStyle = 'rgba(255, 252, 247, 0.97)'
  ctx.fill()
  ctx.shadowColor = 'transparent'

  roundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius)
  ctx.strokeStyle = 'rgba(199, 157, 70, 0.42)'
  ctx.lineWidth = 1.6
  ctx.stroke()

  ctx.fillStyle = '#9a6700'
  ctx.beginPath()
  ctx.arc(boxX + padX, boxY + boxHeight / 2, 4.2 * scale, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#14532d'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, boxX + padX + Math.round(11 * scale), boxY + boxHeight / 2)
  ctx.restore()
}

async function drawStartMarkerPin(
  ctx: CanvasRenderingContext2D,
  map: maplibregl.Map,
  startMarker: Feature<Point>,
  startMarkerSize: number,
) {
  const [lng, lat] = startMarker.geometry.coordinates
  const point = map.project([lng, lat])
  const markerHeight = getStartMarkerRenderedHeightPx(map.getZoom(), startMarkerSize)
  const markerWidth = markerHeight * (40 / 48)
  const img = await loadImage(generateStartMarkerSVG(), Math.round(markerWidth), Math.round(markerHeight))
  ctx.drawImage(
    img,
    Math.round(point.x - markerWidth / 2),
    Math.round(point.y - markerHeight),
    Math.round(markerWidth),
    Math.round(markerHeight),
  )
}

export async function exportToPng(options: ExportOptions): Promise<Blob> {
  const { map, boundary, cardWidthInches, cardHeightInches } = options

  const totalWidth = Math.round(cardWidthInches * DPI)
  const totalHeight = Math.round(cardHeightInches * DPI)
  const layout = computeExportLayout(totalWidth, totalHeight)
  const visualSnapshot = captureExportVisualSnapshot(map)

  // Save original map state so we can restore after capture
  const container = map.getContainer()
  const origWidth = container.style.width
  const origHeight = container.style.height
  const origCenter = map.getCenter()
  const origZoom = map.getZoom()
  const origBearing = map.getBearing()
  const startMarkerVisibility = map.getLayer(START_MARKER_LAYER)
    ? (map.getLayoutProperty(START_MARKER_LAYER, 'visibility') as 'visible' | 'none' | undefined)
    : undefined
  const startLabelVisibility = map.getLayer(START_MARKER_LABEL_LAYER)
    ? (map.getLayoutProperty(START_MARKER_LABEL_LAYER, 'visibility') as 'visible' | 'none' | undefined)
    : undefined

  // Use the user's current bearing exactly
  const exportBearing = map.getBearing()

  // All map mutations are wrapped in try/finally so the working canvas
  // is always restored — even if an await or canvas step throws.
  try {
    if (map.getLayer(START_MARKER_LAYER)) {
      map.setLayoutProperty(START_MARKER_LAYER, 'visibility', 'none')
    }
    if (map.getLayer(START_MARKER_LABEL_LAYER)) {
      map.setLayoutProperty(START_MARKER_LABEL_LAYER, 'visibility', 'none')
    }

    // Export can start immediately after a slider change, before MapLibre has
    // fully painted the latest layout mutation. Force the current visual state
    // onto the map and wait a frame so capture matches the on-screen preview.
    syncCurrentVisualState(map, visualSnapshot)
    await nextFrame()
    await waitForIdle(map, 500)

    // Resize map container to card pixel dimensions
    container.style.width = `${totalWidth}px`
    container.style.height = `${totalHeight}px`
    map.resize()
    syncCurrentVisualState(map, visualSnapshot)
    await waitForIdle(map, 2000)

    // Legend bar is a fixed-height annotation template
    const bbox = turfBbox(boundary) as [number, number, number, number]
    const legendHeight = layout.legendHeight
    const horizontalPad = layout.sidePad
    const topPad = layout.topPad
    const bottomReserved = legendHeight + layout.mapLegendGap + layout.bottomPad

    map.fitBounds(bbox, {
      padding: {
        top: topPad,
        right: horizontalPad,
        bottom: bottomReserved,
        left: horizontalPad,
      },
      bearing: exportBearing,
      animate: false,
    })
    syncCurrentVisualState(map, visualSnapshot)
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
      const availableWidth = totalWidth - horizontalPad * 2
      const availableHeight = totalHeight - topPad - bottomReserved
      const scaleX = availableWidth / bw
      const scaleY = availableHeight / bh
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
      syncCurrentVisualState(map, visualSnapshot)

      // After zoom change, the boundary may have shifted — re-center in the map area above legend
      await waitForIdle(map, 2000)
      const reproject = coords.map((c) => map.project(c as [number, number]))
      const boundaryCX = (Math.min(...reproject.map((p) => p.x)) + Math.max(...reproject.map((p) => p.x))) / 2
      const boundaryCY = (Math.min(...reproject.map((p) => p.y)) + Math.max(...reproject.map((p) => p.y))) / 2
      // Center the boundary inside the actual printable map slot rather than
      // the full card, so the map uses the card area much more aggressively.
      const desiredX = horizontalPad + availableWidth / 2
      const desiredY = topPad + availableHeight / 2
      const dx = boundaryCX - desiredX
      const dy = boundaryCY - desiredY

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        // Shift map so boundary center lands at desired position
        const corrected = map.unproject([totalWidth / 2 + dx, totalHeight / 2 + dy])
        map.jumpTo({ center: corrected, animate: false } as maplibregl.JumpToOptions)
        syncCurrentVisualState(map, visualSnapshot)
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

    const cornerRadius = layout.cornerRadius
    const borderInset = layout.borderInset

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

    // --- 5. Legend bar at bottom (fixed annotation template) ---
    if (legendHeight > 0) {
      drawLegendBar(ctx, totalWidth, totalHeight, layout)
    }

    // --- 6. Release rounded-corner clip so the Start Here marker and label can overlap boundary freely ---
    ctx.restore()

    const { startMarker, startMarkerSize } = useStore.getState()
    if (startMarker) {
      await drawStartMarkerPin(ctx, map, startMarker, startMarkerSize)
      drawStartMarkerLabel(ctx, map, startMarker, startMarkerSize, layout)
    }

    // --- 7. Thin hairline border around card ---
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
    if (map.getLayer(START_MARKER_LAYER)) {
      map.setLayoutProperty(START_MARKER_LAYER, 'visibility', startMarkerVisibility ?? 'visible')
    }
    if (map.getLayer(START_MARKER_LABEL_LAYER)) {
      map.setLayoutProperty(START_MARKER_LABEL_LAYER, 'visibility', startLabelVisibility ?? 'visible')
    }
    map.resize()
    syncCurrentVisualState(map, captureExportVisualSnapshot(map))
  }
}
