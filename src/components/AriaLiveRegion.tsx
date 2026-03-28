import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'

/**
 * Visually-hidden aria-live region that announces map state changes
 * to screen reader users. Watches the store for key actions.
 */
export default function AriaLiveRegion() {
  const [message, setMessage] = useState('')
  const prevRef = useRef({
    boundaryExists: false,
    roadCount: 0,
    houseCount: 0,
    treeCount: 0,
  })

  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      const prev = prevRef.current
      const msgs: string[] = []

      const boundaryExists = state.boundary !== null
      if (boundaryExists && !prev.boundaryExists) {
        const ptCount = state.boundary?.geometry.coordinates[0].length ?? 0
        msgs.push(`Boundary drawn with ${ptCount - 1} points`)
      } else if (!boundaryExists && prev.boundaryExists) {
        msgs.push('Boundary removed')
      }

      if (state.customRoads.length > prev.roadCount) {
        msgs.push(`Road added. ${state.customRoads.length} total roads`)
      } else if (state.customRoads.length < prev.roadCount) {
        msgs.push(`Road removed. ${state.customRoads.length} total roads`)
      }

      if (state.housePoints.length > prev.houseCount) {
        const diff = state.housePoints.length - prev.houseCount
        msgs.push(diff === 1
          ? `House placed. ${state.housePoints.length} total`
          : `${diff} houses placed. ${state.housePoints.length} total`)
      } else if (state.housePoints.length < prev.houseCount) {
        msgs.push(`House removed. ${state.housePoints.length} remaining`)
      }

      if (state.treePoints.length > prev.treeCount) {
        msgs.push(`Tree placed. ${state.treePoints.length} total`)
      } else if (state.treePoints.length < prev.treeCount) {
        msgs.push(`Tree removed. ${state.treePoints.length} remaining`)
      }

      prevRef.current = {
        boundaryExists,
        roadCount: state.customRoads.length,
        houseCount: state.housePoints.length,
        treeCount: state.treePoints.length,
      }

      if (msgs.length > 0) {
        setMessage(msgs.join('. '))
      }
    })

    return unsub
  }, [])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      style={{
        position: 'absolute',
        width: '1px',
        height: '1px',
        padding: 0,
        margin: '-1px',
        overflow: 'hidden',
        clip: 'rect(0, 0, 0, 0)',
        whiteSpace: 'nowrap',
        borderWidth: 0,
      }}
    >
      {message}
    </div>
  )
}
