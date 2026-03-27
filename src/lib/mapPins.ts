/** Google Maps-style pin markers + dynamic house icon system */

export interface PinCategory {
  id: string
  label: string
  color: string
  group: 'status' | 'place'
  /** SVG path(s) for the icon inside the pin, viewBox 0 0 16 16 */
  iconPaths: string
}

export const PIN_CATEGORIES: PinCategory[] = [
  // Status tags
  { id: 'notHome', label: 'Not Home', color: '#f39c12', group: 'status',
    iconPaths: '<text x="8" y="12" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff" font-family="Arial">?</text>' },
  { id: 'dnc', label: 'Do Not Call', color: '#95a5a6', group: 'status',
    iconPaths: '<line x1="4" y1="4" x2="12" y2="12" stroke="#fff" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="4" x2="4" y2="12" stroke="#fff" stroke-width="2" stroke-linecap="round"/>' },

  // Place types
  { id: 'store', label: 'Store', color: '#e74c3c', group: 'place',
    iconPaths: '<path d="M5 6h6l-.5 4.5h-5L5 6z" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 6V5a1.5 1.5 0 013 0v1" fill="none" stroke="#fff" stroke-width="1.3"/>' },
  { id: 'apartment', label: 'Apartment', color: '#8e44ad', group: 'place',
    iconPaths: '<rect x="4.5" y="3.5" width="7" height="9" rx="0.5" fill="none" stroke="#fff" stroke-width="1.3"/><rect x="6" y="5" width="1.5" height="1.5" fill="#fff" rx="0.3"/><rect x="8.5" y="5" width="1.5" height="1.5" fill="#fff" rx="0.3"/><rect x="6" y="8" width="1.5" height="1.5" fill="#fff" rx="0.3"/><rect x="8.5" y="8" width="1.5" height="1.5" fill="#fff" rx="0.3"/>' },
  { id: 'school', label: 'School', color: '#3498db', group: 'place',
    iconPaths: '<path d="M8 3L2.5 6.5 8 10l5.5-3.5L8 3z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M4.5 8v3l3.5 2 3.5-2V8" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>' },
  { id: 'hospital', label: 'Hospital', color: '#e74c3c', group: 'place',
    iconPaths: '<rect x="6.5" y="3" width="3" height="10" rx="0.5" fill="#fff"/><rect x="3" y="6.5" width="10" height="3" rx="0.5" fill="#fff"/>' },
  { id: 'church', label: 'Church', color: '#9b59b6', group: 'place',
    iconPaths: '<line x1="8" y1="3" x2="8" y2="13" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><line x1="5" y1="6" x2="11" y2="6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' },
  { id: 'restaurant', label: 'Restaurant', color: '#e67e22', group: 'place',
    iconPaths: '<path d="M5 3v4c0 1.1.9 2 2 2h0v4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M5 5h3" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M11 3v2c0 1.7-1 2-1 2v4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M11 3c.6 1 .6 2 0 3" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>' },
  { id: 'gas', label: 'Gas Station', color: '#2c3e50', group: 'place',
    iconPaths: '<rect x="4" y="5" width="6" height="7" rx="0.5" fill="none" stroke="#fff" stroke-width="1.3"/><rect x="5.5" y="7" width="3" height="2" rx="0.3" fill="#fff"/><path d="M10 6l2-2v6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'mechanic', label: 'Mechanic', color: '#34495e', group: 'place',
    iconPaths: '<path d="M4 12l3-3m2 0l3 3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="7" r="2.5" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="8" cy="7" r="0.8" fill="#fff"/>' },
  { id: 'bank', label: 'Bank', color: '#27ae60', group: 'place',
    iconPaths: '<text x="8" y="12" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="Arial">$</text>' },
  { id: 'pharmacy', label: 'Pharmacy', color: '#1abc9c', group: 'place',
    iconPaths: '<text x="8" y="12" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff" font-family="Arial">Rx</text>' },
  { id: 'government', label: 'Government', color: '#2980b9', group: 'place',
    iconPaths: '<path d="M4 7h8L8 4 4 7z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 7v4m2-4v4m2-4v4m2-4v4" stroke="#fff" stroke-width="1.2"/><line x1="3.5" y1="11.5" x2="12.5" y2="11.5" stroke="#fff" stroke-width="1.3"/>' },
  { id: 'rv', label: 'RV / Trailer', color: '#16a085', group: 'place',
    iconPaths: '<rect x="3" y="6" width="10" height="6" rx="1" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="5.5" cy="12.5" r="1.2" fill="none" stroke="#fff" stroke-width="1"/><circle cx="10.5" cy="12.5" r="1.2" fill="none" stroke="#fff" stroke-width="1"/><line x1="13" y1="9" x2="14.5" y2="9" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>' },
  { id: 'tree', label: 'Tree / Landmark', color: '#2d8a4e', group: 'place',
    iconPaths: '<path d="M8 2L3 9h3l-2 4h4v3h0V13h4l-2-4h3L8 2z" fill="#fff" opacity="0.9" stroke="#fff" stroke-width="0.5" stroke-linejoin="round"/>' },
]

