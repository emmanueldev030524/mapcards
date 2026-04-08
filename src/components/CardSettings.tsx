import { useStore } from '../store'

const inputClass =
  'sidebar-input-surface peer w-full rounded-[16px] px-3.5 pb-2.5 pt-6 text-[13px] font-medium text-heading outline-none placeholder-transparent'

const inputCompact =
  'sidebar-input-surface peer w-full rounded-[16px] px-3.5 pb-1.5 pt-5.5 text-[13px] font-medium text-heading outline-none placeholder-transparent'

const floatLabelClass =
  'pointer-events-none absolute left-3.5 top-1.5 origin-left text-[10px] font-semibold tracking-[0.02em] text-body/78 transition-all duration-150 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-placeholder-shown:text-body/70 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-brand'

const floatLabelCompact =
  'pointer-events-none absolute left-3.5 top-1 origin-left text-[10px] font-semibold tracking-[0.02em] text-body/78 transition-all duration-150 peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-placeholder-shown:text-body/70 peer-focus:top-1 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-brand'

export default function CardSettings() {
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)
  const setTerritoryName = useStore((s) => s.setTerritoryName)
  const setTerritoryNumber = useStore((s) => s.setTerritoryNumber)
  const setCardDimensions = useStore((s) => s.setCardDimensions)

  return (
    <div className="space-y-3">
      {/* Territory Name — floating label */}
      <div className="relative">
        <input
          type="text"
          id="territory-name"
          value={territoryName}
          onChange={(e) => setTerritoryName(e.target.value)}
          placeholder="Territory Name"
          className={inputClass}
        />
        <label htmlFor="territory-name" className={floatLabelClass}>
          Territory Name
        </label>
      </div>

      {/* Territory Number — floating label */}
      <div className="relative">
        <input
          type="text"
          id="territory-number"
          value={territoryNumber}
          onChange={(e) => setTerritoryNumber(e.target.value)}
          placeholder="Territory Number"
          className={inputClass}
        />
        <label htmlFor="territory-number" className={floatLabelClass}>
          Territory Number
        </label>
      </div>

      {/* Dimensions — compact row */}
      <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            id="card-width"
            value={cardWidthInches}
            onChange={(e) => setCardDimensions(parseFloat(e.target.value) || 1, cardHeightInches)}
            min={1}
            max={20}
            step={0.5}
            placeholder="Width"
            className={inputCompact}
          />
          <label htmlFor="card-width" className={floatLabelCompact}>
            Width (in)
          </label>
        </div>
        <div className="relative min-w-0 flex-1">
          <input
            type="number"
            id="card-height"
            value={cardHeightInches}
            onChange={(e) => setCardDimensions(cardWidthInches, parseFloat(e.target.value) || 1)}
            min={1}
            max={20}
            step={0.5}
            placeholder="Height"
            className={inputCompact}
          />
          <label htmlFor="card-height" className={floatLabelCompact}>
            Height (in)
          </label>
        </div>
      </div>

      <p className="px-1 text-[11px] leading-relaxed text-body/68">
        Card size controls the export layout only. Your map styling and territory data stay unchanged.
      </p>
    </div>
  )
}
