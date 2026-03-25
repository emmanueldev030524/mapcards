import type { Feature, Point, Polygon, LineString, GeoJsonProperties } from 'geojson'

// Approximate meters-to-degrees conversion at a given latitude
function metersToDegreesLng(meters: number, lat: number): number {
  return meters / (111_320 * Math.cos((lat * Math.PI) / 180))
}

function metersToDegreesLat(meters: number): number {
  return meters / 110_574
}

/** Snap a coordinate to the center of the nearest grid cell */
export function snapToGrid(
  lng: number,
  lat: number,
  spacingMeters: number,
): [number, number] {
  const dLng = metersToDegreesLng(spacingMeters, lat)
  const dLat = metersToDegreesLat(spacingMeters)

  // floor to get the cell's bottom-left corner, then add half to reach center
  const snappedLng = Math.floor(lng / dLng) * dLng + dLng / 2
  const snappedLat = Math.floor(lat / dLat) * dLat + dLat / 2

  return [snappedLng, snappedLat]
}

function getBbox(boundary: Feature<Polygon>) {
  const coords = boundary.geometry.coordinates[0]
  let minLng = Infinity, maxLng = -Infinity
  let minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
  }
  return { minLng, maxLng, minLat, maxLat }
}

/** Generate grid lines (horizontal + vertical) clipped to the boundary bbox */
export function generateGridLines(
  boundary: Feature<Polygon>,
  spacingMeters: number,
): Feature<LineString, GeoJsonProperties>[] {
  const { minLng, maxLng, minLat, maxLat } = getBbox(boundary)
  const centerLat = (minLat + maxLat) / 2
  const dLng = metersToDegreesLng(spacingMeters, centerLat)
  const dLat = metersToDegreesLat(spacingMeters)

  const startLng = Math.floor(minLng / dLng) * dLng
  const startLat = Math.floor(minLat / dLat) * dLat

  const lines: Feature<LineString, GeoJsonProperties>[] = []

  // Vertical lines (constant longitude)
  for (let lng = startLng; lng <= maxLng + dLng; lng += dLng) {
    lines.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[lng, minLat - dLat], [lng, maxLat + dLat]],
      },
      properties: {},
    })
  }

  // Horizontal lines (constant latitude)
  for (let lat = startLat; lat <= maxLat + dLat; lat += dLat) {
    lines.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[minLng - dLng, lat], [maxLng + dLng, lat]],
      },
      properties: {},
    })
  }

  return lines
}

/** Generate grid intersection dots within the boundary */
export function generateGridPoints(
  boundary: Feature<Polygon>,
  spacingMeters: number,
): Feature<Point>[] {
  const { minLng, maxLng, minLat, maxLat } = getBbox(boundary)
  const centerLat = (minLat + maxLat) / 2
  const dLng = metersToDegreesLng(spacingMeters, centerLat)
  const dLat = metersToDegreesLat(spacingMeters)

  const startLng = Math.floor(minLng / dLng) * dLng
  const startLat = Math.floor(minLat / dLat) * dLat
  const coords = boundary.geometry.coordinates[0] as [number, number][]

  const points: Feature<Point>[] = []

  for (let lng = startLng; lng <= maxLng; lng += dLng) {
    for (let lat = startLat; lat <= maxLat; lat += dLat) {
      if (isPointInPolygon(lng, lat, coords)) {
        points.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: {},
        })
      }
    }
  }

  return points
}

/** Simple ray-casting point-in-polygon test */
function isPointInPolygon(
  x: number,
  y: number,
  polygon: [number, number][],
): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi

    if (intersect) inside = !inside
  }
  return inside
}
