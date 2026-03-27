import type maplibregl from 'maplibre-gl'

const SVG_NS = 'http://www.w3.org/2000/svg'

function createNeedleSvg(size = 22): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 22 22')
  svg.setAttribute('fill', 'none')

  // North (red diamond)
  const north = document.createElementNS(SVG_NS, 'path')
  north.setAttribute('d', 'M11 1.5 L13.5 11 L11 9.8 L8.5 11 Z')
  north.setAttribute('fill', '#dc2626')
  svg.appendChild(north)

  // South (dark)
  const south = document.createElementNS(SVG_NS, 'path')
  south.setAttribute('d', 'M11 20.5 L13.5 11 L11 12.2 L8.5 11 Z')
  south.setAttribute('fill', '#475569')
  svg.appendChild(south)

  // Center dot
  const dot = document.createElementNS(SVG_NS, 'circle')
  dot.setAttribute('cx', '11')
  dot.setAttribute('cy', '11')
  dot.setAttribute('r', '1.5')
  dot.setAttribute('fill', '#94a3b8')
  svg.appendChild(dot)

  return svg
}

/**
 * Google Earth-style compass with heading slider popup.
 * Click compass -> popup with drag slider for heading.
 * Tilt slider hidden but wired for future use.
 */
export class CompassControl implements maplibregl.IControl {
  private wrapper!: HTMLDivElement
  private compassBtn!: HTMLDivElement
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

    // --- Wrapper ---
    this.wrapper = document.createElement('div')
    Object.assign(this.wrapper.style, {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
    })

