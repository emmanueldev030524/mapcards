import { useState, useEffect, useCallback } from 'react'

interface ToastMessage {
  id: number
  text: string
}

let _addToast: ((text: string) => void) | null = null
let _nextId = 0

/** Show a brief non-blocking toast message. Auto-dismisses after 2s. */
export function showToast(text: string) {
  _addToast?.(text)
}

const DURATION = 2000

export default function Toast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const add = useCallback((text: string) => {
    const id = ++_nextId
    setToasts((prev) => {
      // Deduplicate: if same text is already showing, skip
      if (prev.some((t) => t.text === text)) return prev
      return [...prev, { id, text }]
    })
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, DURATION)
  }, [])

  useEffect(() => {
    _addToast = add
    return () => { _addToast = null }
  }, [add])

  if (toasts.length === 0) return null

  return (
    <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-[toast-in_200ms_ease-out] rounded-full border border-divider/30 bg-slate-800/90 px-4 py-2 text-[12px] font-medium text-white shadow-[0_4px_16px_rgba(0,0,0,0.2)] backdrop-blur-md"
        >
          {t.text}
        </div>
      ))}
    </div>
  )
}
