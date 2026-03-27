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
    <div className="space-y-2.5">
      <h3 className="text-[13px] font-bold uppercase tracking-wide text-heading">
        Project
      </h3>
      <div className="flex gap-1.5">
        <button
          onClick={handleNew}
          className="flex items-center justify-center gap-1 rounded px-2.5 py-2 text-sm font-medium text-label transition-all duration-150 hover:bg-slate-100 active:scale-[0.97]"
        >
          <Plus size={16} strokeWidth={2} />
          New
        </button>
        <button
          onClick={handleExportJSON}
          className="flex flex-1 items-center justify-center gap-1.5 rounded bg-action px-3 py-2 text-sm font-bold text-white shadow-[0_2px_8px_rgba(57,87,127,0.3)] transition-all duration-150 hover:bg-primary-dark hover:shadow-[0_4px_12px_rgba(57,87,127,0.35)] active:scale-[0.97]"
        >
          <Save size={16} strokeWidth={2} />
          Save
        </button>
        <button
          onClick={handleImportJSON}
          className="flex items-center justify-center gap-1 rounded px-2.5 py-2 text-sm font-medium text-label transition-all duration-150 hover:bg-slate-100 active:scale-[0.97]"
        >
          <Upload size={16} strokeWidth={2} />
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
