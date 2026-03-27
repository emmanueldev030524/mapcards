import { useCallback, useRef } from 'react'
import { saveAs } from 'file-saver'
import { Plus, Save, Upload } from 'lucide-react'
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

          // Validate required structure
          if (data.version !== 1) {
            alert('Unsupported project file version.')
            return
          }
          if (typeof data.id !== 'string' || !data.id) {
            alert('Invalid project file: missing project ID.')
            return
          }
          if (typeof data.cardWidthInches !== 'number' || typeof data.cardHeightInches !== 'number') {
            alert('Invalid project file: missing card dimensions.')
            return
          }
          if (!Array.isArray(data.mapCenter) || data.mapCenter.length !== 2) {
            alert('Invalid project file: missing map center.')
            return
          }
          if (!Array.isArray(data.customRoads)) data.customRoads = []
          if (!Array.isArray(data.housePoints)) data.housePoints = []

          loadProjectToStore(data)
        } catch {
          alert('Invalid project file. Please select a .mapcards.json file.')
        }
      }
      reader.readAsText(file)

      // Reset input so the same file can be loaded again
      e.target.value = ''
    },
    [loadProjectToStore],
  )

  return (
    <div className="space-y-3">
      <div className="flex min-w-0 gap-1.5">
        <button
          onClick={handleNew}
          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-brand bg-transparent px-2 py-1.5 text-[12px] font-medium text-brand transition-colors duration-150 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.97]"
        >
          <Plus size={13} strokeWidth={2} className="shrink-0" />
          <span className="truncate">New</span>
        </button>
        <button
          onClick={handleExportJSON}
          className="flex min-w-0 flex-[1.3] items-center justify-center gap-1 rounded-full bg-brand px-2 py-1.5 text-[12px] font-semibold text-white shadow-[0_1px_3px_rgba(75,108,167,0.3),0_2px_8px_rgba(75,108,167,0.15)] transition-colors duration-150 hover:bg-brand-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.97]"
        >
          <Save size={13} strokeWidth={2} className="shrink-0" />
          <span className="truncate">Save</span>
        </button>
        <button
          onClick={handleImportJSON}
          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full border border-brand bg-transparent px-2 py-1.5 text-[12px] font-medium text-brand transition-colors duration-150 hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.97]"
        >
          <Upload size={13} strokeWidth={2} className="shrink-0" />
          <span className="truncate">Load</span>
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
