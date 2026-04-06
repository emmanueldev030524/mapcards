/* eslint-disable react-refresh/only-export-components */
import { create } from 'zustand'
import { useCallback, useEffect, useId, useRef } from 'react'
import { AlertTriangle, Info, AlertCircle } from 'lucide-react'

/* ── Dialog store (Promise-based) ── */

type DialogVariant = 'destructive' | 'info' | 'error'

interface DialogConfig {
  title: string
  message: string
  variant: DialogVariant
  confirmLabel?: string
  cancelLabel?: string
  /** If true, only show OK button (no cancel) — used for alerts */
  alert?: boolean
}

interface DialogState {
  open: boolean
  config: DialogConfig | null
  resolve: ((value: boolean) => void) | null
}

const useDialogStore = create<DialogState>(() => ({
  open: false,
  config: null,
  resolve: null,
}))

/** Show a confirm dialog. Returns a Promise<boolean>. */
export function showConfirm(
  title: string,
  message: string,
  options?: { variant?: DialogVariant; confirmLabel?: string; cancelLabel?: string },
): Promise<boolean> {
  return new Promise((resolve) => {
    useDialogStore.setState({
      open: true,
      config: {
        title,
        message,
        variant: options?.variant ?? 'destructive',
        confirmLabel: options?.confirmLabel,
        cancelLabel: options?.cancelLabel,
      },
      resolve,
    })
  })
}

/** Show an alert dialog (single OK button). Returns a Promise<void>. */
export function showAlert(
  title: string,
  message: string,
  options?: { variant?: DialogVariant },
): Promise<void> {
  return new Promise((resolve) => {
    useDialogStore.setState({
      open: true,
      config: {
        title,
        message,
        variant: options?.variant ?? 'error',
        alert: true,
      },
      resolve: () => resolve(),
    })
  })
}

/* ── Icon per variant ── */

const ICONS: Record<DialogVariant, { icon: typeof AlertTriangle; bg: string; color: string }> = {
  destructive: { icon: AlertTriangle, bg: 'bg-red-50', color: 'text-red-500' },
  info: { icon: Info, bg: 'bg-brand-tint', color: 'text-brand' },
  error: { icon: AlertCircle, bg: 'bg-red-50', color: 'text-red-500' },
}

/* ── Component ── */

export default function ConfirmDialog() {
  const { open, config, resolve } = useDialogStore()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()

  const handleClose = useCallback((result: boolean) => {
    useDialogStore.setState({ open: false })
    setTimeout(() => {
      resolve?.(result)
      useDialogStore.setState({ config: null, resolve: null })
    }, 150)
  }, [resolve])

  // Focus confirm/OK button when dialog opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => confirmRef.current?.focus())
    }
  }, [open])

  // Keyboard: Escape = cancel, Enter = confirm
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        handleClose(false)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [handleClose, open])

  if (!open || !config) return null

  const { title, message, variant, confirmLabel, cancelLabel, alert: isAlert } = config
  const { icon: Icon, bg, color } = ICONS[variant]

  const isDestructive = variant === 'destructive'

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/40 backdrop-blur-[6px] transition-opacity duration-150"
      onClick={() => handleClose(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        className="mx-4 w-full max-w-92 animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-slate-200/90 bg-white/98 p-6 shadow-[0_28px_56px_rgba(15,23,42,0.24),0_10px_24px_rgba(15,23,42,0.12)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/70 ${bg}`}>
          <Icon size={22} strokeWidth={2} className={color} />
        </div>

        {/* Title */}
        <h3 id={titleId} className="text-center text-base font-bold text-heading">{title}</h3>

        {/* Message */}
        <p id={messageId} className="mt-1.5 text-center text-[12px] leading-relaxed text-body/85">{message}</p>

        {/* Buttons — pill style consistent with app */}
        <div className={`mt-6 flex gap-2.5 border-t border-slate-200/75 pt-4 ${isAlert ? 'justify-center' : ''}`}>
          {!isAlert && (
            <button
              onClick={() => handleClose(false)}
              className="flex-1 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-[12px] font-semibold text-body transition-all duration-150 hover:bg-slate-50 active:scale-[0.95]"
            >
              {cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            ref={confirmRef}
            onClick={() => handleClose(true)}
            className={`flex-1 rounded-full px-5 py-2.5 text-[12px] font-semibold text-white transition-all duration-150 active:scale-[0.95] ${
              isDestructive || variant === 'error'
                ? 'bg-red-500 shadow-[0_8px_18px_rgba(239,68,68,0.24)] hover:bg-red-600'
                : 'bg-brand shadow-[0_8px_18px_rgba(75,108,167,0.24)] hover:bg-brand-dark'
            } ${isAlert ? 'max-w-40' : ''}`}
          >
            {confirmLabel || (isAlert ? 'OK' : isDestructive ? 'Delete' : 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
