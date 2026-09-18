// Render video cards + thumbnail from media/cards.html via Playwright screenshots.
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const EXE = '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
const OUT = '/home/z/my-project/media/cards'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'] })
const page = await browser.newPage({ viewport: { width: 2000, height: 1200 }, deviceScaleFactor: 1 })
await page.goto('file:///home/z/my-project/media/cards.html')
await page.waitForTimeout(600)

const ids = ['c-title', 'c-desk', 'c-treasury', 'c-sentinel', 'c-proof', 'c-identity', 'c-end']
for (const id of ids) {
  const el = page.locator(`#${id}`)
  await el.scrollIntoViewIfNeeded()
  await el.screenshot({ path: `${OUT}/${id}.png` })
  console.log(`rendered ${id}.png`)
}
const thumb = page.locator('#thumb')
await thumb.scrollIntoViewIfNeeded()
await thumb.screenshot({ path: `${OUT}/thumbnail.png` })
console.log('rendered thumbnail.png')

await browser.close()
