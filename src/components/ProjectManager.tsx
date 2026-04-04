import { useCallback, useEffect, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { Check, PencilLine, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useStore } from '../store'
import { showConfirm, showAlert } from './ConfirmDialog'
import ProjectLibrary from './ProjectLibrary'
import type { ProjectData } from '../types/project'
import { deleteProject, loadProject } from '../lib/db'
import SaveStatus from './SaveStatus'
import type { SaveState } from '../hooks/useProject'

interface ProjectManagerProps {
  refreshKey?: string | null
  flushPendingSave: () => Promise<void>
  saveState: SaveState
  lastSavedAt: string | null
}

function getProjectExportName(projectName: string, territoryNumber: string, territoryName: string) {
  return projectName || territoryNumber || territoryName || 'untitled'
}

function getImportedProjectName(fileName: string, data: ProjectData) {
  if (typeof data.projectName === 'string' && data.projectName.trim()) return data.projectName.trim()

  return fileName
    .replace(/\.mapcards\.json$/i, '')
    .replace(/\.json$/i, '')
    .trim()
}

function getProjectDisplayName(projectName: string, territoryNumber: string, territoryName: string) {
  return projectName.trim() || (territoryNumber ? `Territory ${territoryNumber}` : '') || territoryName || 'Untitled Project'
}

function getProjectSubtitle(territoryNumber: string, territoryName: string) {
  if (territoryNumber && territoryName) return `Territory ${territoryNumber} • ${territoryName}`
  if (territoryNumber) return `Territory ${territoryNumber}`
  if (territoryName) return territoryName
  return 'Local project'
}

export default function ProjectManager({
  refreshKey,
  flushPendingSave,
  saveState,
  lastSavedAt,
}: ProjectManagerProps) {
  const getProjectData = useStore((s) => s.getProjectData)
  const loadProjectToStore = useStore((s) => s.loadProject)
  const clearProject = useStore((s) => s.clearProject)
  const projectId = useStore((s) => s.projectId)
  const projectName = useStore((s) => s.projectName)
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const setProjectName = useStore((s) => s.setProjectName)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [renaming, setRenaming] = useState(false)
  const [draftName, setDraftName] = useState(projectName)

  useEffect(() => {
    if (!renaming) setDraftName(projectName)
  }, [projectName, renaming])

  const commitRename = useCallback(() => {
    setProjectName(draftName.trim())
    setRenaming(false)
  }, [draftName, setProjectName])

  const cancelRename = useCallback(() => {
    setDraftName(projectName)
    setRenaming(false)
  }, [projectName])

  const handleNew = useCallback(async () => {
    const ok = await showConfirm(
      'New Territory?',
      'Current work will be cleared. Make sure you\'ve saved your project first.',
      { variant: 'destructive', confirmLabel: 'Start New' },
    )
    if (!ok) return
    try {
      await flushPendingSave()
      clearProject()
    } catch {
      await showAlert('Save Failed', 'Unable to save the current project before starting a new one.')
    }
  }, [clearProject, flushPendingSave])

  const handleDeleteCurrent = useCallback(async () => {
    const title = getProjectDisplayName(projectName, territoryNumber, territoryName)
    const ok = await showConfirm(
      'Delete Current Project?',
      `Delete ${title} from local storage?`,
      { variant: 'destructive', confirmLabel: 'Delete Project' },
    )
    if (!ok) return

    await deleteProject(projectId)
    const nextProject = await loadProject()
    if (nextProject) loadProjectToStore(nextProject)
    else clearProject()
  }, [clearProject, loadProjectToStore, projectId, projectName, territoryName, territoryNumber])

  const handleExportJSON = useCallback(() => {
    const data = getProjectData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const filename = `${getProjectExportName(projectName, territoryNumber, territoryName)}.mapcards.json`
    saveAs(blob, filename)
  }, [getProjectData, projectName, territoryName, territoryNumber])

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
          data.projectName = getImportedProjectName(file.name, data)

          try {
            await flushPendingSave()
          } catch {
            await showAlert('Save Failed', 'Unable to save the current project before loading this file.')
            return
          }

          loadProjectToStore(data)
        } catch {
          await showAlert('Invalid File', 'Unable to read this file. Please select a valid .mapcards.json file.')
        }
      }
      reader.readAsText(file)

      // Reset input so the same file can be loaded again
      e.target.value = ''
    },
    [flushPendingSave, loadProjectToStore],
  )

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-divider/60 bg-white/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div className="rounded-xl border border-divider/50 bg-white px-3 py-3 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-body/70">Current Project</p>
              {!renaming ? (
                <>
                  <h3 className="mt-1 break-words text-[15px] font-semibold tracking-tight text-heading">
                    {getProjectDisplayName(projectName, territoryNumber, territoryName)}
                  </h3>
                  <p className="mt-1 break-words text-[11px] leading-relaxed text-body/60">
                    {getProjectSubtitle(territoryNumber, territoryName)}
                  </p>
                </>
              ) : (
                <div className="mt-1.5">
                  <input
                    id="project-name"
                    type="text"
                    value={draftName}
                    autoFocus
                    onChange={(e) => setDraftName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename()
                      if (e.key === 'Escape') cancelRename()
                    }}
                    placeholder="Untitled Project"
                    className="w-full rounded-xl border border-divider bg-surface px-3 py-2.5 text-[13px] text-heading outline-none transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-body/35 hover:border-brand/20 focus:border-brand/30 focus:bg-white focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
                  />
                </div>
              )}
            </div>

            {!renaming ? (
              <button
                onClick={() => setRenaming(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-divider bg-slate-50 text-body transition-colors hover:border-brand/30 hover:text-brand"
                aria-label="Rename project"
                title="Rename project"
              >
                <PencilLine size={15} strokeWidth={2} />
              </button>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={commitRename}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white transition-colors hover:bg-brand-dark"
                  aria-label="Save project name"
                  title="Save name"
                >
                  <Check size={15} strokeWidth={2.2} />
                </button>
                <button
                  onClick={cancelRename}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-divider bg-white text-body transition-colors hover:border-brand/30 hover:text-brand"
                  aria-label="Cancel rename"
                  title="Cancel"
                >
                  <X size={15} strokeWidth={2.2} />
                </button>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-divider/40 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[18rem] text-[10px] leading-relaxed text-body/58">
              Rename this local project here. Export creates a portable backup file.
            </p>
            <SaveStatus saveState={saveState} lastSavedAt={lastSavedAt} />
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          <button
            onClick={handleExportJSON}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-3 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(75,108,167,0.28)] transition-all duration-150 hover:bg-brand-dark active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <Save size={14} strokeWidth={2} className="shrink-0" />
            Export Backup
          </button>

          <div className="flex items-center justify-center gap-2 rounded-xl border border-divider/50 bg-slate-50/80 px-2.5 py-2">
            <div className="group relative">
              <button
                onClick={handleImportJSON}
                aria-label="Load project"
                title="Load project"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-divider bg-white text-body transition-all duration-150 hover:border-brand/30 hover:text-brand active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:outline-none"
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

            <div className="group relative">
              <button
                onClick={handleDeleteCurrent}
                aria-label="Delete current project"
                title="Delete current project"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-red-100 bg-red-50 text-red-500 transition-all duration-150 hover:bg-red-100 hover:text-red-600 active:scale-[0.95] focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:outline-none"
              >
                <Trash2 size={15} strokeWidth={2} />
              </button>
              <span className="pointer-events-none absolute -bottom-9 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-heading px-2.5 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] transition-all duration-150 group-hover:opacity-100">
                Delete project
              </span>
            </div>
          </div>

          <p className="px-1 text-[10px] leading-relaxed text-body/55">
            Local projects autosave automatically. Import, delete, or start a fresh project from here.
          </p>
        </div>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.mapcards.json"
        onChange={handleFileChange}
        className="hidden"
      />
      <ProjectLibrary refreshKey={refreshKey} flushPendingSave={flushPendingSave} />
    </div>
  )
}
