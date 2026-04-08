import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { RiFolderOpenFill, RiDeleteBin5Fill, RiTimeFill } from 'react-icons/ri'
import { listProjects, loadProjectById, loadProject, deleteProject, type ProjectListItem } from '../lib/db'
import { useStore } from '../store'
import { showAlert, showConfirm } from './ConfirmDialog'
import { useIsTablet } from '../hooks/useMediaQuery'

const actionButtonClass =
  'sidebar-icon-button group/tip relative flex h-8 w-8 items-center justify-center rounded-[12px] text-brand/72 hover:border-brand/24 hover:text-brand focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:outline-none'
const destructiveActionButtonClass =
  `${actionButtonClass} sidebar-icon-button-danger`

interface ProjectLibraryProps {
  refreshKey?: string | null
  flushPendingSave: () => Promise<void>
}

function getProjectTitle(project: ProjectListItem) {
  return project.projectName?.trim()
    || (project.territoryNumber ? `Territory ${project.territoryNumber}` : '')
    || project.territoryName
    || 'Untitled Project'
}

function getProjectMeta(project: ProjectListItem) {
  if (project.territoryNumber && project.territoryName) {
    return `Territory ${project.territoryNumber} • ${project.territoryName}`
  }

  if (project.territoryNumber) return `Territory ${project.territoryNumber}`
  if (project.territoryName) return project.territoryName
  return 'No territory name set'
}

function formatRelative(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface ProjectCardProps {
  project: ProjectListItem
  isTablet: boolean
  onOpen: (id: string) => void
  onDelete: (project: ProjectListItem) => void
}

function ProjectCard({
  project,
  isTablet,
  onOpen,
  onDelete,
}: ProjectCardProps) {
  const title = getProjectTitle(project)
  const meta = getProjectMeta(project)

  return (
    <div className="sidebar-card-surface-soft px-3 py-2.5 transition-[transform,box-shadow,border-color] duration-150 hover:-translate-y-px hover:border-white/70">
      <div className={`flex gap-2 ${isTablet ? 'flex-col' : 'items-start justify-between'}`}>
        <div className="min-w-0 flex-1">
          <p className="wrap-break-word text-[11.5px] font-semibold leading-snug tracking-[-0.01em] text-heading">
            {title}
          </p>
          <p className="mt-0.5 wrap-break-word text-[10px] leading-relaxed text-body/66">
            {meta}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[9.5px] font-medium text-body/48">
            <RiTimeFill size={10} />
            {formatRelative(project.updatedAt)}
          </p>
        </div>

        <div className={`flex shrink-0 items-center gap-1 ${isTablet ? 'justify-end' : ''}`}>
          <button
            onClick={() => onOpen(project.id)}
            className={actionButtonClass}
            aria-label={`Open ${title}`}
          >
            <RiFolderOpenFill size={13} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100">Open project</span>
          </button>
          <button
            onClick={() => onDelete(project)}
            className={destructiveActionButtonClass}
            aria-label={`Delete ${title}`}
          >
            <RiDeleteBin5Fill size={13} />
            <span className="pointer-events-none absolute -bottom-8 right-0 z-50 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100">Delete project</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProjectLibrary({ refreshKey, flushPendingSave }: ProjectLibraryProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [savedOpen, setSavedOpen] = useState(false)
  const isTablet = useIsTablet()
  const projectId = useStore((s) => s.projectId)
  const loadProjectToStore = useStore((s) => s.loadProject)
  const clearProject = useStore((s) => s.clearProject)

  const refreshProjects = useCallback(async () => {
    setLoading(true)
    try {
      setProjects(await listProjects())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshProjects().catch((err) => { if (import.meta.env.DEV) console.error(err) })
  }, [refreshProjects, refreshKey, projectId])

  const savedProjects = useMemo(
    () => projects.filter((project) => project.id !== projectId),
    [projectId, projects],
  )

  useEffect(() => {
    if (savedProjects.length <= 1) setSavedOpen(true)
  }, [savedProjects.length])

  const handleOpen = useCallback(async (id: string) => {
    try {
      await flushPendingSave()
    } catch {
      await showAlert('Save Failed', 'Unable to save the current project before switching.')
      return
    }

    const data = await loadProjectById(id)
    if (data) loadProjectToStore(data)
  }, [flushPendingSave, loadProjectToStore])

  const handleDelete = useCallback(async (project: ProjectListItem) => {
    const title = getProjectTitle(project)
    const ok = await showConfirm(
      'Delete Project?',
      `Delete ${title} from local storage?`,
      { variant: 'destructive', confirmLabel: 'Delete Project' },
    )
    if (!ok) return

    await deleteProject(project.id)
    if (project.id === projectId) {
      const nextProject = await loadProject()
      if (nextProject) loadProjectToStore(nextProject)
      else clearProject()
    }
    await refreshProjects()
  }, [clearProject, loadProjectToStore, projectId, refreshProjects])

  return (
    <div className="sidebar-card-surface p-2">
      <div className="flex items-center justify-between gap-1.5 px-2 pb-1.5">
        <p className="sidebar-section-heading">Project Library</p>
        <span className="text-[9.5px] font-semibold tracking-[0.03em] text-body/48">{savedProjects.length} saved</span>
      </div>

      {loading ? (
        <p className="px-2 py-1 text-[10.5px] font-medium text-body/54">Loading...</p>
      ) : savedProjects.length === 0 ? (
        <p className="px-2 py-0.5 text-[10.5px] text-body/48">No other saved projects.</p>
      ) : (
        <div className="sidebar-card-surface-soft overflow-hidden">
          <button
            onClick={() => setSavedOpen((open) => !open)}
            aria-expanded={savedOpen}
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-[background-color,transform] duration-150 hover:bg-white/55"
          >
            <p className="text-[10.5px] font-semibold tracking-[0.01em] text-slate-600">
              Saved Projects ({savedProjects.length})
            </p>
            <ChevronDown
              size={13}
              strokeWidth={2.2}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${savedOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {savedOpen && (
            <div className="border-t border-white/55 px-2 py-2">
              <div className="project-library-scroll max-h-58 space-y-1.5 overflow-y-auto pr-0.5">
                {savedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    isTablet={isTablet}
                    onOpen={handleOpen}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
