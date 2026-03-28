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
  { id: 'rv', label: 'Return Visit', color: '#2ecc71', group: 'status',
    iconPaths: '<path d="M4 8.5l3 3 5-5.5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'bs', label: 'Bible Study', color: '#3498db', group: 'status',
    iconPaths: '<rect x="4.5" y="3" width="7" height="10" rx="1" fill="none" stroke="#fff" stroke-width="1.3"/><line x1="6.5" y1="5.5" x2="9.5" y2="5.5" stroke="#fff" stroke-width="1"/><line x1="6.5" y1="7.5" x2="9.5" y2="7.5" stroke="#fff" stroke-width="1"/><line x1="6.5" y1="9.5" x2="8.5" y2="9.5" stroke="#fff" stroke-width="1"/>' },

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

const HOUSE_DEFAULT_COLOR = '#4B6CA7'

type MapImageHost = { hasImage: (id: string) => boolean; addImage: (id: string, img: HTMLImageElement) => void }

interface HouseIconSpec {
  bodyColor: string
  roofColor: string
  statusColor: string | null  // corner badge color
  statusIcon: string | null   // SVG paths for badge icon (16x16 viewBox)
}

/** Darken a hex color by a percentage (e.g. 15 = 15% darker) */
function darkenHex(hex: string, percent: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const f = 1 - percent / 100
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `#${c(r).toString(16).padStart(2, '0')}${c(g).toString(16).padStart(2, '0')}${c(b).toString(16).padStart(2, '0')}`
}

/**
 * Generate a solid-filled house SVG icon at 48x48 for sharp rendering on
 * screen and in print. White window/door cutouts provide detail at larger
 * sizes while the solid shape reads clearly even at 13px.
 * Anchor point is center-bottom. Shape/size never change — only colors.
 */
