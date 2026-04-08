import { exportToPng, type ExportOptions } from './exportPng'

export async function exportToPdf(options: ExportOptions): Promise<Blob> {
  const { cardWidthInches, cardHeightInches } = options

  // Generate the PNG first (captures live map)
  const pngBlob = await exportToPng(options)
  const pngUrl = URL.createObjectURL(pngBlob)

  try {
    // Lazy-load jsPDF at call time so the ~540KB raw chunk (jsPDF +
    // core-js polyfills) is not downloaded until the first PDF export.
    const { default: jsPDF } = await import('jspdf')
    const orientation = cardWidthInches > cardHeightInches ? 'landscape' : 'portrait'
    const pdf = new jsPDF({
      orientation,
      unit: 'in',
      format: [cardWidthInches, cardHeightInches],
    })

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
