import type { Feature, Polygon, LineString, Point, Geometry } from 'geojson'

export type DrawMode = 'boundary' | 'road' | 'house' | 'tree' | 'bulkFill' | 'select' | 'startMarker' | null

export type HouseTag = string

export interface FeatureWithMeta<G extends Geometry> extends Feature<G> {
  id: string
  properties: {
    label?: string
    tags?: HouseTag[]
    createdAt: string
  }
}

export interface ProjectData {
  version: 1
  id: string
  createdAt: string
  updatedAt: string
  projectName?: string
  territoryName: string
  territoryNumber: string
  cardWidthInches: number
  cardHeightInches: number
  mapCenter: [number, number]
  mapZoom: number
  boundary: Feature<Polygon> | null
  customRoads: FeatureWithMeta<LineString>[]
  housePoints: FeatureWithMeta<Point>[]
  treePoints?: FeatureWithMeta<Point>[]
  startMarker?: Feature<Point> | null
  customStatuses?: Array<{ id: string; label: string; color: string }>
}

export const DEFAULT_PROJECT: Omit<ProjectData, 'id' | 'createdAt' | 'updatedAt'> = {
  version: 1,
  projectName: '',
  territoryName: '',
  territoryNumber: '',
  cardWidthInches: 5,
  cardHeightInches: 3,
  mapCenter: [124.955, 8.333],
  mapZoom: 16,
  boundary: null,
  customRoads: [],
  housePoints: [],
}
