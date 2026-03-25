import jsPDF from 'jspdf'
import { exportToPng } from './exportPng'
import type { Feature, Polygon, LineString, Point } from 'geojson'
import type { FeatureWithMeta } from '../types/project'

interface PdfExportOptions {
  boundary: Feature<Polygon>
  customRoads: FeatureWithMeta<LineString>[]
  housePoints: FeatureWithMeta<Point>[]
  territoryName: string
  territoryNumber: string
  cardWidthInches: number
  cardHeightInches: number
}

export async function exportToPdf(options: PdfExportOptions): Promise<Blob> {
  const { cardWidthInches, cardHeightInches } = options

  // Generate the PNG first
  const pngBlob = await exportToPng(options)
  const pngUrl = URL.createObjectURL(pngBlob)

  try {
    const orientation = cardWidthInches > cardHeightInches ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: [cardWidthInches, cardHeightInches],
    })

    // Load image and add to PDF
    const img = await loadImage(pngUrl)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const imgData = canvas.toDataURL('image/png')

    pdf.addImage(imgData, 'PNG', 0, 0, cardWidthInches, cardHeightInches)

    return pdf.output('blob') as unknown as Blob
  } finally {
    URL.revokeObjectURL(pngUrl)
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
