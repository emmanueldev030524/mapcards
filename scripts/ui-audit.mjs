import { chromium } from 'playwright'

const url = 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 2 })

await page.goto(url, { waitUntil: 'networkidle' })
await page.screenshot({ path: 'tmp/ui-audit-desktop.png', fullPage: true })

const basemapButton = page.getByTitle('Basemap settings')
if (await basemapButton.count()) {
  await basemapButton.click()
  await page.waitForTimeout(250)
  const streetButton = page.getByRole('button', { name: 'Street' })
  if (await streetButton.count()) {
    await streetButton.click()
    await page.waitForTimeout(250)
  }
  await page.screenshot({ path: 'tmp/ui-audit-street-panel.png', fullPage: true })
}

const collapseButton = page.getByRole('button', { name: 'Collapse panel' })
if (await collapseButton.count()) {
  await collapseButton.click()
  await page.waitForTimeout(400)
  await page.screenshot({ path: 'tmp/ui-audit-collapsed.png', fullPage: true })
}

await page.setViewportSize({ width: 390, height: 844 })
await page.goto(url, { waitUntil: 'networkidle' })
await page.screenshot({ path: 'tmp/ui-audit-mobile.png', fullPage: true })

await browser.close()
