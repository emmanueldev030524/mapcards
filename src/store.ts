import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Feature, Polygon, LineString, Point } from 'geojson'
import type { DrawMode, FeatureWithMeta, ProjectData } from './types/project'
import { DEFAULT_PROJECT } from './types/project'

export interface CustomStatus {
  id: string
  label: string
  color: string
}

/** Snapshot of undoable project data */
interface UndoSnapshot {
  boundary: Feature<Polygon> | null
  customRoads: FeatureWithMeta<LineString>[]
  housePoints: FeatureWithMeta<Point>[]
  treePoints: FeatureWithMeta<Point>[]
}

const MAX_UNDO = 50

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
  treePoints: FeatureWithMeta<Point>[]
  customStatuses: CustomStatus[]

  // UI state (not persisted)
  activeDrawMode: DrawMode
  visibleLayers: Record<string, boolean>
  boundaryOpacity: number
  maskOpacity: number
  houseIconSize: number
  badgeIconSize: number
  snapToGrid: boolean
  gridSpacingMeters: number
  selectedHouseId: string | null
  selectedRoadId: string | null
  mapMode: 'satellite' | 'street' | 'clean' | 'auto' // auto = satellite before boundary, clean after

  // Undo/redo (internal stacks, not persisted)
  _undoStack: UndoSnapshot[]
  _redoStack: UndoSnapshot[]
  _lastMoveId: string | null
  canUndo: boolean
  canRedo: boolean
  undoAction: () => void
  redoAction: () => void

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
  addTreePoint: (lng: number, lat: number) => void
  removeTreePoint: (id: string) => void
  clearAllTrees: () => void
  addCustomStatus: (label: string, color: string) => void
  removeCustomStatus: (id: string) => void
  updateCustomStatus: (id: string, label: string, color: string) => void

  // Actions — UI
  setActiveDrawMode: (mode: DrawMode) => void
  toggleLayer: (layerId: string) => void
  setBoundaryOpacity: (opacity: number) => void
  setMaskOpacity: (opacity: number) => void
  setHouseIconSize: (size: number) => void
  setBadgeIconSize: (size: number) => void
  setSelectedHouseId: (id: string | null) => void
  setSelectedRoadId: (id: string | null) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSpacing: (meters: number) => void
  setMapMode: (mode: 'satellite' | 'street' | 'clean' | 'auto') => void
  moveHousePoint: (id: string, lng: number, lat: number) => void

  // Actions — persistence
  loadProject: (data: ProjectData) => void
  clearProject: () => void
  getProjectData: () => ProjectData
}

