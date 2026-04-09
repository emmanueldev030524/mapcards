import type maplibregl from 'maplibre-gl'

export type MapImageHost = Pick<maplibregl.Map, 'hasImage' | 'addImage'>
type MutableMapImageHost = Pick<maplibregl.Map, 'hasImage' | 'addImage' | 'updateImage'>

function toSvgDataUrl(svgOrDataUrl: string): string {
  return svgOrDataUrl.startsWith('data:image/svg+xml')
    ? svgOrDataUrl
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgOrDataUrl)}`
}

export function getMapImagePixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return Math.max(1, window.devicePixelRatio || 1)
}

async function renderSvgMapImageData(
  svgOrDataUrl: string,
  width: number,
  height: number,
): Promise<{ imageData: ImageData; pixelRatio: number }> {
  const pixelRatio = getMapImagePixelRatio()
  const bitmapWidth = Math.max(1, Math.round(width * pixelRatio))
  const bitmapHeight = Math.max(1, Math.round(height * pixelRatio))

  const image = new Image()
  image.decoding = 'async'

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('Failed to decode SVG map image'))
    image.src = toSvgDataUrl(svgOrDataUrl)
  })

  const canvas = document.createElement('canvas')
  canvas.width = bitmapWidth
  canvas.height = bitmapHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to render SVG map image')

  ctx.imageSmoothingEnabled = true
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(image, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, bitmapWidth, bitmapHeight)
  return { imageData, pixelRatio }
}

export async function ensureSvgMapImage(
  map: MapImageHost,
  id: string,
  svgOrDataUrl: string,
  width: number,
  height: number,
): Promise<void> {
  if (map.hasImage(id)) return

  const { imageData, pixelRatio } = await renderSvgMapImageData(svgOrDataUrl, width, height)
  map.addImage(id, imageData, { pixelRatio })
}

export async function upsertSvgMapImage(
  map: MutableMapImageHost,
  id: string,
  svgOrDataUrl: string,
  width: number,
  height: number,
): Promise<void> {
  const { imageData, pixelRatio } = await renderSvgMapImageData(svgOrDataUrl, width, height)
  if (map.hasImage(id)) {
    map.updateImage(id, imageData)
    return
  }
  map.addImage(id, imageData, { pixelRatio })
}
