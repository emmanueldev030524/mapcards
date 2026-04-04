import type { SaveState } from '../hooks/useProject'

interface SaveStatusProps {
  saveState: SaveState
  lastSavedAt: string | null
}

function formatSavedTime(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function SaveStatus({ saveState, lastSavedAt }: SaveStatusProps) {
  const savedTime = formatSavedTime(lastSavedAt)

  if (saveState === 'saving') {
    return (
      <p className="flex items-center text-[10px] font-medium text-body/55">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
        Saving...
      </p>
    )
  }

  if (saveState === 'dirty') {
    return (
      <p className="flex items-center text-[10px] font-medium text-body/55">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-400 align-middle" />
        Unsaved changes
      </p>
    )
  }

  if (saveState === 'error') {
    return (
      <p className="flex items-center text-[10px] font-medium text-red-500">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400 align-middle" />
        Save failed
      </p>
    )
  }

  if (saveState === 'saved' || lastSavedAt) {
    return (
      <p className="flex items-center text-[10px] font-medium text-body/45">
        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
        {savedTime ? `Saved ${savedTime}` : 'Saved'}
      </p>
    )
  }

  return (
    <p className="flex items-center text-[10px] font-medium text-body/35">
      <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-body/20 align-middle" />
      Ready
    </p>
  )
}
