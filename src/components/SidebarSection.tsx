import { useState, type ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

interface SidebarSectionProps {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}

export default function SidebarSection({ title, children, defaultOpen = true }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

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
          className={`text-body transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-1.5 pb-1">{children}</div>
        </div>
      </div>
    </div>
  )
}
