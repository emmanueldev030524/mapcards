/**
 * Shared popup design system.
 *
 * All floating popups (Basemap, House Editor, Settings) compose these
 * class-name tokens so they share a single visual DNA: same glass
 * container, same header typography, same section panels, same input
 * and control styling, same ~150ms interaction timing.
 *
 * Rule: DO NOT fork these values inside individual popup files. If a
 * popup genuinely needs a variation, add a new semantic token here and
 * give it a clear name.
 */

// ── Container ────────────────────────────────────────────────────
// Layered glass with three-tier elevation shadow. Matches the floating
// toolbar's glass language so popups feel like the same system.
export const popupContainer = [
  'overflow-hidden',
  'rounded-2xl',
  'border border-white/65',
  'bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(248,250,252,0.86))]',
  'shadow-[0_24px_52px_-12px_rgba(15,23,42,0.24),0_10px_24px_-8px_rgba(15,23,42,0.14),0_2px_6px_-1px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.95)]',
  'backdrop-blur-[24px] backdrop-saturate-150',
  'animate-[dialog-in_200ms_cubic-bezier(0.34,1.56,0.64,1)]',
].join(' ')

// ── Header ───────────────────────────────────────────────────────
// Semi-transparent title strip with bottom divider. Uses the same
// inner-gradient language as the popup body for material continuity.
export const popupHeader =
  'flex shrink-0 items-start justify-between gap-3 border-b border-slate-200/60 bg-[linear-gradient(180deg,rgba(248,250,252,0.82),rgba(241,245,249,0.56))] px-4 py-3.5'

export const popupHeaderTitle = 'text-[14px] font-bold tracking-[-0.005em] text-heading'
export const popupHeaderSubtitle = 'mt-0.5 text-[11px] leading-relaxed text-body/72'

// ── Close button ─────────────────────────────────────────────────
// Desktop 32×32, tablet 36×36. Uses btn-press for consistent
// press-scale animation shared with the toolbar.
export const popupCloseButton =
  'btn-press inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/70 bg-white/82 p-0 text-slate-500 shadow-[0_1px_3px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.8)] transition-all duration-150 hover:border-slate-300/85 hover:bg-white hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none'

export const popupCloseButtonTablet = popupCloseButton.replace('h-8 w-8', 'h-9 w-9')

// ── Body wrapper ─────────────────────────────────────────────────
// Vertical rhythm between sections. 14px gap keeps sections visually
// distinct without feeling sparse.
export const popupBody = 'space-y-3.5 px-4 py-3.5'
export const popupBodyScrollable = `${popupBody} overflow-y-auto overscroll-contain`

// ── Section panel ────────────────────────────────────────────────
// Inset card inside the body. Used by House Editor and Basemap for
// grouping related controls. Settings/Toolbar uses its own
// `popupSectionFlat` variant for multi-slider clusters.
export const popupSection =
  'rounded-2xl border border-slate-200/55 bg-white/55 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_2px_rgba(15,23,42,0.03)]'

// Flatter variant for densely-packed slider groups (Settings).
export const popupSectionFlat =
  'rounded-2xl border border-slate-200/55 bg-white/50 px-3.5 py-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]'

export const popupSectionLabel =
  'mb-2 block text-[10px] font-semibold uppercase tracking-[0.08em] text-heading/80'
export const popupSectionHelp =
  'mb-2.5 text-[11px] leading-relaxed text-body/70'

// Thin rule between sub-rows inside a section (e.g. slider groups).
export const popupSectionDivider = 'border-t border-slate-200/55'

// ── Value badge (slider percentage, etc.) ────────────────────────
export const popupValueBadge =
  'min-h-7 rounded-full bg-brand-tint px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-brand transition-all duration-150 hover:bg-brand/15 active:scale-95'

// ── Secondary action button ──────────────────────────────────────
// Pill action used for lightweight popup actions such as reset.
export const popupSecondaryButton =
  'btn-press inline-flex min-h-9 items-center justify-center rounded-full border border-brand/12 bg-brand/6 px-3.5 py-2 text-[12px] font-semibold text-brand shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] transition-all duration-150 hover:bg-brand/12 hover:text-brand-light focus-visible:ring-2 focus-visible:ring-brand/35 focus-visible:outline-none'

// ── Input field ──────────────────────────────────────────────────
// Shares the gradient/inset/focus-ring language with the location
// search input in the toolbar.
export const popupInput =
  'w-full rounded-xl border border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-3 py-2.5 text-[13px] font-medium text-heading shadow-[inset_0_1px_2px_rgba(15,23,42,0.04),0_1px_0_rgba(255,255,255,0.7)] outline-none transition-all duration-150 placeholder:text-body/60 hover:border-slate-300/85 hover:bg-white focus:border-brand/55 focus:bg-white focus:shadow-[0_0_0_3px_rgba(75,108,167,0.16),0_4px_12px_rgba(75,108,167,0.1),inset_0_1px_2px_rgba(15,23,42,0.02)]'

// ── Row label (slider row, toggle row) ──────────────────────────
export const popupRowLabel = 'text-[12px] font-medium text-heading/88'

// ── Selectable tile (place-type picker, map-type picker) ─────────
// Base = neutral glass card. Add a `data-active` or computed active
// class separately for the selected state (colored fill + lift).
export const popupTileBase =
  'btn-press flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(248,250,252,0.9))] px-1.5 py-2 text-center shadow-[0_4px_10px_rgba(15,23,42,0.04),inset_0_1px_0_rgba(255,255,255,0.85)] transition-all duration-150 hover:-translate-y-px hover:border-slate-300/85 hover:bg-white hover:shadow-[0_8px_16px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]'
