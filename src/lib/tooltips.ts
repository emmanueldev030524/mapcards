export interface TooltipContent {
  label: string
  description?: string
  shortcut?: string
}

export const TOOLTIP_ATTR = 'data-tooltip'
export const TOOLTIP_DESC_ATTR = 'data-tooltip-description'
export const TOOLTIP_SHORTCUT_ATTR = 'data-tooltip-shortcut'
export const TOOLTIP_TARGET_ID_ATTR = 'data-tooltip-id'
export const TOOLTIP_MODAL_ATTR = 'data-tooltip-modal'
export const TOOLTIP_SELECTOR = `[${TOOLTIP_ATTR}]`
export const TOOLTIP_TIMING = {
  showDelayMs: 30,
  hideDelayMs: 70,
  longPressDelayMs: 350,
  transitionDurationMs: 120,
} as const

export function tooltipAttrs({ label, description, shortcut }: TooltipContent) {
  return {
    [TOOLTIP_ATTR]: label,
    ...(description ? { [TOOLTIP_DESC_ATTR]: description } : {}),
    ...(shortcut ? { [TOOLTIP_SHORTCUT_ATTR]: shortcut } : {}),
  }
}

export function tooltipTargetAttrs(id: string) {
  return {
    [TOOLTIP_TARGET_ID_ATTR]: id,
  }
}

export function applyTooltipAttrs(element: HTMLElement, content: TooltipContent) {
  element.setAttribute(TOOLTIP_ATTR, content.label)
  if (content.description) {
    element.setAttribute(TOOLTIP_DESC_ATTR, content.description)
  } else {
    element.removeAttribute(TOOLTIP_DESC_ATTR)
  }

  if (content.shortcut) {
    element.setAttribute(TOOLTIP_SHORTCUT_ATTR, content.shortcut)
  } else {
    element.removeAttribute(TOOLTIP_SHORTCUT_ATTR)
  }

  element.removeAttribute('title')
}

export function readTooltipAttrs(element: HTMLElement): TooltipContent | null {
  const label = element.getAttribute(TOOLTIP_ATTR)?.trim()
  if (!label) return null

  const description = element.getAttribute(TOOLTIP_DESC_ATTR)?.trim() || undefined
  const shortcut = element.getAttribute(TOOLTIP_SHORTCUT_ATTR)?.trim() || undefined
  return { label, description, shortcut }
}

export function getTooltipTargetId(element: HTMLElement): string | null {
  return element.getAttribute(TOOLTIP_TARGET_ID_ATTR)?.trim() || null
}

export function findTooltipTargetById(id: string): HTMLElement | null {
  if (typeof document === 'undefined') return null
  return document.querySelector<HTMLElement>(`[${TOOLTIP_TARGET_ID_ATTR}="${CSS.escape(id)}"]`)
}
