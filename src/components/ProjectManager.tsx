import { useCallback, useRef } from 'react'
import { saveAs } from 'file-saver'
import { useStore } from '../store'
import { deleteProject } from '../lib/db'

export default function ProjectManager() {
  const getProjectData = useStore((s) => s.getProjectData)
  const loadProjectToStore = useStore((s) => s.loadProject)
  const clearProject = useStore((s) => s.clearProject)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNew = useCallback(() => {
    if (!confirm('Start a new territory? Current work will be cleared.')) return
    clearProject()
    deleteProject().catch(console.error)
  }, [clearProject])

  const handleExportJSON = useCallback(() => {
    const data = getProjectData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const filename = `territory-${territoryNumber || territoryName || 'untitled'}.mapcards.json`
    saveAs(blob, filename)
  }, [getProjectData, territoryName, territoryNumber])

  const handleImportJSON = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string)
          if (data.version !== 1) {
            alert('Unsupported project file version.')
            return
          }
          loadProjectToStore(data)
        } catch {
          alert('Invalid project file.')
        }
      }
      reader.readAsText(file)

      // Reset input so the same file can be loaded again
      e.target.value = ''
    },
    [loadProjectToStore],
  )

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Project
      </h3>
      <div className="flex gap-1.5">
        <button
          onClick={handleNew}
          className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
        >
          New
        </button>
        <button
          onClick={handleExportJSON}
          className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
        >
          Save
        </button>
        <button
          onClick={handleImportJSON}
          className="flex-1 rounded-md border border-border px-2 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
        >
          Load
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.mapcards.json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
