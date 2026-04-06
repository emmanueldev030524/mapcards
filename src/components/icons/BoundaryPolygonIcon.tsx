import { forwardRef } from 'react'
import type { SVGProps } from 'react'

interface BoundaryPolygonIconProps extends SVGProps<SVGSVGElement> {
  size?: string | number
  strokeWidth?: number
  absoluteStrokeWidth?: boolean
}

/** Irregular polygon with vertex dots — conveys "click to draw a shape." */
const BoundaryPolygonIcon = forwardRef<SVGSVGElement, BoundaryPolygonIconProps>(
  ({ size = 24, strokeWidth = 2, absoluteStrokeWidth, className, ...props }, ref) => {
    void absoluteStrokeWidth
    const s = typeof size === 'number' ? `${size}px` : size
    const vertices: [number, number][] = [
      [12, 3], [20.5, 8], [18, 19], [6, 20], [3.5, 10],
    ]
    const points = vertices.map(([x, y]) => `${x},${y}`).join(' ')

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        {...props}
      >
        <polygon points={points} />
        {vertices.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.8} fill="currentColor" stroke="none" />
        ))}
      </svg>
    )
  },
)

BoundaryPolygonIcon.displayName = 'BoundaryPolygonIcon'
export default BoundaryPolygonIcon
