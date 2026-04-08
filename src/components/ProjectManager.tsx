import { useCallback, useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import { Plus } from 'lucide-react'
import { RiSave3Fill, RiUploadCloud2Fill, RiDeleteBin5Fill, RiPencilFill } from 'react-icons/ri'
import { useStore } from '../store'
import { showConfirm, showAlert } from './ConfirmDialog'
import ProjectLibrary from './ProjectLibrary'
import type { ProjectData } from '../types/project'
import { deleteProject, loadProject } from '../lib/db'

interface ProjectManagerProps {
  refreshKey?: string | null
  flushPendingSave: () => Promise<void>
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

const actionBtn = 'sidebar-icon-button group/tip relative flex h-8 w-8 items-center justify-center rounded-[12px] text-brand/72 hover:border-brand/24 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:outline-none'
const actionBtnDanger = `${actionBtn} sidebar-icon-button-danger`
const tipClass = 'pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100'

export default function ProjectManager({
  refreshKey,
  flushPendingSave,
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

  const commitRename = useCallback(() => {
    setProjectName(draftName.trim())
    setRenaming(false)
  }, [draftName, setProjectName])

  const cancelRename = useCallback(() => {
    setDraftName(projectName)
    setRenaming(false)
  }, [projectName])

  const startRename = useCallback(() => {
    setDraftName(projectName)
    setRenaming(true)
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

    await flushPendingSave()
    await deleteProject(projectId)
    const nextProject = await loadProject()
    if (nextProject) loadProjectToStore(nextProject)
    else clearProject()
  }, [clearProject, flushPendingSave, loadProjectToStore, projectId, projectName, territoryName, territoryNumber])

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

  const displayName = getProjectDisplayName(projectName, territoryNumber, territoryName)
  const subtitle = getProjectSubtitle(territoryNumber, territoryName)

  return (
    <div className="space-y-2.5">
      <div className="sidebar-card-surface overflow-visible px-3.5 py-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <p className="sidebar-section-heading">Current Project</p>
          {!renaming && (
            <button
              onClick={startRename}
              className={actionBtn}
              aria-label="Rename project"
            >
              <RiPencilFill size={12} />
              <span className="pointer-events-none absolute -bottom-8 right-0 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100">Rename project</span>
            </button>
          )}
        </div>

        {/* Project name — inline editable */}
        <div className="mt-1.5">
          {renaming ? (
            <input
              type="text"
              value={draftName}
              autoFocus
              aria-label="Project name"
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                if (e.key === 'Escape') cancelRename()
              }}
              onBlur={commitRename}
              placeholder="Untitled Project"
              className="sidebar-input-surface w-full rounded-[14px] px-3 py-2 text-[14px] font-semibold tracking-[-0.01em] text-heading outline-none placeholder:text-body/40"
            />
          ) : (
            <h3
              className="cursor-text wrap-break-word text-[14px] font-semibold leading-snug tracking-[-0.015em] text-heading"
              onClick={startRename}
              title="Click to rename"
            >
              {displayName}
            </h3>
          )}
          <p className="mt-1 wrap-break-word text-[10.5px] leading-relaxed text-body/64">
            {subtitle}
          </p>
        </div>

        {/* Action row */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-white/55 pt-2.5 pb-0.5">
          <button
            onClick={handleExportJSON}
            className={actionBtn}
          >
            <RiSave3Fill size={15} />
            <span className="pointer-events-none absolute -bottom-8 left-0 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100">Save backup file</span>
          </button>
          <button
            onClick={handleImportJSON}
            className={actionBtn}
          >
            <RiUploadCloud2Fill size={15} />
            <span className={tipClass}>Load from file</span>
          </button>
          <button
            onClick={handleNew}
            className={actionBtn}
          >
            <Plus size={14} strokeWidth={2.5} />
            <span className={tipClass}>New project</span>
          </button>
          <div className="flex-1" />
          <button
            onClick={handleDeleteCurrent}
            className={actionBtnDanger}
          >
            <RiDeleteBin5Fill size={15} />
            <span className="pointer-events-none absolute -bottom-8 right-0 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100">Delete project</span>
          </button>
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