// ─── Teardrop pin for status badges ───

export function generatePinSVG(category: PinCategory): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <defs>
      <filter id="s" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.3"/>
      </filter>
    </defs>
    <path d="M16 38c0 0-12-15-12-22a12 12 0 0124 0c0 7-12 22-12 22z"
          fill="${category.color}" filter="url(#s)"/>
    <circle cx="16" cy="15" r="9" fill="rgba(255,255,255,0.2)"/>
    <g transform="translate(8,7)">${category.iconPaths}</g>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export async function loadPinImages(map: MapImageHost): Promise<void> {
  for (const cat of PIN_CATEGORIES) {
    const imgName = `pin-${cat.id}`
    if (map.hasImage(imgName)) continue
    const dataUrl = generatePinSVG(cat)
    const img = new Image(32, 40)
    await new Promise<void>((resolve) => {
      img.onload = () => { if (!map.hasImage(imgName)) map.addImage(imgName, img); resolve() }
      img.onerror = () => resolve()
      img.src = dataUrl
    })
  }
}

// ─── Dynamic house icon system ───

const HOUSE_DEFAULT_COLOR = '#39577F'

type MapImageHost = { hasImage: (id: string) => boolean; addImage: (id: string, img: HTMLImageElement) => void }

interface HouseIconSpec {
  bodyColor: string
  roofColor: string
  statusColor: string | null  // corner badge color
  statusSymbol: string | null // '?' or '✕'
}

/**
 * Generate a house SVG with:
 * - Body walls = bodyColor tint
 * - Roof = roofColor (can differ from body for dual-tag)
 * - Optional status badge (small colored circle in top-right corner)
 */
