import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  findTooltipTargetById,
  getTooltipTargetId,
  readTooltipAttrs,
  TOOLTIP_TIMING,
  TOOLTIP_SELECTOR,
  TOOLTIP_MODAL_ATTR,
  type TooltipContent,
} from '../lib/tooltips'

interface TooltipState extends TooltipContent {
  anchorLeft: number
  arrowOffset: number
  instanceKey: number
  isPositioned: boolean
  left: number
  top: number
  placement: 'top' | 'bottom'
  targetId: string | null
}

const TOOLTIP_ID = 'app-helper-tooltip'
const TOOLTIP_EXCLUSION_SELECTOR = '[data-tooltip-exclusion]'

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function resolveTooltipTarget(node: EventTarget | null): HTMLElement | null {
  if (!(node instanceof Element)) return null
  const target = node.closest<HTMLElement>(TOOLTIP_SELECTOR)
  if (!(target instanceof HTMLElement)) return null

  // When a modal tooltip surface is open (e.g. basemap panel), only allow
  // tooltip targets that live inside it — suppress all background tooltips.
  const modalScope = document.querySelector<HTMLElement>(`[${TOOLTIP_MODAL_ATTR}]`)
  if (modalScope && !modalScope.contains(target)) return null

  return target
}

function getSafeMargin() {
  return clamp(Math.round(Math.min(window.innerWidth, window.innerHeight) * 0.02), 12, 24)
}

function expandRect(rect: DOMRect, amount: number) {
  return {
    left: rect.left - amount,
    right: rect.right + amount,
    top: rect.top - amount,
    bottom: rect.bottom + amount,
  }
}

function rectsOverlap(a: { left: number; right: number; top: number; bottom: number }, b: { left: number; right: number; top: number; bottom: number }) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

function computeTooltipPosition(target: HTMLElement, tooltipEl: HTMLElement) {
  const targetRect = target.getBoundingClientRect()
  const tooltipWidth = tooltipEl.offsetWidth
  const tooltipHeight = tooltipEl.offsetHeight
  const safeMargin = getSafeMargin()
  const anchorGap = 8
  const exclusionGap = Math.max(6, Math.min(12, Math.round(safeMargin * 0.75)))
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const targetCenterX = targetRect.left + targetRect.width / 2

  const spaceAbove = targetRect.top - safeMargin
  const spaceBelow = viewportHeight - targetRect.bottom - safeMargin
  let placement: TooltipState['placement'] =
    spaceAbove >= tooltipHeight + anchorGap || spaceAbove >= spaceBelow ? 'top' : 'bottom'

  let top =
    placement === 'top'
      ? targetRect.top - anchorGap
      : targetRect.bottom + anchorGap

  if (placement === 'top' && top - tooltipHeight < safeMargin && spaceBelow > spaceAbove) {
    placement = 'bottom'
    top = targetRect.bottom + anchorGap
  } else if (placement === 'bottom' && top + tooltipHeight > viewportHeight - safeMargin && spaceAbove > spaceBelow) {
    placement = 'top'
    top = targetRect.top - anchorGap
  }

  const bandTop =
    placement === 'top'
      ? clamp(top - tooltipHeight, safeMargin, viewportHeight - safeMargin - tooltipHeight)
      : clamp(top, safeMargin, viewportHeight - safeMargin - tooltipHeight)
  const bandBottom = bandTop + tooltipHeight

  let minCenter = safeMargin + tooltipWidth / 2
  let maxCenter = viewportWidth - safeMargin - tooltipWidth / 2

  const verticalBand = {
    left: -Infinity,
    right: Infinity,
    top: bandTop,
    bottom: bandBottom,
  }

  const exclusionRects = Array.from(document.querySelectorAll<HTMLElement>(TOOLTIP_EXCLUSION_SELECTOR))
    .filter((el) => el !== tooltipEl && !el.contains(tooltipEl) && el !== target && !el.contains(target))
    .map((el) => expandRect(el.getBoundingClientRect(), exclusionGap))
    .filter((rect) => rectsOverlap(verticalBand, rect))

  for (const exclusion of exclusionRects) {
    const preferRightCenter = exclusion.right + tooltipWidth / 2
    const preferLeftCenter = exclusion.left - tooltipWidth / 2

    if (targetRect.left >= exclusion.right - exclusionGap || targetCenterX >= exclusion.right) {
      minCenter = Math.max(minCenter, preferRightCenter)
      continue
    }

    if (targetRect.right <= exclusion.left + exclusionGap || targetCenterX <= exclusion.left) {
      maxCenter = Math.min(maxCenter, preferLeftCenter)
      continue
    }

    const canPlaceRight = preferRightCenter <= viewportWidth - safeMargin - tooltipWidth / 2
    const canPlaceLeft = preferLeftCenter >= safeMargin + tooltipWidth / 2

    if (canPlaceRight && (!canPlaceLeft || Math.abs(preferRightCenter - targetCenterX) <= Math.abs(preferLeftCenter - targetCenterX))) {
      minCenter = Math.max(minCenter, preferRightCenter)
    } else if (canPlaceLeft) {
      maxCenter = Math.min(maxCenter, preferLeftCenter)
    }
  }

  if (minCenter > maxCenter) {
    minCenter = safeMargin + tooltipWidth / 2
    maxCenter = viewportWidth - safeMargin - tooltipWidth / 2
  }

  const left = clamp(targetCenterX, minCenter, maxCenter)
  const arrowOffset = clamp(targetCenterX - (left - tooltipWidth / 2), 10, tooltipWidth - 10)

  return {
    anchorLeft: targetCenterX,
    arrowOffset,
    left,
    top:
      placement === 'top'
        ? bandTop + tooltipHeight
        : bandTop,
    placement,
  }
}

