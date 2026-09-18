// Generates src/lib/aegis/zerionSnapshot.ts — a bundled static portfolio so the
// browser-local demo engine (Vercel deployment, engine not connected) shows a
// realistic Treasury tab. Data is public on-chain info via Zerion v1.
import fs from 'node:fs'
const key = fs.readFileSync('/home/z/my-project/.env','utf8').match(/ZERION_API_KEY=(.+)/)?.[1]?.trim()
if (!key) { console.error('no key'); process.exit(1) }
const b64 = Buffer.from(key + ':').toString('base64')
const H = { Authorization: 'Basic ' + b64, accept: 'application/json' }
const addr = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const t0 = Date.now()
const posRes = await fetch(`https://api.zerion.io/v1/wallets/${addr}/positions/?currency=usd&filter[positions]=only&sort=value&page[size]=100`, { headers: H })
if (!posRes.ok) { console.error('positions HTTP', posRes.status); process.exit(1) }
const posJson = await posRes.json()
const portRes = await fetch(`https://api.zerion.io/v1/wallets/${addr}/portfolio?currency=usd`, { headers: H })
if (!portRes.ok) { console.error('portfolio HTTP', portRes.status); process.exit(1) }
const portJson = await portRes.json()
const latencyMs = Date.now() - t0

const positions = (posJson.data || []).map((d) => {
  const a = d.attributes
  const f = a.fungible_info || {}
  return {
    symbol: f.symbol ?? '?',
    name: f.name ?? '',
    qty: Math.round((a.quantity?.float ?? 0) * 1e6) / 1e6,
    value: Math.round(a.value ?? 0),
    price: a.price ?? 0,
    chain: d.relationships?.chain?.data?.id ?? 'unknown',
    verified: Boolean(f.icon?.verified_flag),
    icon: f.icon?.url ?? null,
    change1d: Math.round((a.changes?.percent_1d ?? 0) * 100) / 100,
  }
}).filter((p) => p.value > 200).sort((a, b) => b.value - a.value).slice(0, 24)

const at = portJson.data.attributes
const byChainMap = at.positions_distribution_by_chain || {}
const byChain = Object.entries(byChainMap).map(([id, usd]) => ({ id, usd: Math.round(usd) })).sort((a, b) => b.usd - a.usd)
const snap = {
  address: addr,
  totalUSD: Math.round(at.total.positions),
  byType: at.positions_distribution_by_type || {},
  byChain,
  positions,
  changes: { absolute: { '1d': Math.round(at.changes.absolute_1d) }, percent: { '1d': Math.round(at.changes.percent_1d * 100) / 100 } },
  fetchedAt: Date.now(),
  latencyMs,
  stale: true,
}
const ts = `// Aegis — static Zerion portfolio snapshot (PUBLIC on-chain data, fetched
// ${new Date().toISOString()}).
// Bundled so the browser-local demo engine can render the Treasury tab and
// derive a demo CHP envelope when the engine service is not connected
// (e.g. Vercel serverless deployment). NOT live data — the live path is
// Zerion API via the engine (local) or /api/zerion (serverless).
// Regenerate: node scripts/gen-zerion-snapshot.mjs

import type { ZerionPortfolio } from './types'

export const ZERION_SNAPSHOT: ZerionPortfolio = ${JSON.stringify(snap, null, 2)}
`
fs.writeFileSync('/home/z/my-project/src/lib/aegis/zerionSnapshot.ts', ts)
console.log('written:', snap.totalUSD, 'NAV,', positions.length, 'positions,', byChain.length, 'chains,', latencyMs + 'ms')
