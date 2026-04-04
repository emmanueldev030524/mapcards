import { useCallback, useRef } from 'react'
import { saveAs } from 'file-saver'
import { Plus, Save, Upload } from 'lucide-react'
import { useStore } from '../store'
import { deleteProject } from '../lib/db'
import { showConfirm, showAlert } from './ConfirmDialog'

export default function ProjectManager() {
  const getProjectData = useStore((s) => s.getProjectData)
  const loadProjectToStore = useStore((s) => s.loadProject)
  const clearProject = useStore((s) => s.clearProject)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleNew = useCallback(async () => {
    const ok = await showConfirm(
      'New Territory?',
      'Current work will be cleared. Make sure you\'ve saved your project first.',
      { variant: 'destructive', confirmLabel: 'Start New' },
    )
    if (!ok) return
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
      reader.onload = async () => {
        try {
          const data = JSON.parse(reader.result as string)

          // Validate required structure
          if (data.version !== 1) {
            await showAlert('Unsupported Version', 'This project file uses a version that isn\'t supported.')
            return
          }
          if (typeof data.id !== 'string' || !data.id) {
            await showAlert('Invalid File', 'This project file is missing a project ID.')
            return
          }
          if (typeof data.cardWidthInches !== 'number' || typeof data.cardHeightInches !== 'number') {
            await showAlert('Invalid File', 'This project file is missing card dimensions.')
            return
          }
          if (!Array.isArray(data.mapCenter) || data.mapCenter.length !== 2) {
            await showAlert('Invalid File', 'This project file is missing map center coordinates.')
            return
          }
          if (!Array.isArray(data.customRoads)) data.customRoads = []
          if (!Array.isArray(data.housePoints)) data.housePoints = []

          loadProjectToStore(data)
        } catch {
          await showAlert('Invalid File', 'Unable to read this file. Please select a valid .mapcards.json file.')
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
      <div className="rounded-xl border border-divider/60 bg-white/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <p className="mb-2 text-[11px] font-medium text-body/70">
          Save your territory file, load a previous one, or start fresh.
        </p>
        <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={handleExportJSON}
          className="flex min-h-[40px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-brand px-3 py-2.5 text-[12px] font-semibold text-white shadow-[0_1px_3px_rgba(75,108,167,0.3)] transition-all duration-150 hover:bg-brand-dark active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
        >
          <Save size={13} strokeWidth={2} className="shrink-0" />
          Save Project
        </button>
        <div className="group relative">
          <button
            onClick={handleImportJSON}
            aria-label="Load project"
            title="Load project"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-white text-body transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            <Upload size={15} strokeWidth={2} />
          </button>
          <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-heading px-2.5 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-150 group-hover:opacity-100">
            Load project
          </span>
        </div>
        <div className="group relative">
          <button
            onClick={handleNew}
            aria-label="New project"
            title="New project"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-divider bg-white text-body transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
          >
            <Plus size={15} strokeWidth={2} />
          </button>
          <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-heading px-2.5 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-150 group-hover:opacity-100">
            New project
          </span>
        </div>
      </div>
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
