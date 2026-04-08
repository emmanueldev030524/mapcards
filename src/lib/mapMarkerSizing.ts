import type { ExpressionSpecification } from 'maplibre-gl'

const HOUSE_ICON_STOPS = [
  [13, 0.35],
  [16, 0.55],
  [19, 0.7],
] as const

const TREE_ICON_STOPS = [
  [13, 0.4],
  [16, 0.7],
  [19, 0.9],
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

export function buildHouseIconSizeExpression(houseIconSize = 1): ExpressionSpecification {
  return buildZoomExpression(HOUSE_ICON_STOPS.map(([zoom, value]) => [zoom, value * houseIconSize] as const))
}

export function resolveHouseIconSize(zoom: number, houseIconSize = 1): number {
  return interpolateStops(zoom, HOUSE_ICON_STOPS) * houseIconSize
}

export function buildTreeIconSizeExpression(treeIconSize = 1): ExpressionSpecification {
  return buildZoomExpression(TREE_ICON_STOPS.map(([zoom, value]) => [zoom, value * treeIconSize] as const))
}

export function resolveTreeIconSize(zoom: number, treeIconSize = 1): number {
  return interpolateStops(zoom, TREE_ICON_STOPS) * treeIconSize
}
