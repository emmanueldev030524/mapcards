import { length as turfLength } from '@turf/length'
import { along } from '@turf/along'
import type { Feature, LineString } from 'geojson'

export function distributeHousesAlongLine(
  line: Feature<LineString>,
  count: number,
): Array<{ lng: number; lat: number }> {
  if (count <= 0) return []

  const lineLength = turfLength(line, { units: 'meters' })
  if (lineLength === 0) return []

  const points: Array<{ lng: number; lat: number }> = []

  if (count === 1) {
    const midpoint = along(line, lineLength / 2, { units: 'meters' })
    const [lng, lat] = midpoint.geometry.coordinates
    points.push({ lng, lat })
  } else {
    const spacing = lineLength / (count - 1)
    for (let i = 0; i < count; i++) {
      const distance = spacing * i
      const point = along(line, distance, { units: 'meters' })
      const [lng, lat] = point.geometry.coordinates
      points.push({ lng, lat })
    }
  }

  return points
}
