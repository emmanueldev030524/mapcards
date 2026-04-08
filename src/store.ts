import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Feature, Polygon, LineString, Point } from 'geojson'
import type { DrawMode, FeatureWithMeta, ProjectData } from './types/project'
import { DEFAULT_PROJECT } from './types/project'
import { PLACE_TAG_IDS } from './lib/mapPins'

/** Snapshot of undoable project data */
interface UndoSnapshot {
  boundary: Feature<Polygon> | null
  customRoads: FeatureWithMeta<LineString>[]
  housePoints: FeatureWithMeta<Point>[]
  treePoints: FeatureWithMeta<Point>[]
  startMarker: Feature<Point> | null
}

const MAX_UNDO = 50

interface MapCardsStore {
  // Project data
  projectId: string
  projectCreatedAt: string
  projectName: string
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
  startMarker: Feature<Point> | null

  // UI state (not persisted)
  activeDrawMode: DrawMode
  visibleLayers: Record<string, boolean>
  boundaryOpacity: number
  maskOpacity: number
  houseIconSize: number
  badgeIconSize: number
  treeIconSize: number
  startMarkerSize: number
  snapToGrid: boolean
  gridSpacingMeters: number
  selectedHouseId: string | null
  selectedTreeId: string | null
  selectedRoadId: string | null
  selectedStartMarker: boolean
  mapMode: 'satellite' | 'street' | 'clean' | 'auto' // auto = satellite before boundary, clean after
  reviewMode: boolean

  // Undo/redo (internal stacks, not persisted)
  _undoStack: UndoSnapshot[]
  _redoStack: UndoSnapshot[]
  _lastMoveId: string | null
  canUndo: boolean
  canRedo: boolean
  undoAction: () => void
  redoAction: () => void

  // Actions — project
  setProjectName: (name: string) => void
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
  setStartMarker: (f: Feature<Point> | null) => void
  moveStartMarker: (lng: number, lat: number) => void
  addTreePoint: (lng: number, lat: number) => void
  removeTreePoint: (id: string) => void
  clearAllTrees: () => void
  moveTreePoint: (id: string, lng: number, lat: number) => void

  // Actions — UI
  setActiveDrawMode: (mode: DrawMode) => void
  toggleLayer: (layerId: string) => void
  setBoundaryOpacity: (opacity: number) => void
  setMaskOpacity: (opacity: number) => void
  setHouseIconSize: (size: number) => void
  setBadgeIconSize: (size: number) => void
  setTreeIconSize: (size: number) => void
  setStartMarkerSize: (size: number) => void
  setSelectedHouseId: (id: string | null) => void
  setSelectedTreeId: (id: string | null) => void
  setSelectedRoadId: (id: string | null) => void
  setSelectedStartMarker: (selected: boolean) => void
  setSnapToGrid: (snap: boolean) => void
  setGridSpacing: (meters: number) => void
  setMapMode: (mode: 'satellite' | 'street' | 'clean' | 'auto') => void
  setReviewMode: (enabled: boolean) => void
  moveHousePoint: (id: string, lng: number, lat: number) => void

  // Actions — persistence
  loadProject: (data: ProjectData) => void
  clearProject: () => void
  getProjectData: () => ProjectData
}

const DEFAULT_VISIBLE_LAYERS = { buildings: true }
const DEFAULT_BOUNDARY_OPACITY = 0
const DEFAULT_MASK_OPACITY = 0.85
const DEFAULT_HOUSE_ICON_SIZE = 0.8
const DEFAULT_BADGE_ICON_SIZE = 0.7
const DEFAULT_TREE_ICON_SIZE = 0.9
const DEFAULT_START_MARKER_SIZE = 1
const DEFAULT_SNAP_TO_GRID = false
const DEFAULT_GRID_SPACING_METERS = 20
const DEFAULT_MAP_MODE = 'auto' as const

