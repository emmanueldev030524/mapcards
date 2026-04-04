import { useEffect, useRef, useState } from 'react'
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

export function useAutoSave() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

  useEffect(() => {
    const unsub = useStore.subscribe(() => {
      const snapshot = toComparableSnapshot(useStore.getState().getProjectData())
      if (snapshot === lastPersistedProjectSnapshot) {
        setSaveState((prev) => prev === 'dirty' ? 'saved' : prev)
        return
      }

      setSaveState('dirty')
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const data = useStore.getState().getProjectData()
        const comparable = toComparableSnapshot(data)
        setSaveState('saving')
        saveProject(data)
          .then(() => {
            lastPersistedProjectSnapshot = comparable
            setLastSavedAt(data.updatedAt)
            if (toComparableSnapshot(useStore.getState().getProjectData()) === comparable) {
              setSaveState('saved')
            } else {
              setSaveState('dirty')
            }
          })
          .catch((err) => {
            console.error(err)
            setSaveState('error')
          })
      }, 500)
    })

    return () => {
      unsub()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  return { saveState, lastSavedAt }
}

export function useLoadOnStart() {
  const loadProjectToStore = useStore((s) => s.loadProject)

  useEffect(() => {
    loadProject().then((data) => {
      if (data) {
        lastPersistedProjectSnapshot = toComparableSnapshot(data)
        loadProjectToStore(data)
      }
    }).catch(console.error)
  }, [loadProjectToStore])
}
