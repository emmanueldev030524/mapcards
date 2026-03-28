import { useState, useRef, useEffect, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface SidebarSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export default function SidebarSection({ title, children, defaultOpen = true }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)

  // Measure content height for smooth animation
  useEffect(() => {
    if (!contentRef.current) return
    const ro = new ResizeObserver(() => {
      if (contentRef.current) {
        setHeight(contentRef.current.scrollHeight)
      }
    })
    ro.observe(contentRef.current)
    return () => ro.disconnect()
  }, [])

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="group flex w-full items-center justify-between rounded-md px-1 py-2 transition-colors duration-150 hover:bg-brand-hover"
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-heading">
          {title}
        </h3>
        <ChevronRight
          size={13}
          strokeWidth={2}
          className={`text-body transition-transform duration-300 ease-out ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        style={{
          maxHeight: open ? (height ?? 1000) : 0,
          opacity: open ? 1 : 0,
        }}
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      >
        <div ref={contentRef} className="pt-1.5 pb-1">
          {children}
        </div>
      </div>
    </div>
  )
}