export default function TooltipProvider() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const tooltipRef = useRef<TooltipState | null>(null)
  const tooltipElRef = useRef<HTMLDivElement>(null)
  const activeTargetRef = useRef<HTMLElement | null>(null)
  const activeTargetIdRef = useRef<string | null>(null)
  const describedByRef = useRef<string | null>(null)
  const hoverTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const repositionFrameRef = useRef<number | null>(null)
  const tooltipInstanceRef = useRef(0)

  const clearQueuedReposition = useCallback(() => {
    if (repositionFrameRef.current !== null) {
      window.cancelAnimationFrame(repositionFrameRef.current)
      repositionFrameRef.current = null
    }
  }, [])

  const resolveActiveTarget = useCallback(() => {
    if (activeTargetRef.current?.isConnected) return activeTargetRef.current
    if (!activeTargetIdRef.current) return null
    const nextTarget = findTooltipTargetById(activeTargetIdRef.current)
    activeTargetRef.current = nextTarget
    return nextTarget
  }, [])

  const syncTooltipPosition = useCallback(() => {
    const target = resolveActiveTarget()
    const tooltipEl = tooltipElRef.current
    const currentTooltip = tooltipRef.current
    if (!target || !tooltipEl || !currentTooltip) return

    const nextPosition = computeTooltipPosition(target, tooltipEl)
    if (
      currentTooltip.anchorLeft !== nextPosition.anchorLeft ||
      currentTooltip.arrowOffset !== nextPosition.arrowOffset ||
      !currentTooltip.isPositioned ||
      currentTooltip.left !== nextPosition.left ||
      currentTooltip.top !== nextPosition.top ||
      currentTooltip.placement !== nextPosition.placement
    ) {
      const nextTooltip = { ...currentTooltip, ...nextPosition, isPositioned: true }
      tooltipRef.current = nextTooltip
      setTooltip(nextTooltip)
    }
  }, [resolveActiveTarget])

  const queueTooltipPositionSync = useCallback(() => {
    if (repositionFrameRef.current !== null) window.cancelAnimationFrame(repositionFrameRef.current)
    repositionFrameRef.current = window.requestAnimationFrame(() => {
      repositionFrameRef.current = null
      syncTooltipPosition()
    })
  }, [syncTooltipPosition])

  useEffect(() => {
    if (typeof document === 'undefined') return

    const clearHoverTimer = () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
    }

    const clearHideTimer = () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current)
        hideTimerRef.current = null
      }
    }

    const clearLongPressTimer = () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    const restoreDescribedBy = () => {
      const activeTarget = resolveActiveTarget()
      if (!activeTarget) return

      const previous = describedByRef.current
      if (previous) activeTarget.setAttribute('aria-describedby', previous)
      else activeTarget.removeAttribute('aria-describedby')

      activeTargetRef.current = null
      activeTargetIdRef.current = null
      describedByRef.current = null
    }

    const hideTooltip = () => {
      clearHoverTimer()
      clearLongPressTimer()
      clearHideTimer()
      clearQueuedReposition()
      restoreDescribedBy()
      tooltipRef.current = null
      setTooltip(null)
    }

    const hideTooltipSoon = () => {
      clearHideTimer()
      hideTimerRef.current = window.setTimeout(() => {
        hideTooltip()
      }, TOOLTIP_TIMING.hideDelayMs)
    }

    const scheduleTooltipShow = (target: HTMLElement, immediate = false) => {
      clearHoverTimer()
      clearHideTimer()

      if (immediate) {
        showTooltip(target)
        return
      }

      hoverTimerRef.current = window.setTimeout(() => {
        showTooltip(target)
      }, TOOLTIP_TIMING.showDelayMs)
    }

    const showTooltip = (target: HTMLElement) => {
      clearHoverTimer()
      clearHideTimer()
      clearLongPressTimer()

      // Re-check modal scope: the target may have been resolved before a
      // modal surface appeared (e.g. during the show-delay timer).
      const modalScope = document.querySelector<HTMLElement>(`[${TOOLTIP_MODAL_ATTR}]`)
      if (modalScope && !modalScope.contains(target)) {
        hideTooltip()
        return
      }

      const content = readTooltipAttrs(target)
      if (!content) {
        hideTooltip()
        return
      }

      const nextTargetId = getTooltipTargetId(target)
      const targetChanged =
        activeTargetRef.current !== target ||
        tooltipRef.current?.targetId !== nextTargetId

      if (activeTargetRef.current !== target) {
        restoreDescribedBy()
        describedByRef.current = target.getAttribute('aria-describedby')
        const describedBy = describedByRef.current
        if (!describedBy) target.setAttribute('aria-describedby', TOOLTIP_ID)
        else if (!describedBy.split(/\s+/).includes(TOOLTIP_ID)) target.setAttribute('aria-describedby', `${describedBy} ${TOOLTIP_ID}`)
        activeTargetRef.current = target
      }

      activeTargetIdRef.current = nextTargetId

      if (targetChanged) {
        clearQueuedReposition()
        tooltipInstanceRef.current += 1
      }

      const initialPosition = {
        anchorLeft: target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2,
        arrowOffset: 0,
        left: clamp(
          target.getBoundingClientRect().left + target.getBoundingClientRect().width / 2,
          getSafeMargin(),
          window.innerWidth - getSafeMargin(),
        ),
        top: target.getBoundingClientRect().bottom + 8,
        placement: 'bottom' as const,
      }
      const nextTooltip = {
        ...content,
        ...initialPosition,
        instanceKey: tooltipInstanceRef.current,
        isPositioned: false,
        targetId: activeTargetIdRef.current,
      }
      tooltipRef.current = nextTooltip
      setTooltip(nextTooltip)
    }

    const onMouseOver = (event: MouseEvent) => {
      const target = resolveTooltipTarget(event.target)
      if (!target) return
      if (target === activeTargetRef.current && tooltipRef.current) return
      scheduleTooltipShow(target, tooltipRef.current !== null)
    }

    const onMouseOut = (event: MouseEvent) => {
      const leaving = resolveTooltipTarget(event.target)
      if (!leaving) return
      const entering = resolveTooltipTarget(event.relatedTarget)
      if (leaving === entering) return
      if (entering) {
        // Switching directly between toolbar triggers should rebind immediately;
        // the old hide/show timers made the tooltip visibly wobble between items.
        scheduleTooltipShow(entering, tooltipRef.current !== null)
        return
      }
      hideTooltipSoon()
    }

    const onFocusIn = (event: FocusEvent) => {
      const target = resolveTooltipTarget(event.target)
      if (!target) return
      showTooltip(target)
    }

    const onFocusOut = (event: FocusEvent) => {
      const leaving = resolveTooltipTarget(event.target)
      if (!leaving) return
      const entering = resolveTooltipTarget(event.relatedTarget)
      if (leaving === entering) return
      hideTooltip()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return
      const target = resolveTooltipTarget(event.target)
      if (!target) return
      clearLongPressTimer()
      longPressTimerRef.current = window.setTimeout(() => {
        showTooltip(target)
      }, TOOLTIP_TIMING.longPressDelayMs)
    }

    const onPointerMove = () => {
      clearLongPressTimer()
    }

    const onPointerRelease = () => {
      clearLongPressTimer()
      if (tooltipRef.current) hideTooltipSoon()
    }

    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mouseout', onMouseOut, true)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerRelease, true)
    document.addEventListener('pointercancel', onPointerRelease, true)

    // When a modal tooltip scope appears (React mount or imperative attribute
    // toggle), immediately dismiss any active tooltip whose target is outside
    // the new scope. Without this, a tooltip already visible on a background
    // control would linger until the next mouseout.
    const modalObserver = new MutationObserver(() => {
      const modalScope = document.querySelector<HTMLElement>(`[${TOOLTIP_MODAL_ATTR}]`)
      if (!modalScope) return
      const target = resolveActiveTarget()
      // Dismiss if the target is outside the modal scope, OR if the target
      // is gone (disconnected/unmounted) — an orphaned tooltip with no
      // target should not linger over the new modal surface.
      if (!target || !modalScope.contains(target)) {
        hideTooltip()
      }
    })
    // Scope observer to the React app root rather than document.body
    // to avoid firing on MapLibre's internal tile DOM mutations.
    const observeRoot = document.getElementById('root') || document.body
    modalObserver.observe(observeRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [TOOLTIP_MODAL_ATTR],
    })

    return () => {
      clearHoverTimer()
      clearHideTimer()
      clearLongPressTimer()
      clearQueuedReposition()
      restoreDescribedBy()
      modalObserver.disconnect()
      document.removeEventListener('mouseover', onMouseOver, true)
      document.removeEventListener('mouseout', onMouseOut, true)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerRelease, true)
      document.removeEventListener('pointercancel', onPointerRelease, true)
    }
  }, [clearQueuedReposition, resolveActiveTarget])

  const hasTooltip = tooltip !== null
  const tooltipTargetId = tooltip?.targetId ?? null
  useLayoutEffect(() => {
    if (!hasTooltip) return

    // Measure immediately on mount/target switch so the arrow offset is final
    // before paint; deferring this to rAF left a visible one-frame catch-up.
    syncTooltipPosition()

    const target = resolveActiveTarget()
    const tooltipEl = tooltipElRef.current
    if (!target || !tooltipEl) return

    const resizeObserver = new ResizeObserver(() => {
      queueTooltipPositionSync()
    })
    resizeObserver.observe(tooltipEl)
    resizeObserver.observe(target)

    const toolbar = target.closest<HTMLElement>('[role="toolbar"]')
    if (toolbar) resizeObserver.observe(toolbar)

    const onLayoutChange = () => {
      queueTooltipPositionSync()
    }

    document.addEventListener('scroll', onLayoutChange, true)
    window.addEventListener('resize', onLayoutChange)
    window.addEventListener('orientationchange', onLayoutChange)
    window.visualViewport?.addEventListener('resize', onLayoutChange)
    window.visualViewport?.addEventListener('scroll', onLayoutChange)

    return () => {
      resizeObserver.disconnect()
      document.removeEventListener('scroll', onLayoutChange, true)
      window.removeEventListener('resize', onLayoutChange)
      window.removeEventListener('orientationchange', onLayoutChange)
      window.visualViewport?.removeEventListener('resize', onLayoutChange)
      window.visualViewport?.removeEventListener('scroll', onLayoutChange)
      clearQueuedReposition()
    }
  }, [clearQueuedReposition, hasTooltip, queueTooltipPositionSync, resolveActiveTarget, syncTooltipPosition, tooltipTargetId])

  if (!tooltip) return null

  return createPortal(
    <div
      key={tooltip.instanceKey}
      ref={tooltipElRef}
      className={`pointer-events-none fixed z-[120] -translate-x-1/2 ${
        tooltip.placement === 'top' ? '-translate-y-full' : ''
      }`}
      style={{
        left: tooltip.left,
        opacity: tooltip.isPositioned ? 1 : 0,
        top: tooltip.top,
        transitionProperty: 'opacity',
        transitionDuration: `${TOOLTIP_TIMING.transitionDurationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      <div className="relative">
        {tooltip.placement === 'bottom' && (
          <div
            aria-hidden="true"
            className="absolute top-0 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-l border-t border-slate-800/72 bg-slate-950/92 shadow-[0_4px_10px_rgba(15,23,42,0.16)]"
            style={{ left: tooltip.arrowOffset - 5 }}
          />
        )}
        <div
          id={TOOLTIP_ID}
          role="tooltip"
          className="max-w-[12rem] rounded-lg border border-slate-800/72 bg-slate-950/92 px-2.5 py-1.5 text-[10.5px] font-medium leading-tight text-white shadow-[0_10px_22px_rgba(15,23,42,0.22)] backdrop-blur-sm"
        >
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            {tooltip.label}
            {tooltip.shortcut && (
              <kbd className="rounded bg-white/14 px-1.5 py-px text-[9.5px] font-medium tracking-wide text-white/70">
                {tooltip.shortcut}
              </kbd>
            )}
          </span>
        </div>
        {tooltip.placement === 'top' && (
          <div
            aria-hidden="true"
            className="absolute bottom-0 h-2.5 w-2.5 translate-y-1/2 rotate-45 border-r border-b border-slate-800/72 bg-slate-950/92 shadow-[0_4px_10px_rgba(15,23,42,0.16)]"
            style={{ left: tooltip.arrowOffset - 5 }}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
