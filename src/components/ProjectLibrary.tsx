import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { RiFolderOpenFill, RiDeleteBin5Fill, RiTimeFill } from 'react-icons/ri'
import { listProjects, loadProjectById, loadProject, deleteProject, type ProjectListItem } from '../lib/db'
import { useStore } from '../store'
import { showAlert, showConfirm } from './ConfirmDialog'
import { useIsTablet } from '../hooks/useMediaQuery'

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
    <div className="rounded-lg border border-divider/50 bg-white px-2.5 py-2 transition-colors">
      <div className={`flex gap-2 ${isTablet ? 'flex-col' : 'items-start justify-between'}`}>
        <div className="min-w-0 flex-1">
          <p className="break-words text-[11.5px] font-semibold leading-snug text-heading">
            {title}
          </p>
          <p className="mt-0.5 break-words text-[10px] leading-relaxed text-body/60">
            {meta}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-[9.5px] text-body/50">
            <RiTimeFill size={10} />
            {formatRelative(project.updatedAt)}
          </p>
        </div>

        <div className={`flex shrink-0 items-center gap-1 ${isTablet ? 'justify-end' : ''}`}>
          <button
            onClick={() => onOpen(project.id)}
            className="group/tip relative flex h-7 w-7 items-center justify-center rounded-md border border-brand/20 bg-brand/5 text-brand/60 transition-colors hover:bg-brand/12 hover:text-brand"
            aria-label={`Open ${title}`}
          >
            <RiFolderOpenFill size={13} />
            <span className="pointer-events-none absolute -bottom-8 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-opacity duration-150 group-hover/tip:opacity-100">Open project</span>
          </button>
          <button
            onClick={() => onDelete(project)}
            className="group/tip relative flex h-7 w-7 items-center justify-center rounded-md border border-red-200/50 bg-red-50 text-red-400 transition-colors hover:bg-red-100 hover:text-red-500"
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
    refreshProjects().catch(console.error)
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
    <div className="rounded-xl border border-divider/50 bg-white/75 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="flex items-center justify-between gap-1.5 px-1.5 pb-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-body/60">Project Library</p>
        <span className="text-[9.5px] font-medium text-body/45">{savedProjects.length} saved</span>
      </div>

      {loading ? (
        <p className="px-1.5 py-1 text-[10.5px] text-body/50">Loading...</p>
      ) : savedProjects.length === 0 ? (
        <p className="px-1.5 py-0.5 text-[10.5px] text-body/45">No other saved projects.</p>
      ) : (
        <div className="rounded-lg border border-divider/40 bg-slate-50/60">
          <button
            onClick={() => setSavedOpen((open) => !open)}
            aria-expanded={savedOpen}
            className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors hover:bg-slate-100/70"
          >
            <p className="text-[10.5px] font-semibold text-slate-600">
              Saved Projects ({savedProjects.length})
            </p>
            <ChevronDown
              size={13}
              strokeWidth={2.2}
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${savedOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {savedOpen && (
            <div className="border-t border-divider/35 px-1.5 py-1.5">
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
