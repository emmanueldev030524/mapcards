import { useCallback, useEffect, useState } from 'react'
import { FolderOpen, Trash2, Clock3 } from 'lucide-react'
import { listProjects, loadProjectById, deleteProject, type ProjectListItem } from '../lib/db'
import { useStore } from '../store'
import { showConfirm } from './ConfirmDialog'
import { useIsTablet } from '../hooks/useMediaQuery'

interface ProjectLibraryProps {
  refreshKey?: string | null
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

export default function ProjectLibrary({ refreshKey }: ProjectLibraryProps) {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [loading, setLoading] = useState(true)
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

  const handleOpen = useCallback(async (id: string) => {
    const data = await loadProjectById(id)
    if (data) loadProjectToStore(data)
  }, [loadProjectToStore])

  const handleDelete = useCallback(async (project: ProjectListItem) => {
    const ok = await showConfirm(
      'Delete Project?',
      `Delete ${project.territoryNumber ? `Territory ${project.territoryNumber}` : project.territoryName || 'this project'} from local storage?`,
      { variant: 'destructive', confirmLabel: 'Delete Project' },
    )
    if (!ok) return

    await deleteProject(project.id)
    if (project.id === projectId) clearProject()
    await refreshProjects()
  }, [clearProject, projectId, refreshProjects])

  return (
    <div className="rounded-xl border border-divider/60 bg-white/75 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-body/70">Project Library</p>
        <span className="text-[10px] font-medium text-body/55">{projects.length} saved</span>
      </div>

      {loading ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-body/60">Loading projects...</p>
      ) : projects.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-body/60">No saved local projects yet.</p>
      ) : (
        <div className="space-y-2">
          {projects.slice(0, 6).map((project) => {
            const active = project.id === projectId
            const title = project.territoryNumber
              ? `Territory ${project.territoryNumber}`
              : project.territoryName || 'Untitled Project'

            return (
              <div
                key={project.id}
                className={`rounded-xl border px-3 py-2.5 transition-colors ${
                  active ? 'border-brand/25 bg-brand/6' : 'border-divider/60 bg-white'
                }`}
              >
                <div className={`flex gap-2 ${isTablet ? 'flex-col' : 'items-start justify-between'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`break-words text-[12px] font-semibold leading-snug ${active ? 'text-brand' : 'text-heading'}`}>
                      {title}
                    </p>
                    <p className="mt-0.5 break-words text-[11px] leading-relaxed text-body/60">
                      {project.territoryName || 'No territory name set'}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-body/50">
                      <Clock3 size={11} strokeWidth={2} />
                      {formatRelative(project.updatedAt)}
                    </p>
                  </div>

                  <div className={`flex shrink-0 items-center gap-1 ${isTablet ? 'justify-end' : ''}`}>
                    {!active && (
                      <button
                        onClick={() => handleOpen(project.id)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                        aria-label={`Open ${title}`}
                        title="Open project"
                      >
                        <FolderOpen size={14} strokeWidth={2} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(project)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 hover:text-red-600"
                      aria-label={`Delete ${title}`}
                      title="Delete project"
                    >
                      <Trash2 size={14} strokeWidth={2} />
                    </button>
                  </div>
                </div>
                {active && (
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.08em] text-brand/75">Current project</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
