import { useStore } from '../store'

const inputClass =
  'peer w-full rounded-lg border border-divider bg-surface px-3 pb-2 pt-6 text-[13px] text-heading outline-none transition-shadow duration-150 placeholder-transparent focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]'

const inputCompact =
  'peer w-full rounded-lg border border-divider bg-surface px-3 pb-1 pt-5 text-[13px] text-heading outline-none transition-shadow duration-150 placeholder-transparent focus:shadow-[0_0_0_2px_rgba(75,108,167,0.35)]'

const floatLabelClass =
  'pointer-events-none absolute left-3 top-1.5 origin-left text-[10px] font-semibold text-body transition-all duration-150 peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-placeholder-shown:text-body peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-brand'

const floatLabelCompact =
  'pointer-events-none absolute left-3 top-1 origin-left text-[10px] font-semibold text-body transition-all duration-150 peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-[13px] peer-placeholder-shown:font-medium peer-placeholder-shown:text-body peer-focus:top-1 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:text-brand'

export default function CardSettings() {
  const territoryName = useStore((s) => s.territoryName)
  const territoryNumber = useStore((s) => s.territoryNumber)
  const cardWidthInches = useStore((s) => s.cardWidthInches)
  const cardHeightInches = useStore((s) => s.cardHeightInches)
  const setTerritoryName = useStore((s) => s.setTerritoryName)
  const setTerritoryNumber = useStore((s) => s.setTerritoryNumber)
  const setCardDimensions = useStore((s) => s.setCardDimensions)

  return (
    <div className="space-y-2.5">
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
      <div className="flex min-w-0 gap-2">
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
    </div>
  )
}
