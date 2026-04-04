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
  const contentId = useRef(`sidebar-section-${title.toLowerCase().replace(/\s+/g, '-')}`)

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
    <div className="rounded-xl border border-divider/50 bg-white/80 px-2.5 py-1.5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] backdrop-blur-sm">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={contentId.current}
        className="group flex min-h-[36px] w-full items-center justify-between rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-brand-hover"
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
        id={contentId.current}
        style={{
          maxHeight: open ? (height ?? 1000) : 0,
          opacity: open ? 1 : 0,
        }}
        className="overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]"
      >
        <div ref={contentRef} className="px-1 pb-1 pt-1.5">
          {children}
        </div>
      </div>
    </div>
  )
}