function buildHouseSVG(spec: HouseIconSpec): string {
  const { bodyColor, roofColor } = spec
  const bodyStroke = darkenHex(bodyColor, 15)
  const roofStroke = darkenHex(roofColor, 15)
  const detailStroke = darkenHex(bodyColor, 10)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <defs>
    <filter id="ds" x="-15%" y="-5%" width="130%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.8" flood-color="#000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <g filter="url(#ds)">
    <rect x="10" y="19" width="28" height="20" rx="2" fill="${bodyColor}" stroke="${bodyStroke}" stroke-width="1.5"/>
    <path d="M24 6L7 19h34L24 6z" fill="${roofColor}" stroke="${roofStroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="10" y1="19" x2="38" y2="19" stroke="${bodyColor}" stroke-width="2"/>
    <rect x="12.5" y="22" width="6" height="5" rx="1" fill="#fff" stroke="${detailStroke}" stroke-width="0.8"/>
    <rect x="29.5" y="22" width="6" height="5" rx="1" fill="#fff" stroke="${detailStroke}" stroke-width="0.8"/>
    <rect x="20" y="28" width="8" height="11" rx="1.5" fill="#fff" stroke="${detailStroke}" stroke-width="1"/>
    <circle cx="26" cy="34" r="0.8" fill="${detailStroke}"/>
  </g>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/** Minimal shape for status lookup — works with both PIN_CATEGORIES and custom statuses */
export interface StatusLike {
  id: string
  color: string
  label?: string
}

// Build lookup Sets once (module-level) so resolveHouseIcon avoids repeated .some() scans
const PLACE_IDS = new Set(PIN_CATEGORIES.filter((c) => c.group === 'place').map((c) => c.id))
const STATUS_PIN_IDS = new Set(PIN_CATEGORIES.filter((c) => c.group === 'status').map((c) => c.id))
const PIN_COLOR_MAP = new Map(PIN_CATEGORIES.map((c) => [c.id, c.color]))
const PIN_ICON_MAP = new Map(PIN_CATEGORIES.map((c) => [c.id, c.iconPaths]))

// Per-render cache: cleared when customStatuses identity changes
let _iconCache = new Map<string, { key: string; spec: HouseIconSpec }>()
let _lastStatusRef: StatusLike[] | undefined

/**
 * Resolve the full icon spec for a house from its tags.
 * Accepts optional customStatuses array so user-created statuses also tint the icon.
 * Results are cached per tag combination (cache auto-clears when customStatuses changes).
 */
export function resolveHouseIcon(tags: string[], customStatuses?: StatusLike[]): { key: string; spec: HouseIconSpec } {
  // Invalidate cache when custom statuses change (reference check is sufficient —
  // Zustand returns the same array unless statuses were actually modified)
  if (customStatuses !== _lastStatusRef) {
    _iconCache = new Map()
    _lastStatusRef = customStatuses
  }

  // Cache key: sorted tags (deterministic regardless of tag order)
  const safeTags = tags || []
  const cacheKey = safeTags.length === 0 ? '' : safeTags.slice().sort().join(',')
  const cached = _iconCache.get(cacheKey)
  if (cached) return cached

  // Build custom status lookup
  const customStatusMap = new Map<string, StatusLike>()
  if (customStatuses) {
    for (const cs of customStatuses) customStatusMap.set(cs.id, cs)
  }

  const places = safeTags.filter((t) => PLACE_IDS.has(t))
  const statuses = safeTags.filter((t) => STATUS_PIN_IDS.has(t) || customStatusMap.has(t))

  const firstStatusId = statuses.length > 0 ? statuses[0] : null
  const firstStatus = firstStatusId
    ? (PIN_CATEGORIES.find((c) => c.id === firstStatusId) as StatusLike | undefined) || customStatusMap.get(firstStatusId) || null
    : null

  const placeColor1 = places.length > 0 ? (PIN_COLOR_MAP.get(places[0]) || HOUSE_DEFAULT_COLOR) : null
  const placeColor2 = places.length > 1 ? (PIN_COLOR_MAP.get(places[1]) || null) : null

  const bodyColor = placeColor1 || firstStatus?.color || HOUSE_DEFAULT_COLOR
  const roofColor = placeColor2 || (placeColor1 && firstStatus ? firstStatus.color : bodyColor)

  const statusColor = firstStatus?.color || null
  const statusIcon = firstStatusId ? (PIN_ICON_MAP.get(firstStatusId) || null) : null

  // Build a deterministic image key
  const parts = ['house']
  if (places.length > 0) parts.push(...places.slice(0, 2).sort())
  else parts.push('default')
  if (firstStatus) parts.push(firstStatus.id)
  const key = parts.join('-')

  const result = { key, spec: { bodyColor, roofColor, statusColor, statusIcon } }
  _iconCache.set(cacheKey, result)
  return result
}

/**
 * Ensure a house icon image exists on the map. Generates on-demand if missing.
 */
async function ensureHouseIcon(map: MapImageHost, key: string, spec: HouseIconSpec): Promise<void> {
  if (map.hasImage(key)) return
  const url = buildHouseSVG(spec)
  return new Promise<void>((resolve) => {
    const img = new Image(48, 48)
    img.onload = () => { if (!map.hasImage(key)) map.addImage(key, img); resolve() }
    img.onerror = () => resolve()
    img.src = url
  })
}

/**
 * Collect the set of icon keys needed for a list of houses.
 * Returns a Map of key → spec for icons that DON'T yet exist on the map.
 */
function collectMissingIcons(
  map: MapImageHost,
  houses: Array<{ tags: string[] }>,
  customStatuses?: StatusLike[],
): Map<string, HouseIconSpec> {
  const defaultSpec: HouseIconSpec = { bodyColor: HOUSE_DEFAULT_COLOR, roofColor: HOUSE_DEFAULT_COLOR, statusColor: null, statusIcon: null }
  const missing = new Map<string, HouseIconSpec>()
  if (!map.hasImage('house-default')) missing.set('house-default', defaultSpec)

  for (const h of houses) {
    const { key, spec } = resolveHouseIcon(h.tags, customStatuses)
    if (!missing.has(key) && !map.hasImage(key)) missing.set(key, spec)
  }

  return missing
}

/**
 * Synchronous check: do all needed house icons already exist on the map?
 * When true, callers can skip the async ensureHouseIcons path entirely.
 */
export function allHouseIconsExist(
  map: MapImageHost,
  houses: Array<{ tags: string[] }>,
  customStatuses?: StatusLike[],
): boolean {
  return collectMissingIcons(map, houses, customStatuses).size === 0
}

/**
 * Ensure all house icon variants needed for a set of houses exist on the map.
 * Call this before setting the GeoJSON source data.
 */
export async function ensureHouseIcons(
  map: MapImageHost,
  houses: Array<{ tags: string[] }>,
  customStatuses?: StatusLike[],
): Promise<void> {
  const missing = collectMissingIcons(map, houses, customStatuses)
  if (missing.size === 0) return

  await Promise.all(
    Array.from(missing.entries()).map(([key, spec]) => ensureHouseIcon(map, key, spec)),
  )
}

// ─── Direction & start markers ───

/** Direction chevron for road walking direction (16x16) */
export function generateChevronSVG(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
    <path d="M5 3l6 5-6 5" fill="none" stroke="#6B7A8D" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

/** Green "Starts Here" pin marker (32x40) */
export function generateStartMarkerSVG(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
    <defs>
      <filter id="s" x="-20%" y="-10%" width="140%" height="130%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.2" flood-opacity="0.3"/>
      </filter>
    </defs>
    <path d="M16 38c0 0-12-15-12-22a12 12 0 0124 0c0 7-12 22-12 22z"
          fill="#22c55e" filter="url(#s)"/>
    <circle cx="16" cy="15" r="9" fill="rgba(255,255,255,0.2)"/>
    <g transform="translate(8,7)">
      <path d="M5 2v12" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M5 2h7l-2 3 2 3H5" fill="rgba(255,255,255,0.9)" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
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
export function collectLegend(
  houses: Array<{ tags: string[] }>,
  customStatuses?: Array<{ id: string; label: string; color: string }>,
): LegendEntry[] {
  const usedIds = new Set<string>()
  for (const h of houses) {
    for (const t of h.tags || []) usedIds.add(t)
  }

  const entries: LegendEntry[] = PIN_CATEGORIES
    .filter((c) => usedIds.has(c.id))
    .map((c) => ({ color: c.color, label: c.label, type: c.group }))

  // Add custom statuses that are used
  if (customStatuses) {
    for (const cs of customStatuses) {
      if (usedIds.has(cs.id) && !PIN_CATEGORIES.some((c) => c.id === cs.id)) {
        entries.push({ color: cs.color, label: cs.label, type: 'status' })
      }
    }
  }

  return entries
}
