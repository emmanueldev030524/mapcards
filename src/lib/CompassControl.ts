import type maplibregl from 'maplibre-gl'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Brand color from @theme */
const BRAND = '#4B6CA7'
const BRAND_LIGHT = '#5A7DB8'

/** Helper to create an SVG element with attributes */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

/** Modern compass SVG — thin outer ring, tapered diamond needle, pivot dot */
function createCompassSvg(size = 28): SVGSVGElement {
  const svg = svgEl('svg', { width: String(size), height: String(size), viewBox: '0 0 28 28', fill: 'none' })

  // Outer ring
  svg.appendChild(svgEl('circle', { cx: '14', cy: '14', r: '12.5', stroke: '#d1d5db', 'stroke-width': '0.75', fill: 'none' }))

  // Cardinal ticks (N thicker)
  svg.appendChild(svgEl('line', { x1: '14', y1: '2.5', x2: '14', y2: '4.5', stroke: '#9ca3af', 'stroke-width': '1', 'stroke-linecap': 'round' }))
  svg.appendChild(svgEl('line', { x1: '14', y1: '23.5', x2: '14', y2: '25.5', stroke: '#d1d5db', 'stroke-width': '0.75', 'stroke-linecap': 'round' }))
  svg.appendChild(svgEl('line', { x1: '2.5', y1: '14', x2: '4.5', y2: '14', stroke: '#d1d5db', 'stroke-width': '0.75', 'stroke-linecap': 'round' }))
  svg.appendChild(svgEl('line', { x1: '23.5', y1: '14', x2: '25.5', y2: '14', stroke: '#d1d5db', 'stroke-width': '0.75', 'stroke-linecap': 'round' }))

  // North needle (red, tapered diamond)
  svg.appendChild(svgEl('path', { d: 'M14 3.5 L15.6 13 L14 12 L12.4 13 Z', fill: '#dc2626' }))
  // South needle (soft gray)
  svg.appendChild(svgEl('path', { d: 'M14 24.5 L15.6 15 L14 16 L12.4 15 Z', fill: '#cbd5e1' }))

  // Center pivot
  svg.appendChild(svgEl('circle', { cx: '14', cy: '14', r: '1.8', fill: 'white', stroke: '#d1d5db', 'stroke-width': '0.75' }))
  svg.appendChild(svgEl('circle', { cx: '14', cy: '14', r: '0.8', fill: '#9ca3af' }))

  return svg
}

/**
 * Premium compass control with heading slider popup.
 * Frosted-glass light theme matching the app's design system.
 */
export class CompassControl implements maplibregl.IControl {
  private wrapper!: HTMLDivElement
  private compassBtn!: HTMLButtonElement
  private needle!: HTMLDivElement
  private panel!: HTMLDivElement
  private headingThumb!: HTMLDivElement
  private headingTrack!: HTMLDivElement
  private headingFill!: HTMLDivElement
  private headingLabel!: HTMLSpanElement
  private tiltThumb!: HTMLDivElement
  private tiltTrack!: HTMLDivElement
  private tiltFill!: HTMLDivElement
  private tiltRow!: HTMLDivElement
  private map: maplibregl.Map | null = null
  private panelOpen = false
  private activeSlider: 'heading' | 'tilt' | null = null
  private showTilt = false

  constructor() {
    // empty
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map
    const isTablet = window.matchMedia('(max-width: 1023px)').matches

    // --- Wrapper ---
    this.wrapper = document.createElement('div')
    Object.assign(this.wrapper.style, {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    })

    // --- Compass button (styled as a native MapLibre nav button) ---
    this.compassBtn = document.createElement('button')
    this.compassBtn.className = 'maplibregl-ctrl-compass'
    this.compassBtn.title = 'Orientation'
    Object.assign(this.compassBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: '0',
    })

    // Needle (the SVG contains its own ring + ticks)
    this.needle = document.createElement('div')
    Object.assign(this.needle.style, {
      position: 'absolute',
      inset: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'none',
      transition: 'transform 0.15s ease-out',
    })
    this.needle.appendChild(createCompassSvg(isTablet ? 28 : 24))
    this.compassBtn.appendChild(this.needle)

