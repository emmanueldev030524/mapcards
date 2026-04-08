/** Google Maps-style pin markers + dynamic house icon system */

export interface PinCategory {
  id: string
  label: string
  color: string
  /** SVG path(s) for the icon inside the pin, viewBox 0 0 16 16 */
  iconPaths: string
}

export const PIN_CATEGORIES: PinCategory[] = [
  // Place types
  { id: 'store', label: 'Store', color: '#e74c3c',
    iconPaths: '<path d="M5 6h6l-.5 4.5h-5L5 6z" fill="none" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/><path d="M6.5 6V5a1.5 1.5 0 013 0v1" fill="none" stroke="#fff" stroke-width="1.3"/>' },
  { id: 'apartment', label: 'Apartment', color: '#8e44ad',
    iconPaths: '<rect x="4.5" y="3.5" width="7" height="9" rx="0.5" fill="none" stroke="#fff" stroke-width="1.3"/><rect x="6" y="5" width="1.5" height="1.5" fill="#fff" rx="0.3"/><rect x="8.5" y="5" width="1.5" height="1.5" fill="#fff" rx="0.3"/><rect x="6" y="8" width="1.5" height="1.5" fill="#fff" rx="0.3"/><rect x="8.5" y="8" width="1.5" height="1.5" fill="#fff" rx="0.3"/>' },
  { id: 'school', label: 'School', color: '#3498db',
    iconPaths: '<path d="M8 3L2.5 6.5 8 10l5.5-3.5L8 3z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M4.5 8v3l3.5 2 3.5-2V8" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>' },
  { id: 'hospital', label: 'Hospital', color: '#e74c3c',
    iconPaths: '<rect x="6.5" y="3" width="3" height="10" rx="0.5" fill="#fff"/><rect x="3" y="6.5" width="10" height="3" rx="0.5" fill="#fff"/>' },
  { id: 'church', label: 'Church', color: '#9b59b6',
    iconPaths: '<line x1="8" y1="3" x2="8" y2="13" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><line x1="5" y1="6" x2="11" y2="6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>' },
  { id: 'restaurant', label: 'Restaurant', color: '#e67e22',
    iconPaths: '<path d="M5 3v4c0 1.1.9 2 2 2h0v4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M5 5h3" fill="none" stroke="#fff" stroke-width="1.3"/><path d="M11 3v2c0 1.7-1 2-1 2v4" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/><path d="M11 3c.6 1 .6 2 0 3" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round"/>' },
  { id: 'gas', label: 'Gas Station', color: '#2c3e50',
    iconPaths: '<rect x="4" y="5" width="6" height="7" rx="0.5" fill="none" stroke="#fff" stroke-width="1.3"/><rect x="5.5" y="7" width="3" height="2" rx="0.3" fill="#fff"/><path d="M10 6l2-2v6" fill="none" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>' },
  { id: 'mechanic', label: 'Mechanic', color: '#34495e',
    iconPaths: '<path d="M4 12l3-3m2 0l3 3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="7" r="2.5" fill="none" stroke="#fff" stroke-width="1.3"/><circle cx="8" cy="7" r="0.8" fill="#fff"/>' },
  { id: 'bank', label: 'Bank', color: '#27ae60',
    iconPaths: '<text x="8" y="12" text-anchor="middle" font-size="10" font-weight="bold" fill="#fff" font-family="Arial">$</text>' },
  { id: 'pharmacy', label: 'Pharmacy', color: '#1abc9c',
    iconPaths: '<text x="8" y="12" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff" font-family="Arial">Rx</text>' },
  { id: 'government', label: 'Government', color: '#2980b9',
    iconPaths: '<path d="M4 7h8L8 4 4 7z" fill="none" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/><path d="M5 7v4m2-4v4m2-4v4m2-4v4" stroke="#fff" stroke-width="1.2"/><line x1="3.5" y1="11.5" x2="12.5" y2="11.5" stroke="#fff" stroke-width="1.3"/>' },
  { id: 'tree', label: 'Tree / Landmark', color: '#2d8a4e',
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

import { BRAND } from './colors'

const HOUSE_DEFAULT_COLOR = BRAND

type MapImageHost = { hasImage: (id: string) => boolean; addImage: (id: string, img: HTMLImageElement) => void }

interface HouseIconSpec {
  bodyColor: string
  roofColor: string
}

/**
 * Generate an outline-only house SVG icon at 48x48. Stroke-only with empty
 * interior so users can hand-annotate on the printed card. Body and door/
 * windows stroke with bodyColor; roof strokes with roofColor (which differs
 * only when two place tags are present, giving a visual dual-tag cue).
 * Anchor point is center-bottom.
 */
function buildHouseSVG(spec: HouseIconSpec): string {
  const { bodyColor, roofColor } = spec
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
  <g fill="none" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <rect x="10" y="19" width="28" height="20" rx="2" stroke="${bodyColor}"/>
    <path d="M24 6L7 19h34L24 6z" stroke="${roofColor}"/>
    <rect x="12.5" y="22" width="6" height="5" rx="1" stroke="${bodyColor}"/>
    <rect x="29.5" y="22" width="6" height="5" rx="1" stroke="${bodyColor}"/>
    <rect x="20" y="28" width="8" height="11" rx="1.5" stroke="${bodyColor}"/>
  </g>
</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// Build lookup Sets once so resolveHouseIcon avoids repeated scans.
export const PLACE_TAG_IDS = new Set(PIN_CATEGORIES.map((c) => c.id))
const PIN_COLOR_MAP = new Map(PIN_CATEGORIES.map((c) => [c.id, c.color]))

// Per-render cache of resolved icon specs, keyed by sorted tag combination.
const _iconCache = new Map<string, { key: string; spec: HouseIconSpec }>()

/**
 * Resolve the outline icon spec for a house from its place tags.
 * Unknown or non-place tags are ignored — this is the one seam where
 * legacy status tags (rv/bs/custom) silently become no-ops if any
 * persisted project still carries them.
 */
export function resolveHouseIcon(tags: string[]): { key: string; spec: HouseIconSpec } {
  const safeTags = tags || []
  const cacheKey = safeTags.length === 0 ? '' : safeTags.slice().sort().join(',')
  const cached = _iconCache.get(cacheKey)
  if (cached) return cached

  const places = safeTags.filter((t) => PLACE_TAG_IDS.has(t))

  const placeColor1 = places.length > 0 ? (PIN_COLOR_MAP.get(places[0]) || HOUSE_DEFAULT_COLOR) : null
  const placeColor2 = places.length > 1 ? (PIN_COLOR_MAP.get(places[1]) || null) : null

  const bodyColor = placeColor1 || HOUSE_DEFAULT_COLOR
  const roofColor = placeColor2 || bodyColor

  // Build a deterministic image key
  const parts = ['house']
  if (places.length > 0) parts.push(...places.slice(0, 2).sort())
  else parts.push('default')
  const key = parts.join('-')

  const result = { key, spec: { bodyColor, roofColor } }
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
): Map<string, HouseIconSpec> {
  const defaultSpec: HouseIconSpec = { bodyColor: HOUSE_DEFAULT_COLOR, roofColor: HOUSE_DEFAULT_COLOR }
  const missing = new Map<string, HouseIconSpec>()
  if (!map.hasImage('house-default')) missing.set('house-default', defaultSpec)

  for (const h of houses) {
    const { key, spec } = resolveHouseIcon(h.tags)
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
): boolean {
  return collectMissingIcons(map, houses).size === 0
}

/**
 * Ensure all house icon variants needed for a set of houses exist on the map.
 * Call this before setting the GeoJSON source data.
 */
export async function ensureHouseIcons(
  map: MapImageHost,
  houses: Array<{ tags: string[] }>,
): Promise<void> {
  const missing = collectMissingIcons(map, houses)
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

/** Premium "Start Here" pin marker (40x48) */
export function generateStartMarkerSVG(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48">
    <defs>
      <linearGradient id="start-body" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1f8f58"/>
        <stop offset="100%" stop-color="#0f5f38"/>
      </linearGradient>
      <linearGradient id="start-flag" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#f9d976"/>
        <stop offset="100%" stop-color="#f4b942"/>
      </linearGradient>
      <filter id="s" x="-25%" y="-15%" width="150%" height="145%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#052e1a" flood-opacity="0.28"/>
      </filter>
      <filter id="shine" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.5"/>
      </filter>
    </defs>
    <path d="M20 45c0 0-14-17-14-26a14 14 0 0128 0c0 9-14 26-14 26z"
          fill="url(#start-body)" stroke="#0a4f2d" stroke-width="1.2" filter="url(#s)"/>
    <ellipse cx="20" cy="19" rx="10.5" ry="10.5" fill="#ffffff" opacity="0.96"/>
    <ellipse cx="16.5" cy="14.5" rx="5.5" ry="3" fill="#ffffff" opacity="0.28" filter="url(#shine)"/>
    <g transform="translate(12,10)">
      <path d="M6 2.5v12" stroke="#14532d" stroke-width="2.1" stroke-linecap="round"/>
      <path d="M6 3h9.2l-2.4 3.3 2.4 3.3H6" fill="url(#start-flag)" stroke="#9a6700" stroke-width="1.1" stroke-linejoin="round"/>
      <circle cx="6" cy="2.5" r="1.6" fill="#14532d"/>
    </g>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

