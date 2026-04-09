import type maplibregl from 'maplibre-gl'

import { BRAND, BRAND_LIGHT } from './colors'
import {
  applyTooltipAttrs,
  TOOLTIP_MODAL_ATTR,
} from './tooltips'
import { createPopupCloseSvg, getPopupCloseIconSize } from './popupClose'
import {
  popupBody,
  popupCloseButton,
  popupCloseButtonTablet,
  popupContainer,
  popupHeader,
  popupHeaderSubtitle,
  popupHeaderTitle,
  popupRowLabel,
  popupSecondaryButton,
  popupSectionDivider,
  popupSectionFlat,
  popupValueBadge,
} from './popupStyles'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Helper to create an SVG element with attributes */
function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  return el
}

/** Google Earth–style compass — bold ring, wide needle, strong N/S contrast */
function createCompassSvg(size = 28): SVGSVGElement {
  const svg = svgEl('svg', { width: String(size), height: String(size), viewBox: '0 0 28 28', fill: 'none' })

  // Outer ring — bold, visible
  svg.appendChild(svgEl('circle', { cx: '14', cy: '14', r: '12', stroke: '#94a3b8', 'stroke-width': '1.5', fill: 'none' }))

  // Cardinal ticks — N is red and prominent
  svg.appendChild(svgEl('line', { x1: '14', y1: '2.5', x2: '14', y2: '5', stroke: '#dc2626', 'stroke-width': '1.8', 'stroke-linecap': 'round' }))
  svg.appendChild(svgEl('line', { x1: '14', y1: '23', x2: '14', y2: '25.5', stroke: '#94a3b8', 'stroke-width': '1.2', 'stroke-linecap': 'round' }))
  svg.appendChild(svgEl('line', { x1: '2.5', y1: '14', x2: '5', y2: '14', stroke: '#94a3b8', 'stroke-width': '1.2', 'stroke-linecap': 'round' }))
  svg.appendChild(svgEl('line', { x1: '23', y1: '14', x2: '25.5', y2: '14', stroke: '#94a3b8', 'stroke-width': '1.2', 'stroke-linecap': 'round' }))

  // North needle — bold red, wider diamond
  svg.appendChild(svgEl('path', { d: 'M14 4 L16.2 13 L14 11.5 L11.8 13 Z', fill: '#dc2626' }))
  // South needle — visible slate
  svg.appendChild(svgEl('path', { d: 'M14 24 L16.2 15 L14 16.5 L11.8 15 Z', fill: '#94a3b8' }))

  // Center pivot — solid dot
  svg.appendChild(svgEl('circle', { cx: '14', cy: '14', r: '2.2', fill: 'white', stroke: '#64748b', 'stroke-width': '1' }))
  svg.appendChild(svgEl('circle', { cx: '14', cy: '14', r: '1', fill: '#475569' }))

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
  private tiltDivider!: HTMLDivElement
  private map: maplibregl.Map | null = null
  private panelOpen = false
  private activeSlider: 'heading' | 'tilt' | null = null
  private showTilt = false

  constructor() {
    // empty
  }

  onAdd(map: maplibregl.Map): HTMLElement {
    this.map = map
    const isTablet = window.matchMedia('(max-width: 1279px)').matches

    // --- Wrapper — styled as a maplibregl-ctrl-group for consistent pill styling ---
    this.wrapper = document.createElement('div')
    this.wrapper.className = 'maplibregl-ctrl maplibregl-ctrl-group'
    Object.assign(this.wrapper.style, {
      position: 'relative',
    })

    // --- Compass button ---
    this.compassBtn = document.createElement('button')
    this.compassBtn.className = 'maplibregl-ctrl-compass'
    this.compassBtn.setAttribute('aria-label', 'Compass')
    applyTooltipAttrs(this.compassBtn, {
      label: 'Change map direction',
      description: 'Adjust heading and reset the map to north.',
    })
    const btnSize = isTablet ? '44px' : '36px'
    Object.assign(this.compassBtn.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: '0',
      width: btnSize,
      height: btnSize,
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
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

    // --- Shared popup shell ---
    this.panel = document.createElement('div')
    this.panel.className = popupContainer
    Object.assign(this.panel.style, {
      position: 'absolute',
      width: window.matchMedia('(max-width: 1279px)').matches ? '180px' : '220px',
      display: 'none',
      flexDirection: 'column',
      zIndex: '1000',
      pointerEvents: 'auto',
      opacity: '0',
      transform: 'translateY(4px) scale(0.97)',
      transition: 'opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
    })
    this.panel.setAttribute('data-compass-panel', '')
    this.panel.addEventListener('mousedown', (e) => e.stopPropagation())
    this.panel.addEventListener('click', (e) => e.stopPropagation())

    // Header row
    const header = document.createElement('div')
    header.className = popupHeader

    const headerText = document.createElement('div')
    headerText.className = 'min-w-0'

    const title = document.createElement('h3')
    title.className = popupHeaderTitle
    title.textContent = 'Orientation'
    headerText.appendChild(title)

    const subtitle = document.createElement('p')
    subtitle.className = popupHeaderSubtitle
    subtitle.textContent = 'Adjust heading and quickly return the map to north.'
    headerText.appendChild(subtitle)
    header.appendChild(headerText)

    const closeBtn = document.createElement('button')
    closeBtn.className = isTablet ? popupCloseButtonTablet : popupCloseButton
    closeBtn.appendChild(createPopupCloseSvg(getPopupCloseIconSize(isTablet)))
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closePanel()
    })
    header.appendChild(closeBtn)
    this.panel.appendChild(header)

    const body = document.createElement('div')
    body.className = popupBody
    Object.assign(body.style, {
      maxHeight: isTablet ? 'min(70vh, 32rem)' : 'min(60vh, 28rem)',
      overflowY: 'auto',
      overscrollBehavior: 'contain',
    })

    const controlsCard = document.createElement('div')
    controlsCard.className = popupSectionFlat

    // --- Tilt slider (hidden) ---
    const tiltSlider = this.createSliderRow('Tilt', '\u00b0', isTablet)
    this.tiltTrack = tiltSlider.track
    this.tiltFill = tiltSlider.fill
    this.tiltThumb = tiltSlider.thumb
    this.tiltRow = tiltSlider.row
    this.tiltRow.style.display = this.showTilt ? 'flex' : 'none'
    controlsCard.appendChild(this.tiltRow)

    this.tiltDivider = document.createElement('div')
    this.tiltDivider.className = popupSectionDivider
    this.tiltDivider.style.display = this.showTilt ? 'block' : 'none'
    controlsCard.appendChild(this.tiltDivider)

    // --- Heading slider ---
    const headingSlider = this.createSliderRow('Heading', '\u00b0', isTablet)
    this.headingTrack = headingSlider.track
    this.headingFill = headingSlider.fill
    this.headingThumb = headingSlider.thumb
    this.headingLabel = headingSlider.valueLabel
    controlsCard.appendChild(headingSlider.row)
    body.appendChild(controlsCard)

    // --- Reset to north button (pill) ---
    const resetBtn = document.createElement('button')
    resetBtn.className = popupSecondaryButton
    resetBtn.style.alignSelf = 'flex-end'
    resetBtn.textContent = 'Reset to north'
    resetBtn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (this.map) {
        this.map.easeTo({ bearing: 0, pitch: 0, duration: 400 })
      }
    })
    body.appendChild(resetBtn)
    this.panel.appendChild(body)

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
    this.tiltDivider.style.display = visible ? 'block' : 'none'
  }

  // --- Slider row builder (light theme) ---

  private createSliderRow(label: string, unit: string, isTablet = false) {
    const row = document.createElement('div')
    row.className = 'space-y-2 py-1.5'

    const topRow = document.createElement('div')
    Object.assign(topRow.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '8px',
    })

    // Label
    const lbl = document.createElement('span')
    lbl.className = popupRowLabel
    lbl.textContent = label
    topRow.appendChild(lbl)

    // Value label
    const valueLabel = document.createElement('span')
    valueLabel.className = `${popupValueBadge} inline-flex items-center justify-center`
    Object.assign(valueLabel.style, {
      minWidth: isTablet ? '42px' : '36px',
    })
    valueLabel.textContent = `0${unit}`
    topRow.appendChild(valueLabel)
    row.appendChild(topRow)

    // Track (wide hit area)
    const track = document.createElement('div')
    Object.assign(track.style, {
      width: '100%',
      height: isTablet ? '24px' : '20px',
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
      background: '#E8EAF0',
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
      width: isTablet ? '16px' : '16px',
      height: isTablet ? '16px' : '16px',
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

    return { row, track, fill, thumb, valueLabel }
  }

  // --- Panel ---

  private togglePanel() {
    if (this.panelOpen) this.closePanel()
    else this.openPanel()
  }

  private openPanel() {
    this.panelOpen = true
    this.panel.setAttribute(TOOLTIP_MODAL_ATTR, '')
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

    // Position above the compass, right-aligned near screen edge
    const right = 12
    const bottom = containerRect.bottom - groupRect.top + 8
    this.panel.style.right = `${right}px`
    this.panel.style.bottom = `${bottom}px`
    this.panel.style.top = 'auto'
    this.panel.style.left = 'auto'
  }

  private closePanel() {
    this.panelOpen = false
    this.panel.removeAttribute(TOOLTIP_MODAL_ATTR)
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
