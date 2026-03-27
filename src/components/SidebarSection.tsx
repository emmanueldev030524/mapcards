import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

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
        className="flex w-full items-center justify-between py-2"
      >
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-heading">
          {title}
        </h3>
        <ChevronDown
          size={14}
          strokeWidth={2.5}
          className={`text-slate-500 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2">{children}</div>
        </div>
      </div>
    </div>
  )
}
