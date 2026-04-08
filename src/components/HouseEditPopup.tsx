import { useCallback, useRef, useState, useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useStore } from '../store'
import { PIN_CATEGORIES } from '../lib/mapPins'
import type { PinCategory } from '../lib/mapPins'
import { X } from 'lucide-react'
import { useMediaQuery } from '../hooks/useMediaQuery'

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

  // Determine if popup should be top or bottom based on house screen position
  const [popupPosition, setPopupPosition] = useState<'top' | 'bottom'>('bottom')
  const [floatingLayout, setFloatingLayout] = useState<{ left: number; top: number }>({ left: 16, top: 88 })
  useEffect(() => {
    if (!house || !map) return

    const updatePosition = () => {
      const coords = house.geometry.coordinates as [number, number]
      const screenPt = map.project(coords)
      // Use clientHeight (CSS pixels) — canvas.height is device pixels (2-3× on retina)
      const cssHeight = map.getCanvas().clientHeight
      // If house is in the bottom 45% of the viewport, show popup at top
      setPopupPosition(screenPt.y > cssHeight * 0.55 ? 'top' : 'bottom')
    }

    updatePosition()
    // Re-check when map moves (pan/zoom could shift the house)
    map.on('moveend', updatePosition)
    return () => { map.off('moveend', updatePosition) }
  }, [house, map])

  const updateFloatingLayout = useCallback(() => {
    if (isPhone || !house || !map || !popupRef.current) return

    const mapContainer = map.getContainer()
    const popupRect = popupRef.current.getBoundingClientRect()
    const point = map.project(house.geometry.coordinates as [number, number])
    const viewportWidth = mapContainer.clientWidth
    const viewportHeight = mapContainer.clientHeight
    const popupWidth = popupRect.width
    const popupHeight = popupRect.height

    const margin = 16
    const topSafe = 88
    const bottomSafe = 112
    const leftCol = margin
    const rightCol = Math.max(margin, viewportWidth - popupWidth - margin)
    const bottomRow = Math.max(topSafe, viewportHeight - popupHeight - bottomSafe)

    const candidates = [
      { left: leftCol, top: topSafe },
      { left: rightCol, top: topSafe },
      { left: leftCol, top: bottomRow },
      { left: rightCol, top: bottomRow },
    ]

    const reservedZones = [
      {
        left: Math.max(0, viewportWidth - 184),
        top: Math.max(0, viewportHeight - 116),
        right: viewportWidth,
        bottom: viewportHeight,
      },
      {
        left: 0,
        top: Math.max(0, viewportHeight - 124),
        right: 124,
        bottom: viewportHeight,
      },
    ]

    const best = candidates.reduce((bestCandidate, candidate) => {
      const centerX = candidate.left + popupWidth / 2
      const centerY = candidate.top + popupHeight / 2
      let score = Math.hypot(centerX - point.x, centerY - point.y)
      const candidateRect = {
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + popupWidth,
        bottom: candidate.top + popupHeight,
      }

      const overlapPadding = 28
      const overlapsX = point.x >= candidate.left - overlapPadding && point.x <= candidate.left + popupWidth + overlapPadding
      const overlapsY = point.y >= candidate.top - overlapPadding && point.y <= candidate.top + popupHeight + overlapPadding
      if (overlapsX && overlapsY) score -= 10000

      const overlapsReservedZone = reservedZones.some((zone) => (
        candidateRect.left < zone.right &&
        candidateRect.right > zone.left &&
        candidateRect.top < zone.bottom &&
        candidateRect.bottom > zone.top
      ))
      if (overlapsReservedZone) score -= 20000

      if (score > bestCandidate.score) {
        return { score, candidate }
      }
      return bestCandidate
    }, { score: Number.NEGATIVE_INFINITY, candidate: candidates[0] })

    setFloatingLayout((current) => (
      Math.abs(current.left - best.candidate.left) < 1 && Math.abs(current.top - best.candidate.top) < 1
        ? current
        : best.candidate
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

  const showAtTop = keyboardOpen ? true : isPhone ? popupPosition === 'top' : false
  const mobileTopInset = 'max(1rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))'
  const mobileControlClearance = 'calc(var(--map-control-size) + var(--map-control-edge-offset-y) + env(safe-area-inset-bottom, 0px) + 3rem)'
  const mobileMaxHeight = `calc(100dvh - ${mobileTopInset} - ${mobileControlClearance})`

  return (
    <div
      className={isPhone
        ? 'absolute left-1/2 z-10 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 px-2 sm:w-auto sm:max-w-none sm:px-0 transition-[top,bottom] duration-200'
        : 'absolute z-10 transition-[left,top] duration-200 ease-out'}
      style={isPhone
        ? {
            top: showAtTop ? mobileTopInset : 'auto',
            bottom: showAtTop ? 'auto' : mobileControlClearance,
          }
        : floatingLayout}
    >
      <div
        ref={popupRef}
        className="hover-lift w-full rounded-2xl border border-slate-200/85 bg-white/97 shadow-[0_20px_44px_rgba(15,23,42,0.18),0_8px_18px_rgba(15,23,42,0.08)] backdrop-blur-md sm:w-88"
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
          <div className="h-1 w-8 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/75 bg-slate-50/78 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-2xl bg-brand text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(75,108,167,0.22)]">
              {houseIndex}
            </span>
            <div>
              <p className="text-[12px] font-semibold text-heading">House #{houseIndex}</p>
              <p className="text-[11px] text-body/78">Selected map marker</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              aria-label="Delete house"
              className="rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:outline-none"
            >
              Delete
            </button>
            <button
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-all duration-150 hover:bg-black/6 hover:text-slate-700 active:scale-90 focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-3.5 px-3.5 py-3">
          {/* Label */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/72 p-3">
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body/85">
              Name
            </label>
            <input
              type="text"
              value={house.properties.label || ''}
              aria-label="House name"
              onChange={(e) => updateLabel(house.id, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') setSelected(null) }}
              placeholder="e.g. Gallardo Family"
              autoFocus={!isTouch}
              className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[13px] text-heading placeholder:text-body/70 outline-none transition-shadow focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]"
            />
          </div>

          {/* Place type — icon tiles */}
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/72 p-3">
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-body/85">
              Place Type
            </label>
            <p className="mb-2 text-[11px] leading-relaxed text-body/78">
              Choose one or more place types to tint the house icon and improve legend output.
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(3.9rem,1fr))] gap-1.5">
              {placeCats.map((cat) => {
                const active = tags.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => toggleTag(house.id, cat.id)}
                    aria-pressed={active}
                    aria-label={`${active ? 'Remove' : 'Apply'} place type ${cat.label}`}
                    title={cat.label}
                    className={`flex min-h-19 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 text-center transition-all duration-150 ${
                      active
                        ? 'shadow-[0_8px_18px_rgba(15,23,42,0.08)] ring-1 ring-inset ring-white/18'
                        : 'border border-slate-200/80 bg-white/96 hover:border-slate-300 hover:bg-white'
                    }`}
                    style={active ? { backgroundColor: cat.color } : undefined}
                  >
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-lg"
                      style={{
                        backgroundColor: active ? 'rgba(255,255,255,0.2)' : cat.color + '15',
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
                    <span className={`flex min-h-[1.7rem] wrap-break-word items-center justify-center text-[8.5px] font-medium leading-[1.15] ${
                      active ? 'text-white' : 'text-body/75'
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
