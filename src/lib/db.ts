import { get, set, del } from 'idb-keyval'
import type { ProjectData } from '../types/project'

const LEGACY_PROJECT_KEY = 'mapcards-current-project'
const ACTIVE_PROJECT_KEY = 'mapcards-active-project-id'
const PROJECT_INDEX_KEY = 'mapcards-project-index'
const PROJECT_PREFIX = 'mapcards-project:'

export interface ProjectListItem {
  id: string
  territoryName: string
  territoryNumber: string
  createdAt: string
  updatedAt: string
}

function projectKey(id: string) {
  return `${PROJECT_PREFIX}${id}`
}

function toListItem(data: ProjectData): ProjectListItem {
  return {
    id: data.id,
    territoryName: data.territoryName,
    territoryNumber: data.territoryNumber,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  }
}

async function getProjectIndex(): Promise<ProjectListItem[]> {
  return (await get<ProjectListItem[]>(PROJECT_INDEX_KEY)) || []
}

async function setProjectIndex(index: ProjectListItem[]): Promise<void> {
  const sorted = [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  await set(PROJECT_INDEX_KEY, sorted)
}

async function ensureMigrated(): Promise<void> {
  const legacyRaw = await get<string>(LEGACY_PROJECT_KEY)
  if (!legacyRaw) return

  const existingIndex = await getProjectIndex()
  if (existingIndex.length > 0) {
    await del(LEGACY_PROJECT_KEY)
    return
  }

  try {
    const data = JSON.parse(legacyRaw) as ProjectData
    await set(projectKey(data.id), JSON.stringify(data))
    await setProjectIndex([toListItem(data)])
    await set(ACTIVE_PROJECT_KEY, data.id)
  } catch {
    // Ignore unreadable legacy payloads and clear them.
  } finally {
    await del(LEGACY_PROJECT_KEY)
  }
}

export async function saveProject(data: ProjectData): Promise<void> {
  await ensureMigrated()
  await set(projectKey(data.id), JSON.stringify(data))

  const index = await getProjectIndex()
  const next = index.filter((item) => item.id !== data.id)
  next.push(toListItem(data))

  await Promise.all([
    setProjectIndex(next),
    set(ACTIVE_PROJECT_KEY, data.id),
  ])
}

export async function loadProject(): Promise<ProjectData | null> {
  await ensureMigrated()

  const activeId = await get<string>(ACTIVE_PROJECT_KEY)
  if (activeId) {
    const active = await loadProjectById(activeId)
    if (active) return active
  }

  const [latest] = await getProjectIndex()
  if (!latest) return null

  return loadProjectById(latest.id)
}

export async function loadProjectById(id: string): Promise<ProjectData | null> {
  await ensureMigrated()
  const raw = await get<string>(projectKey(id))
  if (!raw) return null

  try {
    const data = JSON.parse(raw) as ProjectData
    await set(ACTIVE_PROJECT_KEY, id)
    return data
  } catch {
    return null
  }
}

export async function listProjects(): Promise<ProjectListItem[]> {
  await ensureMigrated()
  return getProjectIndex()
}

export async function deleteProject(id?: string): Promise<void> {
  await ensureMigrated()

  const targetId = id || await get<string>(ACTIVE_PROJECT_KEY)
  if (!targetId) return

  const index = await getProjectIndex()
  const next = index.filter((item) => item.id !== targetId)

  await Promise.all([
    del(projectKey(targetId)),
    setProjectIndex(next),
  ])

  const activeId = await get<string>(ACTIVE_PROJECT_KEY)
  if (activeId !== targetId) return

  if (next.length > 0) await set(ACTIVE_PROJECT_KEY, next[0].id)
  else await del(ACTIVE_PROJECT_KEY)
}