    this.compassBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.togglePanel()
    })
    this.wrapper.appendChild(this.compassBtn)

    // --- Frosted glass popup panel ---
    this.panel = document.createElement('div')
    Object.assign(this.panel.style, {
      position: 'absolute',
      width: '220px',
      background: 'rgba(255,255,255,0.92)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.6)',
      padding: '14px 16px 12px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 6px rgba(0,0,0,0.04)',
      display: 'none',
      flexDirection: 'column',
      gap: '10px',
      zIndex: '1000',
      pointerEvents: 'auto',
      opacity: '0',
      transform: 'translateY(4px) scale(0.97)',
      transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    })
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation())
    this.panel.addEventListener('click', (e) => e.stopPropagation())

    // Header row
    const header = document.createElement('div')
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    })

    const title = document.createElement('span')
    Object.assign(title.style, {
      color: '#374151',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
    })
    title.textContent = 'Orientation'
    header.appendChild(title)

    const closeBtn = document.createElement('button')
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#9ca3af',
      fontSize: isTablet ? '16px' : '14px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: isTablet ? '6px' : '4px',
      borderRadius: '50%',
      width: isTablet ? '32px' : '24px',
      height: isTablet ? '32px' : '24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'color 0.15s, background 0.15s',
    })
    closeBtn.textContent = '\u2715'
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#374151'
      closeBtn.style.background = 'rgba(0,0,0,0.05)'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = '#9ca3af'
      closeBtn.style.background = 'none'
    })
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closePanel()
    })
    header.appendChild(closeBtn)
    this.panel.appendChild(header)

    // --- Tilt slider (hidden) ---
    const tiltSlider = this.createSliderRow('Tilt', '\u00b0', isTablet)
    this.tiltTrack = tiltSlider.track
    this.tiltFill = tiltSlider.fill
    this.tiltThumb = tiltSlider.thumb
    this.tiltRow = tiltSlider.row
    this.tiltRow.style.display = this.showTilt ? 'flex' : 'none'
    this.panel.appendChild(this.tiltRow)

    // --- Heading slider ---
    const headingSlider = this.createSliderRow('Heading', '\u00b0', isTablet)
    this.headingTrack = headingSlider.track
    this.headingFill = headingSlider.fill
    this.headingThumb = headingSlider.thumb
    this.headingLabel = headingSlider.valueLabel
    this.panel.appendChild(headingSlider.row)

    // --- Reset to north button (pill) ---
    const resetBtn = document.createElement('button')
    Object.assign(resetBtn.style, {
      color: BRAND,
      fontSize: isTablet ? '13px' : '11px',
      fontWeight: '600',
      fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
      background: 'rgba(75,108,167,0.06)',
      border: 'none',
      cursor: 'pointer',
      alignSelf: 'flex-end',
      padding: isTablet ? '8px 16px' : '5px 12px',
      borderRadius: '9999px',
      transition: 'background 0.15s, color 0.15s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    })
    resetBtn.textContent = 'Reset to north'
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this.map) {
        this.map.easeTo({ bearing: 0, pitch: 0, duration: 400 })
      }
    })
    resetBtn.addEventListener('mouseenter', () => {
      resetBtn.style.background = 'rgba(75,108,167,0.12)'
      resetBtn.style.color = BRAND_LIGHT
    })
    resetBtn.addEventListener('mouseleave', () => {
      resetBtn.style.background = 'rgba(75,108,167,0.06)'
      resetBtn.style.color = BRAND
    })
    resetBtn.addEventListener('mousedown', () => {
      resetBtn.style.transform = 'scale(0.95)'
    })
    resetBtn.addEventListener('mouseup', () => {
      resetBtn.style.transform = 'scale(1)'
    })
    this.panel.appendChild(resetBtn)

    // Append panel to map container
    map.getContainer().appendChild(this.panel)

    // --- Global drag listeners ---
    window.addEventListener('mousemove', this.onSliderMove)
    window.addEventListener('mouseup', this.onSliderUp)
    window.addEventListener('touchmove', this.onSliderTouchMove, { passive: false })
    window.addEventListener('touchend', this.onSliderUp)

    // Sync
    map.on('rotate', this.syncAll)
    map.on('pitch', this.syncAll)
    this.syncAll()

    return this.wrapper
  }

  onRemove(): void {
    window.removeEventListener('mousemove', this.onSliderMove)
    window.removeEventListener('mouseup', this.onSliderUp)
    window.removeEventListener('touchmove', this.onSliderTouchMove)
    window.removeEventListener('touchend', this.onSliderUp)

    if (this.map) {
      this.map.off('rotate', this.syncAll)
      this.map.off('pitch', this.syncAll)
      this.map = null
    }
    this.panel.remove()
    this.wrapper.remove()
  }

  /** Show or hide the tilt slider at runtime */
  setTiltVisible(visible: boolean) {
    this.showTilt = visible
    this.tiltRow.style.display = visible ? 'flex' : 'none'
  }

  // --- Slider row builder (light theme) ---

  private createSliderRow(label: string, unit: string, isTablet = false) {
    const row = document.createElement('div')
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    })

    // Label
    const lbl = document.createElement('span')
    Object.assign(lbl.style, {
      color: '#6b7280',
      fontSize: '12px',
      fontWeight: '500',
      minWidth: '52px',
      fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
    })
    lbl.textContent = label
    row.appendChild(lbl)

    // Track (wide hit area)
    const track = document.createElement('div')
    Object.assign(track.style, {
      flex: '1',
      height: isTablet ? '36px' : '28px',
      display: 'flex',
      alignItems: 'center',
      cursor: 'pointer',
      position: 'relative',
    })
    track.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.activeSlider = label.toLowerCase() as 'heading' | 'tilt'
      this.applySliderValue(e.clientX)
    })
    track.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return
      e.preventDefault()
      e.stopPropagation()
      this.activeSlider = label.toLowerCase() as 'heading' | 'tilt'
      this.applySliderValue(e.touches[0].clientX)
    }, { passive: false })

    // Bar background
    const bar = document.createElement('div')
    Object.assign(bar.style, {
      width: '100%',
      height: '4px',
      background: '#e5e7eb',
      borderRadius: '9999px',
      position: 'relative',
      overflow: 'visible',
    })

    // Active fill (brand gradient)
    const fill = document.createElement('div')
    Object.assign(fill.style, {
      height: '100%',
      background: `linear-gradient(90deg, ${BRAND}, ${BRAND_LIGHT})`,
      borderRadius: '9999px',
      width: '0%',
      pointerEvents: 'none',
      transition: 'width 0.05s ease-out',
    })
    bar.appendChild(fill)

    // Thumb (matches existing range inputs)
    const thumb = document.createElement('div')
    Object.assign(thumb.style, {
      width: isTablet ? '18px' : '14px',
      height: isTablet ? '18px' : '14px',
      borderRadius: '50%',
      background: '#ffffff',
      border: `2.5px solid ${BRAND}`,
      boxShadow: '0 1px 4px rgba(75,108,167,0.25)',
      position: 'absolute',
      top: '50%',
      left: '0%',
      transform: 'translate(-50%, -50%)',
      cursor: 'grab',
      transition: 'box-shadow 0.15s, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
      pointerEvents: 'none',
    })
    bar.appendChild(thumb)
    track.appendChild(bar)
    row.appendChild(track)

    // Value label
    const valueLabel = document.createElement('span')
    Object.assign(valueLabel.style, {
      color: '#374151',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: "'Outfit', system-ui, -apple-system, sans-serif",
      fontVariantNumeric: 'tabular-nums',
      minWidth: '32px',
      textAlign: 'right',
    })
    valueLabel.textContent = `0${unit}`
    row.appendChild(valueLabel)

    return { row, track, fill, thumb, valueLabel }
  }

  // --- Panel ---

  private togglePanel() {
    if (this.panelOpen) this.closePanel()
    else this.openPanel()
  }

  private openPanel() {
    this.panelOpen = true
    this.positionPanel()
    this.panel.style.display = 'flex'
    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      this.panel.style.opacity = '1'
      this.panel.style.transform = 'translateY(0) scale(1)'
    })
    this.syncAll()
  }

  private positionPanel() {
    if (!this.map) return
    const containerRect = this.map.getContainer().getBoundingClientRect()
    const group = this.compassBtn.closest('.maplibregl-ctrl-group') || this.compassBtn
    const groupRect = group.getBoundingClientRect()

    // On narrow screens (<600px), position below the control group, right-aligned
    // On wider screens, position to the left of the control group, top-aligned
    const isNarrow = containerRect.width < 600
    if (isNarrow) {
      const right = containerRect.right - groupRect.right
      const top = groupRect.bottom - containerRect.top + 8
      this.panel.style.right = `${right}px`
      this.panel.style.top = `${top}px`
    } else {
      const right = containerRect.right - groupRect.left + 8
      const top = groupRect.top - containerRect.top
      this.panel.style.right = `${right}px`
      this.panel.style.top = `${top}px`
    }
    this.panel.style.bottom = 'auto'
  }

  private closePanel() {
    this.panelOpen = false
    this.panel.style.opacity = '0'
    this.panel.style.transform = 'translateY(4px) scale(0.97)'
    // Hide after transition completes
    setTimeout(() => {
      if (!this.panelOpen) this.panel.style.display = 'none'
    }, 200)
  }

  // --- Sync ---

  private syncAll = () => {
    if (!this.map) return

    const bearing = this.map.getBearing()
    const pitch = this.map.getPitch()

    // Needle rotation
    this.needle.style.transform = `rotate(${-bearing}deg)`

    // Heading: normalize to 0..360
    const normBearing = ((bearing % 360) + 360) % 360
    const hPct = normBearing / 360
    this.headingFill.style.width = `${hPct * 100}%`
    this.headingThumb.style.left = `${hPct * 100}%`
    this.headingLabel.textContent = `${Math.round(normBearing)}\u00b0`

    // Tilt: 0..85
    const tPct = pitch / 85
    this.tiltFill.style.width = `${tPct * 100}%`
    this.tiltThumb.style.left = `${tPct * 100}%`
  }

  // --- Slider drag ---

  private onSliderMove = (e: MouseEvent) => {
    if (!this.activeSlider) return
    e.preventDefault()
    this.applySliderValue(e.clientX)
  }

  private onSliderTouchMove = (e: TouchEvent) => {
    if (!this.activeSlider || e.touches.length !== 1) return
    e.preventDefault()
    this.applySliderValue(e.touches[0].clientX)
  }

  private onSliderUp = () => {
    this.activeSlider = null
  }

  private applySliderValue(clientX: number) {
    if (!this.map || !this.activeSlider) return

    const track = this.activeSlider === 'heading' ? this.headingTrack : this.tiltTrack
    const rect = track.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))

    if (this.activeSlider === 'heading') {
      this.map.setBearing(pct * 360)
    } else {
      this.map.setPitch(pct * 85)
    }
  }
}