/** Push current project data onto undo stack, then apply changes */
function setWithUndo(
  get: () => MapCardsStore,
  set: (partial: Partial<MapCardsStore> | ((s: MapCardsStore) => Partial<MapCardsStore>)) => void,
  changes: Partial<MapCardsStore> | ((s: MapCardsStore) => Partial<MapCardsStore>),
) {
  const s = get()
  const snapshot: UndoSnapshot = {
    boundary: s.boundary,
    customRoads: s.customRoads,
    housePoints: s.housePoints,
    treePoints: s.treePoints,
  }
  const newUndo = [...s._undoStack.slice(-(MAX_UNDO - 1)), snapshot]
  if (typeof changes === 'function') {
    set((state) => ({
      ...changes(state),
      _undoStack: newUndo,
      _redoStack: [],
      canUndo: true,
      canRedo: false,
    }))
  } else {
    set({
      ...changes,
      _undoStack: newUndo,
      _redoStack: [],
      canUndo: true,
      canRedo: false,
    })
  }
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
  treePoints: [],
  customStatuses: [
    { id: 'notHome', label: 'Not Home', color: '#f39c12' },
    { id: 'dnc', label: 'Do Not Call', color: '#95a5a6' },
  ],

  activeDrawMode: null,
  visibleLayers: { buildings: true },
  boundaryOpacity: 0,
  maskOpacity: 0.85,
  houseIconSize: 0.8,
  badgeIconSize: 0.7,
  snapToGrid: false,
  gridSpacingMeters: 20,
  selectedHouseId: null,
  selectedRoadId: null,
  mapMode: 'auto' as const,

  _undoStack: [],
  _redoStack: [],
  _lastMoveId: null,
  canUndo: false,
  canRedo: false,

  undoAction: () =>
    set((s) => {
      if (s._undoStack.length === 0) return s
      const prev = s._undoStack[s._undoStack.length - 1]
      const current: UndoSnapshot = {
        boundary: s.boundary,
        customRoads: s.customRoads,
        housePoints: s.housePoints,
      }
      const newUndo = s._undoStack.slice(0, -1)
      return {
        ...prev,
        _undoStack: newUndo,
        _redoStack: [...s._redoStack, current],
        canUndo: newUndo.length > 0,
        canRedo: true,
      }
    }),

  redoAction: () =>
    set((s) => {
      if (s._redoStack.length === 0) return s
      const next = s._redoStack[s._redoStack.length - 1]
      const current: UndoSnapshot = {
        boundary: s.boundary,
        customRoads: s.customRoads,
        housePoints: s.housePoints,
      }
      const newRedo = s._redoStack.slice(0, -1)
      return {
        ...next,
        _undoStack: [...s._undoStack, current],
        _redoStack: newRedo,
        canUndo: true,
        canRedo: newRedo.length > 0,
      }
    }),

  // Project settings
  setTerritoryName: (name) => set({ territoryName: name }),
  setTerritoryNumber: (num) => set({ territoryNumber: num }),
  setCardDimensions: (width, height) =>
    set({ cardWidthInches: width, cardHeightInches: height }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

  // Drawing (all undoable)
  setBoundary: (f) => setWithUndo(get, set, { boundary: f }),

  addCustomRoad: (f) =>
    setWithUndo(get, set, (s) => ({
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
    setWithUndo(get, set, (s) => ({ customRoads: s.customRoads.filter((r) => r.id !== id) })),

  addHousePoint: (lng, lat) =>
    setWithUndo(get, set, (s) => ({
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
    setWithUndo(get, set, (s) => ({ housePoints: s.housePoints.filter((p) => p.id !== id) })),

  removeHousePoints: (ids) =>
    setWithUndo(get, set, (s) => {
      const idSet = new Set(ids)
      return { housePoints: s.housePoints.filter((p) => !idSet.has(p.id as string)) }
    }),

  clearAllHouses: () => setWithUndo(get, set, { housePoints: [] }),

  updateHouseLabel: (id, label) =>
    setWithUndo(get, set, (s) => ({
      housePoints: s.housePoints.map((p) =>
        p.id === id ? { ...p, properties: { ...p.properties, label } } : p,
      ),
    })),

  toggleHouseTag: (id, tag) =>
    setWithUndo(get, set, (s) => ({
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

  addTreePoint: (lng, lat) =>
    setWithUndo(get, set, (s) => ({
      treePoints: [
        ...s.treePoints,
        {
          type: 'Feature',
          id: uuid(),
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { createdAt: new Date().toISOString(), tags: [], label: '' },
        },
      ],
    })),

  removeTreePoint: (id) =>
    setWithUndo(get, set, (s) => ({ treePoints: s.treePoints.filter((p) => p.id !== id) })),

  clearAllTrees: () =>
    setWithUndo(get, set, () => ({ treePoints: [] })),

  addCustomStatus: (label, color) =>
    set((s) => ({ customStatuses: [...s.customStatuses, { id: `status-${uuid().slice(0, 8)}`, label, color }] })),

  removeCustomStatus: (id) =>
    set((s) => ({ customStatuses: s.customStatuses.filter((st) => st.id !== id) })),

  updateCustomStatus: (id, label, color) =>
    set((s) => ({ customStatuses: s.customStatuses.map((st) => st.id === id ? { ...st, label, color } : st) })),

  bulkAddHouses: (points) =>
    setWithUndo(get, set, (s) => ({
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
  setMaskOpacity: (opacity) => set({ maskOpacity: opacity }),
  setHouseIconSize: (size) => set({ houseIconSize: size }),
  setBadgeIconSize: (size) => set({ badgeIconSize: size }),
  setSelectedHouseId: (id) => set({ selectedHouseId: id }),
  setSelectedRoadId: (id) => set({ selectedRoadId: id }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSpacing: (meters) => set({ gridSpacingMeters: meters }),
  setMapMode: (mode) => set({ mapMode: mode }),
  moveHousePoint: (id, lng, lat) => {
    // Only push undo on first move (avoid flooding stack during drag)
    const s = get()
    const isFirstMove = !s._lastMoveId || s._lastMoveId !== id
    if (isFirstMove) {
      setWithUndo(get, set, (st) => ({
        housePoints: st.housePoints.map((p) =>
          p.id === id
            ? { ...p, geometry: { ...p.geometry, coordinates: [lng, lat] } }
            : p,
        ),
        _lastMoveId: id,
      }))
    } else {
      set((st) => ({
        housePoints: st.housePoints.map((p) =>
          p.id === id
            ? { ...p, geometry: { ...p.geometry, coordinates: [lng, lat] } }
            : p,
        ),
      }))
    }
  },

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
      treePoints: (data as Record<string, unknown>).treePoints as FeatureWithMeta<Point>[] || [],
      customStatuses: ((data as Record<string, unknown>).customStatuses as CustomStatus[]) || [
        { id: 'notHome', label: 'Not Home', color: '#f39c12' },
        { id: 'dnc', label: 'Do Not Call', color: '#95a5a6' },
      ],
    }),

  clearProject: () =>
    set({
      projectId: uuid(),
      ...DEFAULT_PROJECT,
      treePoints: [],
      customStatuses: [
        { id: 'notHome', label: 'Not Home', color: '#f39c12' },
        { id: 'dnc', label: 'Do Not Call', color: '#95a5a6' },
      ],
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
      treePoints: s.treePoints,
      customStatuses: s.customStatuses,
    } as ProjectData
  },
}))
