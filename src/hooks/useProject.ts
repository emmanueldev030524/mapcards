import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { saveProject, loadProject } from '../lib/db'
import type { ProjectData } from '../types/project'

let lastPersistedProjectSnapshot: string | null = null

function toComparableSnapshot(data: ProjectData) {
  return JSON.stringify({
    ...data,
    updatedAt: '',
  })
}

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

const BASE_DELAY = 500
const MAX_BACKOFF = 16_000

export function useAutoSave() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savePromiseRef = useRef<Promise<void> | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const saveStateRef = useRef<SaveState>('idle')
  const errorCountRef = useRef(0)

  const updateSaveState = useCallback((next: SaveState) => {
    saveStateRef.current = next
    setSaveState(next)
  }, [])

  const persistCurrentProject = useCallback(async () => {
    const data = useStore.getState().getProjectData()
    const comparable = toComparableSnapshot(data)

    if (comparable === lastPersistedProjectSnapshot) {
      updateSaveState('saved')
      return
    }

    updateSaveState('saving')
    const savePromise = saveProject(data)
      .then(() => {
        lastPersistedProjectSnapshot = comparable
        setLastSavedAt(data.updatedAt)
        errorCountRef.current = 0
        if (toComparableSnapshot(useStore.getState().getProjectData()) === comparable) {
          updateSaveState('saved')
        } else {
          updateSaveState('dirty')
        }
      })
      .catch((err) => {
        errorCountRef.current++
        if (import.meta.env.DEV) console.error(err)
        updateSaveState('error')
        throw err
      })
      .finally(() => {
        savePromiseRef.current = null
      })

    savePromiseRef.current = savePromise
    await savePromise
  }, [updateSaveState])

  const flushSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }

    if (savePromiseRef.current) await savePromiseRef.current

    if (saveStateRef.current === 'dirty' || saveStateRef.current === 'error') {
      await persistCurrentProject()
    }
  }, [persistCurrentProject])

  const hasUnsavedChanges =
    saveState === 'dirty' || saveState === 'saving' || saveState === 'error'

  useEffect(() => {
    // Track previous references of persisted fields to avoid running
    // JSON.stringify on every UI-only state change (selectedHouseId,
    // activeDrawMode, etc.). Only when a persisted field changes by
    // reference do we proceed to the expensive snapshot comparison.
    let prevRefs: Record<string, unknown> = {}

    const unsub = useStore.subscribe(() => {
      const s = useStore.getState()
      const refs: Record<string, unknown> = {
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

      // Cheap reference-equality check — skip stringify for UI-only changes
      let changed = false
      for (const key in refs) {
        if (refs[key] !== prevRefs[key]) { changed = true; break }
      }
      if (!changed) return
      prevRefs = refs

      const snapshot = toComparableSnapshot(s.getProjectData())
      if (snapshot === lastPersistedProjectSnapshot) {
        updateSaveState(saveStateRef.current === 'dirty' ? 'saved' : saveStateRef.current)
        return
      }

      updateSaveState('dirty')
      if (debounceRef.current) clearTimeout(debounceRef.current)

      // Exponential backoff on repeated errors (500ms, 1s, 2s, ... 16s max)
      const delay = errorCountRef.current > 0
        ? Math.min(BASE_DELAY * Math.pow(2, errorCountRef.current), MAX_BACKOFF)
        : BASE_DELAY

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        persistCurrentProject().catch(() => {
          // Error state is already handled in persistCurrentProject.
        })
      }, delay)
    })

    return () => {
      unsub()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [persistCurrentProject, updateSaveState])

  return { saveState, lastSavedAt, flushSave, hasUnsavedChanges }
}

export function useLoadOnStart() {
  const loadProjectToStore = useStore((s) => s.loadProject)

  useEffect(() => {
    loadProject().then((data) => {
      if (data) {
        lastPersistedProjectSnapshot = toComparableSnapshot(data)
        loadProjectToStore(data)
      }
    }).catch((err) => {
      if (import.meta.env.DEV) console.error(err)
    })
  }, [loadProjectToStore])
}
