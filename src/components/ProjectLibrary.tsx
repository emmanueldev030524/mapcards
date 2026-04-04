import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Trash2, Clock3, ChevronDown, Library } from 'lucide-react'
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
  compact?: boolean
  isTablet: boolean
  onOpen: (id: string) => void
  onDelete: (project: ProjectListItem) => void
}

function ProjectCard({
  project,
  compact = false,
  isTablet,
  onOpen,
  onDelete,
}: ProjectCardProps) {
  const title = getProjectTitle(project)
  const meta = getProjectMeta(project)

  return (
    <div
      className={`rounded-xl border border-divider/60 bg-white transition-colors ${compact ? 'px-3 py-2' : 'px-3 py-2.5'}`}
    >
      <div className={`flex gap-2 ${isTablet ? 'flex-col' : 'items-start justify-between'}`}>
        <div className="min-w-0 flex-1">
          <p className={`break-words font-semibold leading-snug text-heading ${compact ? 'text-[11.5px]' : 'text-[12px]'}`}>
            {title}
          </p>
          <p className={`mt-0.5 break-words leading-relaxed text-body/60 ${compact ? 'text-[10.5px]' : 'text-[11px]'}`}>
            {meta}
          </p>
          <p className="mt-1 flex items-center gap-1 text-[10px] text-body/50">
            <Clock3 size={11} strokeWidth={2} />
            {formatRelative(project.updatedAt)}
          </p>
        </div>

        <div className={`flex shrink-0 items-center gap-1 ${isTablet ? 'justify-end' : ''}`}>
          <button
            onClick={() => onOpen(project.id)}
            className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}
            aria-label={`Open ${title}`}
            title="Open project"
          >
            <FolderOpen size={compact ? 13 : 14} strokeWidth={2} />
          </button>
          <button
            onClick={() => onDelete(project)}
            className={`flex items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600 ${compact ? 'h-8 w-8' : 'h-9 w-9'}`}
            aria-label={`Delete ${title}`}
            title="Delete project"
          >
            <Trash2 size={compact ? 13 : 14} strokeWidth={2} />
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
    <div className="rounded-xl border border-divider/60 bg-white/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-body/70">Project Library</p>
        <span className="text-[10px] font-medium text-body/55">{savedProjects.length} saved</span>
      </div>

      {loading ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-body/60">Loading projects...</p>
      ) : savedProjects.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-body/60">No other saved projects yet.</p>
      ) : (
        <div className="rounded-xl border border-divider/50 bg-slate-50/70">
          <button
            onClick={() => setSavedOpen((open) => !open)}
            aria-expanded={savedOpen}
            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-100/80"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-body/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
                <Library size={13} strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-body/75">
                  Saved Projects
                </p>
                <p className="text-[10px] text-body/55">
                  {savedProjects.length} available to reopen
                </p>
              </div>
            </div>
            <ChevronDown
              size={15}
              strokeWidth={2}
              className={`shrink-0 text-body/60 transition-transform duration-200 ${savedOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {savedOpen && (
            <div className="border-t border-divider/40 px-2 py-2">
              <div className="project-library-scroll max-h-58 space-y-2 overflow-y-auto pr-1">
                {savedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    compact
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
