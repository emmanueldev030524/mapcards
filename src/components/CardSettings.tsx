import { useStore } from '../store'

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
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
        Card Settings
      </h3>

      <div>
        <label className="mb-1 block text-xs text-gray-500">Territory Name</label>
        <input
          type="text"
          value={territoryName}
          onChange={(e) => setTerritoryName(e.target.value)}
          placeholder="e.g. Crossing Libona"
          className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs text-gray-500">Territory Number</label>
        <input
          type="text"
          value={territoryNumber}
          onChange={(e) => setTerritoryNumber(e.target.value)}
          placeholder="e.g. T-15"
          className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">Width (in)</label>
          <input
            type="number"
            value={cardWidthInches}
            onChange={(e) => setCardDimensions(parseFloat(e.target.value) || 1, cardHeightInches)}
            min={1}
            max={20}
            step={0.5}
            className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs text-gray-500">Height (in)</label>
          <input
            type="number"
            value={cardHeightInches}
            onChange={(e) => setCardDimensions(cardWidthInches, parseFloat(e.target.value) || 1)}
            min={1}
            max={20}
            step={0.5}
            className="w-full rounded-md border border-border bg-white px-3 py-1.5 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>
    </div>
  )
}
