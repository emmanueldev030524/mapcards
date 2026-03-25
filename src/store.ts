import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Feature, Polygon, LineString, Point } from 'geojson'
import type { DrawMode, FeatureWithMeta, ProjectData } from './types/project'
import { DEFAULT_PROJECT } from './types/project'

interface MapCardsStore {
  // Project data
  projectId: string
  territoryName: string
  territoryNumber: string
  cardWidthInches: number
  cardHeightInches: number
  mapCenter: [number, number]
  mapZoom: number
  boundary: Feature<Polygon> | null
  customRoads: FeatureWithMeta<LineString>[]
  housePoints: FeatureWithMeta<Point>[]

  // UI state (not persisted)
  activeDrawMode: DrawMode
  visibleLayers: Record<string, boolean>
  boundaryOpacity: number
  houseIconSize: number
  badgeIconSize: number
  snapToGrid: boolean
  gridSpacingMeters: number
  selectedHouseId: string | null

  // Actions — project
  setTerritoryName: (name: string) => void
  setTerritoryNumber: (num: string) => void
  setCardDimensions: (width: number, height: number) => void
  setMapView: (center: [number, number], zoom: number) => void

  // Actions — drawing
  setBoundary: (f: Feature<Polygon> | null) => void
  addCustomRoad: (f: Feature<LineString>) => void
  removeCustomRoad: (id: string) => void
  addHousePoint: (lng: number, lat: number) => void
  removeHousePoint: (id: string) => void
  removeHousePoints: (ids: string[]) => void
  clearAllHouses: () => void
  bulkAddHouses: (points: Array<{ lng: number; lat: number }>) => void
  updateHouseLabel: (id: string, label: string) => void
  toggleHouseTag: (id: string, tag: string) => void

  // Actions — UI
  setActiveDrawMode: (mode: DrawMode) => void
  toggleLayer: (layerId: string) => void
  setBoundaryOpacity: (opacity: number) => void
  setHouseIconSize: (size: number) => void
  setBadgeIconSize: (size: number) => void
  setSelectedHouseId: (id: string | null) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSpacing: (meters: number) => void
  moveHousePoint: (id: string, lng: number, lat: number) => void

  // Actions — persistence
  loadProject: (data: ProjectData) => void
  clearProject: () => void
  getProjectData: () => ProjectData
}

export const useStore = create<MapCardsStore>((set, get) => ({
  // Initial state
  projectId: uuid(),
  territoryName: DEFAULT_PROJECT.territoryName,
  territoryNumber: DEFAULT_PROJECT.territoryNumber,
  cardWidthInches: DEFAULT_PROJECT.cardWidthInches,
  cardHeightInches: DEFAULT_PROJECT.cardHeightInches,
  mapCenter: DEFAULT_PROJECT.mapCenter,
  mapZoom: DEFAULT_PROJECT.mapZoom,
  boundary: DEFAULT_PROJECT.boundary,
  customRoads: DEFAULT_PROJECT.customRoads,
  housePoints: DEFAULT_PROJECT.housePoints,

  activeDrawMode: null,
  visibleLayers: { buildings: true },
  boundaryOpacity: 0.1,
  houseIconSize: 0.8,
  badgeIconSize: 0.7,
  snapToGrid: false,
  gridSpacingMeters: 20,
  selectedHouseId: null,

  // Project settings
  setTerritoryName: (name) => set({ territoryName: name }),
  setTerritoryNumber: (num) => set({ territoryNumber: num }),
  setCardDimensions: (width, height) =>
    set({ cardWidthInches: width, cardHeightInches: height }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

  // Drawing
  setBoundary: (f) => set({ boundary: f }),

  addCustomRoad: (f) =>
    set((s) => ({
      customRoads: [
        ...s.customRoads,
        {
          ...f,
          id: uuid(),
          properties: { label: '', createdAt: new Date().toISOString() },
        },
      ],
    })),

  removeCustomRoad: (id) =>
    set((s) => ({ customRoads: s.customRoads.filter((r) => r.id !== id) })),

  addHousePoint: (lng, lat) =>
    set((s) => ({
      housePoints: [
        ...s.housePoints,
        {
          type: 'Feature',
          id: uuid(),
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { createdAt: new Date().toISOString(), tags: [], label: '' },
        },
      ],
    })),

  removeHousePoint: (id) =>
    set((s) => ({ housePoints: s.housePoints.filter((p) => p.id !== id) })),

  removeHousePoints: (ids) =>
    set((s) => {
      const idSet = new Set(ids)
      return { housePoints: s.housePoints.filter((p) => !idSet.has(p.id as string)) }
    }),

  clearAllHouses: () => set({ housePoints: [] }),

  updateHouseLabel: (id, label) =>
    set((s) => ({
      housePoints: s.housePoints.map((p) =>
        p.id === id ? { ...p, properties: { ...p.properties, label } } : p,
      ),
    })),

  toggleHouseTag: (id, tag) =>
    set((s) => ({
      housePoints: s.housePoints.map((p) => {
        if (p.id !== id) return p
        const tags = p.properties.tags || []
        const has = tags.includes(tag as never)
        return {
          ...p,
          properties: {
            ...p.properties,
            tags: has ? tags.filter((t) => t !== tag) : [...tags, tag],
          },
        }
      }),
    })),

  bulkAddHouses: (points) =>
    set((s) => ({
      housePoints: [
        ...s.housePoints,
        ...points.map((p) => ({
          type: 'Feature' as const,
          id: uuid(),
          geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
          properties: { createdAt: new Date().toISOString(), tags: [], label: '' },
        })),
      ],
    })),

  // UI
  setActiveDrawMode: (mode) => set({ activeDrawMode: mode }),
  toggleLayer: (layerId) =>
    set((s) => ({
      visibleLayers: {
        ...s.visibleLayers,
        [layerId]: !s.visibleLayers[layerId],
      },
    })),
  setBoundaryOpacity: (opacity) => set({ boundaryOpacity: opacity }),
  setHouseIconSize: (size) => set({ houseIconSize: size }),
  setBadgeIconSize: (size) => set({ badgeIconSize: size }),
  setSelectedHouseId: (id) => set({ selectedHouseId: id }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSpacing: (meters) => set({ gridSpacingMeters: meters }),
  moveHousePoint: (id, lng, lat) =>
    set((s) => ({
      housePoints: s.housePoints.map((p) =>
        p.id === id
          ? { ...p, geometry: { ...p.geometry, coordinates: [lng, lat] } }
          : p,
      ),
    })),

  // Persistence
  loadProject: (data) =>
    set({
      projectId: data.id,
      territoryName: data.territoryName,
      territoryNumber: data.territoryNumber,
      cardWidthInches: data.cardWidthInches,
      cardHeightInches: data.cardHeightInches,
      mapCenter: data.mapCenter,
      mapZoom: data.mapZoom,
      boundary: data.boundary,
      customRoads: data.customRoads,
      housePoints: data.housePoints,
    }),

  clearProject: () =>
    set({
      projectId: uuid(),
      ...DEFAULT_PROJECT,
      activeDrawMode: null,
      visibleLayers: {},
    }),

  getProjectData: () => {
    const s = get()
    return {
      version: 1,
      id: s.projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      territoryName: s.territoryName,
      territoryNumber: s.territoryNumber,
      cardWidthInches: s.cardWidthInches,
      cardHeightInches: s.cardHeightInches,
      mapCenter: s.mapCenter,
      mapZoom: s.mapZoom,
      boundary: s.boundary,
      customRoads: s.customRoads,
      housePoints: s.housePoints,
    }
  },
}))
