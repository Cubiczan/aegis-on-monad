// Record the Aegis demo as per-scene 1920x1080 WebM clips via Playwright.
// Scenes map 1:1 to the final video sections; FFMPEG assembles the rest.
// Run: bun scripts/record-demo.ts   (engine on :3003, gateway on :81)

import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const EXE = '/home/z/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome'
const BASE = 'http://localhost:81/'
const OUT = '/home/z/my-project/media/raw'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

mkdirSync(OUT, { recursive: true })

async function scene(browser: Awaited<ReturnType<typeof chromium.launch>>, name: string, fn: (page: import('playwright-core').Page) => Promise<void>) {
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  })
  const page = await ctx.newPage()
  try {
    await fn(page)
    console.log(`[rec] scene ${name} OK`)
  } catch (e) {
    console.error(`[rec] scene ${name} FAILED:`, e)
    process.exitCode = 1
  }
  await page.close().catch(() => {})
  await ctx.close() // flushes the webm to disk
}

const browser = await chromium.launch({
  executablePath: EXE,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--mute-audio', '--force-color-profile=srgb'],
})

// 01 — Overview: telemetry, trust strip, live feed scrolling
await scene(browser, '01-overview', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=ENGINE LIVE', { timeout: 15000 })
  await sleep(17000)
})

// 02 — Trading desk: signals -> council -> gate -> broadcast
await scene(browser, '02-desk', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Trading Desk")')
  await sleep(21000)
})

// 03 — Policy gate: CHP rules, live caps
await scene(browser, '03-gate', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Policy Gate")')
  await sleep(12000)
})

// 04 — Treasury: LIVE Zerion fetch
await scene(browser, '04-zerion', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Treasury")')
  await sleep(1600)
  await page.click('button:has-text("vitalik.eth")')
  await sleep(8000) // live fetch + caps recalibration
  await sleep(9000)
})

// 05 — Drain drill: autonomous pause, then human resume
await scene(browser, '05-drain', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Sentinel")')
  await sleep(1500)
  await page.click('button:has-text("RUN") >> nth=0')
  await sleep(22000)
  await page.click('button:has-text("HUMAN KEY")')
  await sleep(5000)
})

// 06 — Flash-loan drill: false-positive stand-down
await scene(browser, '06-flashloan', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Sentinel")')
  await sleep(1200)
  await page.click('button:has-text("RUN") >> nth=1')
  await sleep(13000)
})

// 07 — Proof ledger: full chain verify
await scene(browser, '07-ledger', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Proof Ledger")')
  await sleep(1500)
  await page.click('button:has-text("VERIFY CHAIN")')
  await sleep(12000)
})

// 08 — Registry + contracts
await scene(browser, '08-registry', async (page) => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.click('button:has-text("Registry")')
  await sleep(1200)
  await page.fill('input[placeholder="e.g. basis-arb-v2"]', 'basis-arb-v2')
  await page.fill('input[placeholder="aegis://dreamdesk/basis-arb"]', 'aegis://dreamdesk/basis-arb')
  await page.fill('input[placeholder="spot, delta-neutral"]', 'spot, basis-trade')
  await page.click('button:has-text("REGISTER ON MONAD")')
  await sleep(6500)
  await page.click('button:has-text("Contracts")')
  await sleep(2500)
  await page.mouse.wheel(0, 900)
  await sleep(3500)
  await page.mouse.wheel(0, 900)
  await sleep(3000)
})

await browser.close()
console.log('[rec] all scenes recorded')
