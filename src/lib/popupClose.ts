const SVG_NS = 'http://www.w3.org/2000/svg'

export const POPUP_CLOSE_ICON_PATH = 'M4 4 L12 12 M12 4 L4 12'

export function getPopupCloseIconSize(isTablet = false) {
  return isTablet ? 18 : 16
}

export function createPopupCloseSvg(size = 16): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('aria-hidden', 'true')

  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', POPUP_CLOSE_ICON_PATH)
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '2')
  path.setAttribute('stroke-linecap', 'round')
  svg.appendChild(path)

  return svg
}