    // --- Compass button (44px circle) ---
    this.compassBtn = document.createElement('div')
    this.compassBtn.className = 'maplibregl-ctrl'
    Object.assign(this.compassBtn.style, {
      width: '44px',
      height: '44px',
      borderRadius: '50%',
      background: '#ffffff',
      boxShadow: '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      userSelect: 'none',
      position: 'relative',
      flexShrink: '0',
      transition: 'box-shadow 0.2s, transform 0.15s',
    })
    this.compassBtn.addEventListener('mouseenter', () => {
      this.compassBtn.style.boxShadow = '0 3px 12px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)'
      this.compassBtn.style.transform = 'scale(1.05)'
    })
    this.compassBtn.addEventListener('mouseleave', () => {
      this.compassBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)'
      this.compassBtn.style.transform = 'scale(1)'
    })

    // Outer ring
    const ring = document.createElement('div')
    Object.assign(ring.style, {
      position: 'absolute',
      inset: '3px',
      borderRadius: '50%',
      border: '1px solid #e2e8f0',
    })
    this.compassBtn.appendChild(ring)

    // 8 tick marks (N, NE, E, SE, S, SW, W, NW)
    for (let i = 0; i < 8; i++) {
      const tick = document.createElement('div')
      const isCardinal = i % 2 === 0
      Object.assign(tick.style, {
        position: 'absolute',
        width: isCardinal ? '2px' : '1px',
        height: isCardinal ? '5px' : '3px',
        background: isCardinal ? '#94a3b8' : '#cbd5e1',
        top: isCardinal ? '3px' : '4px',
        left: '50%',
        transformOrigin: `50% ${22 - (isCardinal ? 3 : 4)}px`,
        transform: `translateX(-50%) rotate(${i * 45}deg)`,
        pointerEvents: 'none',
        borderRadius: '1px',
      })
      this.compassBtn.appendChild(tick)
    }

    // "N" letter at top
    const nLabel = document.createElement('span')
    Object.assign(nLabel.style, {
      position: 'absolute',
      top: '3px',
      left: '50%',
      transform: 'translateX(-50%)',
      fontSize: '7px',
      fontWeight: '700',
      color: '#dc2626',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      pointerEvents: 'none',
      lineHeight: '1',
      opacity: '0',  // hidden until we have room, needle covers it
    })
    nLabel.textContent = 'N'
    this.compassBtn.appendChild(nLabel)

    // Needle
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
    this.needle.appendChild(createNeedleSvg())
    this.compassBtn.appendChild(this.needle)

    this.compassBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.togglePanel()
    })
    this.wrapper.appendChild(this.compassBtn)

    // --- Dark popup panel (appended to map container to escape canvas stacking context) ---
    this.panel = document.createElement('div')
    Object.assign(this.panel.style, {
      position: 'absolute',
      width: '240px',
      background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
      borderRadius: '14px',
      padding: '16px 18px 14px',
      boxShadow: '0 12px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.06)',
      display: 'none',
      flexDirection: 'column',
      gap: '12px',
      zIndex: '1000',
      backdropFilter: 'blur(8px)',
      pointerEvents: 'auto',
    })
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation())
    this.panel.addEventListener('click', (e) => e.stopPropagation())

    // Header row (title + close)
    const header = document.createElement('div')
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '2px',
    })

    const title = document.createElement('span')
    Object.assign(title.style, {
      color: '#e2e8f0',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    })
    title.textContent = 'Orientation'
    header.appendChild(title)

    const closeBtn = document.createElement('button')
    Object.assign(closeBtn.style, {
      background: 'none',
      border: 'none',
      color: '#64748b',
      fontSize: '16px',
      cursor: 'pointer',
      lineHeight: '1',
      padding: '2px 4px',
      borderRadius: '4px',
      transition: 'color 0.15s, background 0.15s',
    })
    closeBtn.textContent = '\u2715'
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.color = '#e2e8f0'
      closeBtn.style.background = 'rgba(255,255,255,0.08)'
    })
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.color = '#64748b'
      closeBtn.style.background = 'none'
    })
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closePanel()
    })
    header.appendChild(closeBtn)
    this.panel.appendChild(header)

    // Separator
    const sep = document.createElement('div')
    Object.assign(sep.style, {
      height: '1px',
      background: 'rgba(255,255,255,0.06)',
      margin: '0 -4px',
    })
    this.panel.appendChild(sep)

    // --- Tilt slider (hidden) ---
    const tiltSlider = this.createSliderRow('Tilt', '\u00b0')
    this.tiltTrack = tiltSlider.track
    this.tiltFill = tiltSlider.fill
    this.tiltThumb = tiltSlider.thumb
    this.tiltRow = tiltSlider.row
    this.tiltRow.style.display = this.showTilt ? 'flex' : 'none'
    this.panel.appendChild(this.tiltRow)

    // --- Heading slider ---
    const headingSlider = this.createSliderRow('Heading', '\u00b0')
    this.headingTrack = headingSlider.track
    this.headingFill = headingSlider.fill
    this.headingThumb = headingSlider.thumb
    this.headingLabel = headingSlider.valueLabel
    this.panel.appendChild(headingSlider.row)

    // --- Reset to north ---
    const resetBtn = document.createElement('button')
    Object.assign(resetBtn.style, {
      color: '#60a5fa',
      fontSize: '11px',
      fontWeight: '500',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      alignSelf: 'flex-end',
      padding: '4px 8px',
      borderRadius: '6px',
      transition: 'background 0.15s, color 0.15s',
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
      resetBtn.style.background = 'rgba(96,165,250,0.1)'
      resetBtn.style.color = '#93c5fd'
    })
    resetBtn.addEventListener('mouseleave', () => {
      resetBtn.style.background = 'none'
      resetBtn.style.color = '#60a5fa'
    })
    this.panel.appendChild(resetBtn)

    // Append panel to map container (not the control group) so it renders above the canvas
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

  // --- Slider row builder ---

  private createSliderRow(label: string, unit: string) {
    const row = document.createElement('div')
    Object.assign(row.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    })

    // Label
    const lbl = document.createElement('span')
    Object.assign(lbl.style, {
      color: '#94a3b8',
      fontSize: '12px',
      fontWeight: '500',
      minWidth: '56px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    })
    lbl.textContent = label
    row.appendChild(lbl)

    // Track (wide hit area)
    const track = document.createElement('div')
    Object.assign(track.style, {
      flex: '1',
      height: '28px',
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
      background: '#334155',
      borderRadius: '4px',
      position: 'relative',
      overflow: 'visible',
    })

    // Active fill
    const fill = document.createElement('div')
    Object.assign(fill.style, {
      height: '100%',
      background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
      borderRadius: '4px',
      width: '0%',
      pointerEvents: 'none',
      transition: 'width 0.05s ease-out',
    })
    bar.appendChild(fill)

    // Thumb
    const thumb = document.createElement('div')
    Object.assign(thumb.style, {
      width: '14px',
      height: '14px',
      borderRadius: '50%',
      background: '#ffffff',
      border: '2px solid #3b82f6',
      boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      position: 'absolute',
      top: '50%',
      left: '0%',
      transform: 'translate(-50%, -50%)',
      cursor: 'grab',
      transition: 'box-shadow 0.15s, transform 0.15s',
      pointerEvents: 'none',
    })
    bar.appendChild(thumb)
    track.appendChild(bar)
    row.appendChild(track)

    // Value label (e.g., "127°")
    const valueLabel = document.createElement('span')
    Object.assign(valueLabel.style, {
      color: '#cbd5e1',
      fontSize: '11px',
      fontWeight: '600',
      fontFamily: 'monospace',
      minWidth: '36px',
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
    this.syncAll()
  }

  private positionPanel() {
    if (!this.map) return
    const containerRect = this.map.getContainer().getBoundingClientRect()
    const btnRect = this.compassBtn.getBoundingClientRect()
    // Position to the left of the compass button, vertically aligned to bottom
    const right = containerRect.right - btnRect.left + 10
    const bottom = containerRect.bottom - btnRect.bottom
    this.panel.style.right = `${right}px`
    this.panel.style.bottom = `${bottom}px`
  }

  private closePanel() {
    this.panelOpen = false
    this.panel.style.display = 'none'
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
