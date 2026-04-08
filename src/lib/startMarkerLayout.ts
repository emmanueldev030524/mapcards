import type { ExpressionSpecification } from 'maplibre-gl'

const START_MARKER_HEIGHT_PX = 48
const LABEL_CLEARANCE_TEXT_RATIO = 0.8
const EXPORT_GAP_RATIO = 8 / START_MARKER_HEIGHT_PX

const ICON_SIZE_STOPS = [
  [13, 0.72],
  [16, 0.9],
  [19, 1.06],
] as const

const TEXT_SIZE_STOPS = [
  [13, 9],
  [16, 11],
  [19, 13],
] as const

function interpolateStops(
  zoom: number,
  stops: ReadonlyArray<readonly [number, number]>,
): number {
  if (zoom <= stops[0][0]) return stops[0][1]
  if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1]

  for (let i = 1; i < stops.length; i += 1) {
    const [prevZoom, prevValue] = stops[i - 1]
    const [nextZoom, nextValue] = stops[i]
    if (zoom > nextZoom) continue
    const t = (zoom - prevZoom) / (nextZoom - prevZoom)
    return prevValue + (nextValue - prevValue) * t
  }

  return stops[stops.length - 1][1]
}

function buildZoomExpression(
  stops: ReadonlyArray<readonly [number, number]>,
): ExpressionSpecification {
  return [
    'interpolate', ['linear'], ['zoom'],
    ...stops.flatMap(([zoom, value]) => [zoom, value]),
  ] as ExpressionSpecification
}

export function buildStartMarkerIconSizeExpression(startMarkerSize = 1): ExpressionSpecification {
  return buildZoomExpression(ICON_SIZE_STOPS.map(([zoom, value]) => [zoom, value * startMarkerSize] as const))
}

export function buildStartMarkerTextSizeExpression(): ExpressionSpecification {
  return buildZoomExpression(TEXT_SIZE_STOPS)
}

export function getStartMarkerRenderedHeightPx(zoom: number, startMarkerSize: number): number {
  return START_MARKER_HEIGHT_PX * interpolateStops(zoom, ICON_SIZE_STOPS) * startMarkerSize
}

export function getStartMarkerTextSizePx(zoom: number): number {
  return interpolateStops(zoom, TEXT_SIZE_STOPS)
}

export function getStartMarkerLabelOffsetEm(zoom: number, startMarkerSize: number): number {
  const textSizePx = getStartMarkerTextSizePx(zoom)
  return -((getStartMarkerRenderedHeightPx(zoom, startMarkerSize) - textSizePx * LABEL_CLEARANCE_TEXT_RATIO) / textSizePx)
}

export function getStartMarkerExportGapPx(zoom: number, startMarkerSize: number): number {
  return Math.max(6, Math.round(getStartMarkerRenderedHeightPx(zoom, startMarkerSize) * EXPORT_GAP_RATIO))
}
