/**
 * Canonical toggle switch used by all floating popups.
 *
 * Replaces the two previously-forked implementations in
 * MapModeThumbnail.tsx (`Toggle`) and Toolbar.tsx (`ToggleSwitch`),
 * which had different sizes, different animation durations, and
 * different focus behavior.
 *
 * Size: 44×24 — meets the iOS HIG 44px touch target on the track
 * axis while staying visually compact on desktop.
 */

interface PopupToggleProps {
  checked: boolean
  onChange?: (next: boolean) => void
  /** When true, render as an aria-only switch (parent handles onClick) */
  readOnly?: boolean
  label?: string
  'aria-label'?: string
}

export default function PopupToggle({
  checked,
  onChange,
  readOnly = false,
  label,
  'aria-label': ariaLabel,
}: PopupToggleProps) {
  const track = (
    <span
      role={readOnly ? undefined : 'switch'}
      aria-checked={readOnly ? undefined : checked}
      aria-label={readOnly ? undefined : (ariaLabel ?? label)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full shadow-[inset_0_1px_2px_rgba(15,23,42,0.08)] transition-colors duration-150 ease-out ${
        checked ? 'bg-brand' : 'bg-slate-200'
      }`}
    >
      <span
        className={`pointer-events-none absolute left-0.5 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,0.22)] transition-transform duration-150 ease-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </span>
  )

  if (readOnly || !onChange) return track

  if (label) {
    return (
      <label className="flex min-h-11 cursor-pointer items-center justify-between rounded-xl px-1 py-1 transition-colors duration-150 active:bg-brand-hover">
        <span className="text-[12px] font-medium text-heading/88">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={ariaLabel ?? label}
          onClick={() => onChange(!checked)}
          className="focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/50"
        >
          {track}
        </button>
      </label>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="focus-visible:rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand/50"
    >
      {track}
    </button>
  )
}
