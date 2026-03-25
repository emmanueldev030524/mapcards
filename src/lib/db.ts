import { get, set, del } from 'idb-keyval'
import type { ProjectData } from '../types/project'

const PROJECT_KEY = 'mapcards-current-project'

export async function saveProject(data: ProjectData): Promise<void> {
  await set(PROJECT_KEY, JSON.stringify(data))
}

export async function loadProject(): Promise<ProjectData | null> {
  const raw = await get<string>(PROJECT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ProjectData
  } catch {
    return null
  }
}

export async function deleteProject(): Promise<void> {
  await del(PROJECT_KEY)
}
