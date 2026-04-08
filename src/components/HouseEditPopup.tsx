import { useCallback, useRef, useState, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useStore } from '../store'
import { PIN_CATEGORIES } from '../lib/mapPins'
import type { PinCategory } from '../lib/mapPins'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  popupContainer,
  popupHeader,
  popupHeaderTitle,
  popupHeaderSubtitle,
  popupBody,
  popupSection,
  popupSectionLabel,
  popupSectionHelp,
  popupInput,
  popupTileBase,
} from '../lib/popupStyles'
import PopupCloseButton from './PopupCloseButton'

/**
 * Renders the SVG icon from a PinCategory at the given size.
 * Safe: iconPaths are hardcoded string literals from mapPins.ts, not user input.
 */
function CategoryIcon({ cat, size = 16, className }: { cat: PinCategory; size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      className={className}
      dangerouslySetInnerHTML={{ __html: cat.iconPaths }}
    />
  )
}

interface HouseEditPopupProps {
  map: maplibregl.Map | null
}

export default function HouseEditPopup({ map }: HouseEditPopupProps) {
  const selectedId = useStore((s) => s.selectedHouseId)
  const housePoints = useStore((s) => s.housePoints)
  const updateLabel = useStore((s) => s.updateHouseLabel)
  const toggleTag = useStore((s) => s.toggleHouseTag)
  const removeHouse = useStore((s) => s.removeHousePoint)
  const setSelected = useStore((s) => s.setSelectedHouseId)

  const [swipeY, setSwipeY] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const touchStartY = useRef(0)
  const popupRef = useRef<HTMLDivElement>(null)
  const isPhone = useMediaQuery('(max-width: 767px)')
  const isTouch = typeof window !== 'undefined' && 'ontouchstart' in window

  // Track keyboard visibility via visualViewport API (iOS Safari)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !isTouch) return
    const onResize = () => {
      // If visual viewport is significantly shorter than layout viewport, keyboard is open
      setKeyboardOpen(window.innerHeight - vv.height > 100)
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [isTouch])

  const house = selectedId ? housePoints.find((p) => p.id === selectedId) : null
  const houseIndex = house ? housePoints.indexOf(house) + 1 : 0

  const handleDelete = useCallback(() => {
    if (selectedId) {
      removeHouse(selectedId)
      setSelected(null)
    }
  }, [selectedId, removeHouse, setSelected])

  const [floatingLayout, setFloatingLayout] = useState<{ left: number; top: number }>({ left: 16, top: 88 })

  const updateFloatingLayout = useCallback(() => {
    if (isPhone || !house || !map || !popupRef.current) return

    const mapContainer = map.getContainer()
    const containerRect = mapContainer.getBoundingClientRect()
    const popupRect = popupRef.current.getBoundingClientRect()
    const point = map.project(house.geometry.coordinates as [number, number])
    const viewportWidth = mapContainer.clientWidth
    const viewportHeight = mapContainer.clientHeight
    const popupWidth = popupRect.width
    const popupHeight = popupRect.height
    const viewportPadding = Math.max(12, Math.min(24, Math.round(Math.min(viewportWidth, viewportHeight) * 0.02)))
    const toolbarGap = Math.max(8, Math.min(16, Math.round(viewportPadding * 0.75)))
    const horizontalOffset = Math.max(16, Math.min(28, Math.round(viewportWidth * 0.02)))
    const preferredLeft = point.x + horizontalOffset
    const markerVisualCenterY = point.y - Math.max(10, Math.min(16, Math.round(viewportHeight * 0.018)))
    const preferredTop = markerVisualCenterY - popupHeight / 2
    const topSafeElements = Array.from(document.querySelectorAll<HTMLElement>('[data-popup-safe-top="true"]'))
    const highestBlockingBottom = topSafeElements.reduce((maxBottom, el) => {
      if (popupRef.current?.contains(el)) return maxBottom
      const rect = el.getBoundingClientRect()
      const overlapsMapHorizontally = rect.right > containerRect.left && rect.left < containerRect.right
      if (!overlapsMapHorizontally) return maxBottom
      const bottomInMap = rect.bottom - containerRect.top
      return Math.max(maxBottom, bottomInMap)
    }, viewportPadding)
    const topSafeZone = Math.max(viewportPadding, highestBlockingBottom + toolbarGap)
    const bottomSafeZone = viewportPadding
    const maxTop = Math.max(topSafeZone, viewportHeight - bottomSafeZone - popupHeight)
    const maxLeft = Math.max(viewportPadding, viewportWidth - viewportPadding - popupWidth)
    const clampedLeft = Math.min(maxLeft, Math.max(viewportPadding, preferredLeft))
    const clampedTop = Math.min(maxTop, Math.max(topSafeZone, preferredTop))

    const controlsGap = Math.max(8, Math.min(18, Math.round(viewportPadding)))
    const controlsContainer = mapContainer.querySelector<HTMLElement>('.maplibregl-ctrl-bottom-right')
    let adjustedTop = clampedTop

    if (controlsContainer) {
      const controlsRect = controlsContainer.getBoundingClientRect()
      const protectedRect = {
        left: controlsRect.left - containerRect.left - controlsGap,
        top: controlsRect.top - containerRect.top - controlsGap,
        right: controlsRect.right - containerRect.left + controlsGap,
        bottom: controlsRect.bottom - containerRect.top + controlsGap,
      }
      const popupBounds = {
        left: clampedLeft,
        top: clampedTop,
        right: clampedLeft + popupWidth,
        bottom: clampedTop + popupHeight,
      }
      const overlapsControls = (
        popupBounds.left < protectedRect.right &&
        popupBounds.right > protectedRect.left &&
        popupBounds.top < protectedRect.bottom &&
        popupBounds.bottom > protectedRect.top
      )

      if (overlapsControls) {
        const liftedTop = protectedRect.top - popupHeight - controlsGap
        adjustedTop = Math.min(maxTop, Math.max(topSafeZone, liftedTop))
      }
    }

    const nextLayout = {
      left: clampedLeft,
      top: adjustedTop,
    }

    setFloatingLayout((current) => (
      Math.abs(current.left - nextLayout.left) < 1 && Math.abs(current.top - nextLayout.top) < 1
        ? current
        : nextLayout
    ))
  }, [house, isPhone, map])

  useEffect(() => {
    if (isPhone || !house || !map || !popupRef.current) return

    updateFloatingLayout()

    const handleMove = () => updateFloatingLayout()
    const resizeObserver = new ResizeObserver(() => updateFloatingLayout())
    resizeObserver.observe(map.getContainer())
    resizeObserver.observe(popupRef.current)
    map.on('move', handleMove)

    return () => {
      resizeObserver.disconnect()
      map.off('move', handleMove)
    }
  }, [house, isPhone, map, updateFloatingLayout])

  if (!house) return null

  const tags = house.properties.tags || []
  const placeCats = PIN_CATEGORIES

  const mobileTopInset = 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))'
  const mobileControlClearance = 'calc(var(--map-control-size) + var(--map-control-edge-offset-y) + env(safe-area-inset-bottom, 0px) + 3rem)'
  const mobileKeyboardInset = keyboardOpen ? 'max(0px, calc(100dvh - 100svh))' : '0px'
  const mobileMaxHeight = `calc(100dvh - ${mobileTopInset} - ${mobileControlClearance} - ${mobileKeyboardInset})`

  return (
    <div
      className={isPhone
        ? 'absolute left-1/2 z-10 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 px-2 sm:w-auto sm:max-w-none sm:px-0 transition-[top,bottom] duration-200'
        : 'absolute z-10 transition-[left,top] duration-200 ease-out'}
      style={isPhone
        ? {
            top: 'auto',
            bottom: mobileControlClearance,
          }
        : floatingLayout}
    >
      <div
        ref={popupRef}
        className={`${popupContainer} hover-lift w-full sm:w-88`}
        onTouchStart={(e) => {
          touchStartY.current = e.touches[0].clientY
          setSwiping(true)
        }}
        onTouchMove={(e) => {
          const dy = e.touches[0].clientY - touchStartY.current
          if (dy > 0) setSwipeY(dy) // only track downward swipe
        }}
        onTouchEnd={() => {
          if (swipeY > 60) {
            setSelected(null) // dismiss
          }
          setSwipeY(0)
          setSwiping(false)
        }}
        style={{
          maxHeight: isPhone ? mobileMaxHeight : undefined,
          overflowY: isPhone ? 'auto' : undefined,
          overscrollBehavior: isPhone ? 'contain' : undefined,
          transform: swipeY > 0 ? `translateY(${swipeY}px)` : undefined,
          opacity: swipeY > 0 ? Math.max(0.3, 1 - swipeY / 150) : undefined,
          transition: swiping ? 'none' : 'transform 250ms ease, opacity 250ms ease',
        }}
      >
        {/* Drag handle — swipe down to dismiss */}
        <div className="flex justify-center pt-2 pb-0.5">
          <div className="h-1 w-9 rounded-full bg-slate-300/90 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55)]" />
        </div>

        {/* Header */}
        <div className={popupHeader}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand text-[11px] font-bold text-white shadow-[0_6px_14px_rgba(75,108,167,0.26)] ring-1 ring-white/30">
              {houseIndex}
            </span>
            <div className="min-w-0">
              <p className={popupHeaderTitle}>House #{houseIndex}</p>
              <p className={popupHeaderSubtitle}>Selected map marker</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={handleDelete}
              aria-label="Delete house"
              className="btn-press rounded-full border border-rose-200/60 bg-rose-50/75 px-3 py-1.5 text-[11px] font-semibold text-rose-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition-all duration-150 hover:border-rose-300/75 hover:bg-rose-100/85 hover:text-rose-700 focus-visible:ring-2 focus-visible:ring-rose-300/70 focus-visible:outline-none"
            >
              Delete
            </button>
            <PopupCloseButton
              onClick={() => setSelected(null)}
            />
          </div>
        </div>

        {/* Body */}
        <div className={popupBody}>
          {/* Label */}
          <div className={popupSection}>
            <label className={popupSectionLabel}>Name</label>
            <input
              type="text"
              value={house.properties.label || ''}
              aria-label="House name"
              onChange={(e) => updateLabel(house.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelected(null) }}
              placeholder="e.g. Gallardo Family"
              autoFocus={!isTouch}
              className={popupInput}
            />
          </div>

          {/* Place type — icon tiles */}
          <div className={popupSection}>
            <label className={popupSectionLabel}>Place Type</label>
            <p className={popupSectionHelp}>
              Choose one or more place types to tint the house icon and improve legend output.
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(3.9rem,1fr))] gap-2">
              {placeCats.map((cat) => {
                const active = tags.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleTag(house.id, cat.id)}
                    aria-pressed={active}
                    aria-label={`${active ? 'Remove' : 'Apply'} place type ${cat.label}`}
                    title={cat.label}
                    className={`${popupTileBase} min-h-20 ${
                      active
                        ? '-translate-y-px border-white/20 shadow-[0_14px_26px_rgba(15,23,42,0.16),inset_0_1px_0_rgba(255,255,255,0.25)] ring-1 ring-inset ring-white/15'
                        : ''
                    }`}
                    style={active ? {
                      backgroundColor: cat.color,
                      boxShadow: '0 14px 28px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.22)',
                    } : undefined}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-xl transition-all duration-150"
                      style={{
                        backgroundColor: active ? 'rgba(255,255,255,0.18)' : cat.color + '15',
                      }}
                    >
                      <CategoryIcon
                        cat={{
                          ...cat,
                          // Recolor icon strokes/fills for inactive state
                          iconPaths: active
                            ? cat.iconPaths
                            : cat.iconPaths
                                .replace(/stroke="#fff"/g, `stroke="${cat.color}"`)
                                .replace(/fill="#fff"/g, `fill="${cat.color}"`)
                                .replace(/fill="rgba\(255,255,255,0\.9\)"/g, `fill="${cat.color}"`)
                        }}
                        size={14}
                      />
                    </span>
                    <span className={`flex min-h-[1.9rem] wrap-break-word items-center justify-center text-[8.5px] font-semibold leading-[1.15] ${
                      active ? 'text-white' : 'text-body/80'
                    }`}>
                      {cat.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
