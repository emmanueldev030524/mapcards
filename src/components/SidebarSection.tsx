import { useState, useRef, useId, useEffect, type ReactNode } from 'react'
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
  const contentId = useId()

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
    <div className="sidebar-card-surface px-2.5 py-1.5">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId}
        className="group flex min-h-10 w-full items-center justify-between rounded-[16px] px-2.5 py-1.5 text-left transition-[background-color,transform] duration-150 hover:bg-white/60 hover:-translate-y-px"
      >
        <h3 className="sidebar-section-heading text-[10.5px] text-body/80">
          {title}
        </h3>
        <ChevronRight
          size={14}
          strokeWidth={2}
          className={`text-body/60 transition-transform duration-300 ease-out group-hover:text-body/85 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        id={contentId}
        style={{
          maxHeight: open ? (height ?? 1000) : 0,
          opacity: open ? 1 : 0,
        }}
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      >
        <div ref={contentRef} className="px-1.5 pb-1.5 pt-2">
          {children}
        </div>
      </div>
    </div>
  )
}
