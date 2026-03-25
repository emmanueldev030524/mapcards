import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { saveProject, loadProject } from '../lib/db'

export function useAutoSave() {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsub = useStore.subscribe(() => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const data = useStore.getState().getProjectData()
        saveProject(data).catch(console.error)
      }, 500)
    })

    return () => {
      unsub()
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])
}

export function useLoadOnStart() {
  const loadProjectToStore = useStore((s) => s.loadProject)

  useEffect(() => {
    loadProject().then((data) => {
      if (data) loadProjectToStore(data)
    }).catch(console.error)
  }, [loadProjectToStore])
}