function buildHouseSVG(spec: HouseIconSpec): string {
  const { bodyColor, roofColor, statusColor, statusSymbol } = spec
  const bodyTint = bodyColor + '30'
  const roofTint = roofColor + '50'

  // Status badge in top-right corner (if present)
  const badge = statusColor
    ? `<circle cx="20" cy="4.5" r="3.5" fill="${statusColor}" stroke="#fff" stroke-width="1"/>
       <text x="20" y="6.5" text-anchor="middle" font-size="5" font-weight="bold" fill="#fff" font-family="Arial">${statusSymbol || ''}</text>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <defs>
    <filter id="hs" x="-15%" y="-10%" width="140%" height="140%">
      <feDropShadow dx="0" dy="0.5" stdDeviation="0.8" flood-opacity="0.2"/>
    </filter>
  </defs>
  <g filter="url(#hs)">
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z" fill="${bodyTint}"/>
    <path d="M3 10.5L12 3l9 7.5H3z" fill="${roofTint}"/>
    <rect x="9" y="14" width="6" height="7" rx="0.5" fill="#fff" opacity="0.9"/>
    <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10.5z"
          fill="none" stroke="${bodyColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 10.5L12 3l9 7.5" fill="none" stroke="${roofColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="9" y="14" width="6" height="7" rx="0.5"
          fill="none" stroke="${bodyColor}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="7" y="11" width="3" height="2.5" rx="0.3" fill="#fff" opacity="0.7" stroke="${bodyColor}" stroke-width="0.8"/>
    <rect x="14" y="11" width="3" height="2.5" rx="0.3" fill="#fff" opacity="0.7" stroke="${bodyColor}" stroke-width="0.8"/>
  </g>
  ${badge}
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/**
 * Resolve the full icon spec for a house from its tags.
 * Returns an icon key (for caching) and the spec (for generation).
 */
export function resolveHouseIcon(tags: string[]): { key: string; spec: HouseIconSpec } {
  const places = (tags || []).filter((t) => PIN_CATEGORIES.some((c) => c.id === t && c.group === 'place'))
  const statuses = (tags || []).filter((t) => PIN_CATEGORIES.some((c) => c.id === t && c.group === 'status'))

  const bodyColor = places.length > 0
    ? (PIN_CATEGORIES.find((c) => c.id === places[0])?.color || HOUSE_DEFAULT_COLOR)
    : HOUSE_DEFAULT_COLOR

  const roofColor = places.length > 1
    ? (PIN_CATEGORIES.find((c) => c.id === places[1])?.color || bodyColor)
    : bodyColor

  // First status tag becomes the corner badge
  const statusCat = statuses.length > 0 ? PIN_CATEGORIES.find((c) => c.id === statuses[0]) : null
  const statusColor = statusCat?.color || null
  const statusSymbol = statusCat ? (statusCat.id === 'notHome' ? '?' : '✕') : null

  // Build a deterministic cache key
  const parts = ['house']
  if (places.length > 0) parts.push(...places.slice(0, 2).sort())
  else parts.push('default')
  if (statusCat) parts.push(statusCat.id)
  const key = parts.join('-')

  return { key, spec: { bodyColor, roofColor, statusColor, statusSymbol } }
}

/**
 * Ensure a house icon image exists on the map. Generates on-demand if missing.
 */
async function ensureHouseIcon(map: MapImageHost, key: string, spec: HouseIconSpec): Promise<void> {
  if (map.hasImage(key)) return
  const url = buildHouseSVG(spec)
  return new Promise<void>((resolve) => {
    const img = new Image(24, 24)
    img.onload = () => { if (!map.hasImage(key)) map.addImage(key, img); resolve() }
    img.onerror = () => resolve()
    img.src = url
  })
}

/**
 * Ensure all house icon variants needed for a set of houses exist on the map.
 * Call this before setting the GeoJSON source data.
 */
export async function ensureHouseIcons(
  map: MapImageHost,
  houses: Array<{ tags: string[] }>,
): Promise<void> {
  // Always ensure default exists
  const defaultSpec: HouseIconSpec = { bodyColor: HOUSE_DEFAULT_COLOR, roofColor: HOUSE_DEFAULT_COLOR, statusColor: null, statusSymbol: null }
  const needed = new Map<string, HouseIconSpec>([['house-default', defaultSpec]])

  for (const h of houses) {
    const { key, spec } = resolveHouseIcon(h.tags)
    if (!needed.has(key)) needed.set(key, spec)
  }

  await Promise.all(
    Array.from(needed.entries()).map(([key, spec]) => ensureHouseIcon(map, key, spec)),
  )
}

// ─── Legend data for export ───

export interface LegendEntry {
  color: string
  label: string
  type: 'place' | 'status'
}

/**
 * Collect the legend entries needed for a set of houses.
 * Only returns tags that are actually used.
 */
export function collectLegend(houses: Array<{ tags: string[] }>): LegendEntry[] {
  const usedIds = new Set<string>()
  for (const h of houses) {
    for (const t of h.tags || []) usedIds.add(t)
  }

  return PIN_CATEGORIES
    .filter((c) => usedIds.has(c.id))
    .map((c) => ({ color: c.color, label: c.label, type: c.group }))
}