/**
 * Strip legacy status tags (rv, bs, notHome, dnc, user-created status-* ids)
 * from loaded house features. The app no longer tracks status; any tag that
 * isn't a known place tag is silently dropped on load.
 */
function stripLegacyStatusTags<F extends FeatureWithMeta<Point>>(houses: F[]): F[] {
  return houses.map((h) => {
    const tags = h.properties.tags || []
    const placeOnly = tags.filter((t) => PLACE_TAG_IDS.has(t))
    if (placeOnly.length === tags.length) return h
    return { ...h, properties: { ...h.properties, tags: placeOnly } }
  })
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
    startMarker: s.startMarker,
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
  projectCreatedAt: new Date().toISOString(),
  projectName: DEFAULT_PROJECT.projectName || '',
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
  startMarker: null,

  activeDrawMode: null,
  visibleLayers: DEFAULT_VISIBLE_LAYERS,
  boundaryOpacity: DEFAULT_BOUNDARY_OPACITY,
  maskOpacity: DEFAULT_MASK_OPACITY,
  houseIconSize: DEFAULT_HOUSE_ICON_SIZE,
  badgeIconSize: DEFAULT_BADGE_ICON_SIZE,
  treeIconSize: DEFAULT_TREE_ICON_SIZE,
  startMarkerSize: DEFAULT_START_MARKER_SIZE,
  snapToGrid: DEFAULT_SNAP_TO_GRID,
  gridSpacingMeters: DEFAULT_GRID_SPACING_METERS,
  selectedHouseId: null,
  selectedTreeId: null,
  selectedRoadId: null,
  selectedStartMarker: false,
  mapMode: DEFAULT_MAP_MODE,
  reviewMode: false,

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
        treePoints: s.treePoints,
        startMarker: s.startMarker,
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
        treePoints: s.treePoints,
        startMarker: s.startMarker,
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
  setProjectName: (name) => set({ projectName: name }),
  setTerritoryName: (name) => set({ territoryName: name }),
  setTerritoryNumber: (num) => set({ territoryNumber: num }),
  setCardDimensions: (width, height) =>
    set({ cardWidthInches: width, cardHeightInches: height }),
  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

  // Drawing (all undoable)
  setStartMarker: (f) => setWithUndo(get, set, { startMarker: f }),
  moveStartMarker: (lng, lat) => {
    const s = get()
    if (!s.startMarker) return
    const nextMarker: Feature<Point> = {
      ...s.startMarker,
      geometry: { ...s.startMarker.geometry, coordinates: [lng, lat] },
    }
    const isFirstMove = s._lastMoveId !== 'start-marker'
    if (isFirstMove) {
      setWithUndo(get, set, {
        startMarker: nextMarker,
        _lastMoveId: 'start-marker',
      })
    } else {
      set({ startMarker: nextMarker })
    }
  },
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
        const nextTags = tags.includes(tag as never)
          ? tags.filter((t) => t !== tag)
          : [...tags, tag]
        return {
          ...p,
          properties: {
            ...p.properties,
            tags: nextTags,
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
  setTreeIconSize: (size) => set({ treeIconSize: size }),
  setStartMarkerSize: (size) => set({ startMarkerSize: size }),
  setSelectedHouseId: (id) => set({ selectedHouseId: id }),
  setSelectedTreeId: (id) => set({ selectedTreeId: id }),
  setSelectedRoadId: (id) => set({ selectedRoadId: id }),
  setSelectedStartMarker: (selected) => set({ selectedStartMarker: selected }),
  setSnapToGrid: (snap) => set({ snapToGrid: snap }),
  setGridSpacing: (meters) => set({ gridSpacingMeters: meters }),
  setMapMode: (mode) => set({ mapMode: mode }),
  setReviewMode: (enabled) => set({ reviewMode: enabled }),
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
  moveTreePoint: (id, lng, lat) => {
    const s = get()
    const isFirstMove = !s._lastMoveId || s._lastMoveId !== id
    if (isFirstMove) {
      setWithUndo(get, set, (st) => ({
        treePoints: st.treePoints.map((p) =>
          p.id === id
            ? { ...p, geometry: { ...p.geometry, coordinates: [lng, lat] } }
            : p,
        ),
        _lastMoveId: id,
      }))
    } else {
      set((st) => ({
        treePoints: st.treePoints.map((p) =>
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
      projectCreatedAt: data.createdAt,
      projectName: data.projectName || '',
      territoryName: data.territoryName,
      territoryNumber: data.territoryNumber,
      cardWidthInches: data.cardWidthInches,
      cardHeightInches: data.cardHeightInches,
      mapCenter: data.mapCenter,
      mapZoom: data.mapZoom,
      boundary: data.boundary,
      customRoads: data.customRoads,
      // Strip legacy status tags (rv/bs/notHome/dnc/custom status-*) from
      // houses on load so projects saved before the status removal don't
      // carry orphaned tag references.
      housePoints: stripLegacyStatusTags(data.housePoints),
      treePoints: data.treePoints || [],
      startMarker: data.startMarker || null,
      // Reset transient editing state so prior territory doesn't leak
      _undoStack: [],
      _redoStack: [],
      _lastMoveId: null,
      canUndo: false,
      canRedo: false,
      activeDrawMode: null,
      selectedHouseId: null,
      selectedTreeId: null,
      selectedRoadId: null,
      selectedStartMarker: false,
      visibleLayers: DEFAULT_VISIBLE_LAYERS,
      boundaryOpacity: DEFAULT_BOUNDARY_OPACITY,
      maskOpacity: DEFAULT_MASK_OPACITY,
      houseIconSize: DEFAULT_HOUSE_ICON_SIZE,
      badgeIconSize: DEFAULT_BADGE_ICON_SIZE,
      treeIconSize: DEFAULT_TREE_ICON_SIZE,
      startMarkerSize: DEFAULT_START_MARKER_SIZE,
      snapToGrid: DEFAULT_SNAP_TO_GRID,
      gridSpacingMeters: DEFAULT_GRID_SPACING_METERS,
      mapMode: DEFAULT_MAP_MODE,
      reviewMode: false,
    }),

  clearProject: () =>
    set({
      projectId: uuid(),
      projectCreatedAt: new Date().toISOString(),
      ...DEFAULT_PROJECT,
      projectName: DEFAULT_PROJECT.projectName || '',
      treePoints: [],
      startMarker: null,
      activeDrawMode: null,
      selectedHouseId: null,
      selectedTreeId: null,
      selectedRoadId: null,
      selectedStartMarker: false,
      visibleLayers: DEFAULT_VISIBLE_LAYERS,
      boundaryOpacity: DEFAULT_BOUNDARY_OPACITY,
      maskOpacity: DEFAULT_MASK_OPACITY,
      houseIconSize: DEFAULT_HOUSE_ICON_SIZE,
      badgeIconSize: DEFAULT_BADGE_ICON_SIZE,
      treeIconSize: DEFAULT_TREE_ICON_SIZE,
      startMarkerSize: DEFAULT_START_MARKER_SIZE,
      snapToGrid: DEFAULT_SNAP_TO_GRID,
      gridSpacingMeters: DEFAULT_GRID_SPACING_METERS,
      mapMode: DEFAULT_MAP_MODE,
      reviewMode: false,
      // Reset transient editing state so prior territory doesn't leak
      _undoStack: [],
      _redoStack: [],
      _lastMoveId: null,
      canUndo: false,
      canRedo: false,
    }),

  getProjectData: () => {
    const s = get()
    return {
      version: 1,
      id: s.projectId,
      createdAt: s.projectCreatedAt,
      updatedAt: new Date().toISOString(),
      projectName: s.projectName,
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
      startMarker: s.startMarker,
    }
  },
}))
