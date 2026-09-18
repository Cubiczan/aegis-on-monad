// Generates src/lib/aegis/zerionSnapshot.ts — bundled static portfolio for the
// browser-local demo engine (used when the engine service is not connected,
// e.g. Vercel deployment). Public on-chain data via the project's Zerion client.
// Run: bun scripts/gen-zerion-snapshot.ts
import { writeFileSync } from 'node:fs'
import { getZerionPortfolioCached } from '../src/lib/aegis/zerion'

const ADDR = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'
const pf = await getZerionPortfolioCached(ADDR)
const snap = {
  ...pf,
  positions: pf.positions.filter((p) => p.value > 200).slice(0, 24).map((p) => ({
    ...p,
    qty: Math.round(p.qty * 1e6) / 1e6,
    value: Math.round(p.value),
    change1d: p.change1d !== undefined ? Math.round(p.change1d * 100) / 100 : undefined,
  })),
  totalUSD: Math.round(pf.totalUSD),
  fetchedAt: Date.now(),
  stale: true,
}
if (!snap.positions.length || !snap.totalUSD) { console.error('empty snapshot — aborting'); process.exit(1) }
const ts = `// Aegis — static Zerion portfolio snapshot (PUBLIC on-chain data, fetched
// ${new Date().toISOString()} via Zerion v1 for ${ADDR}).
// Bundled so the browser-local demo engine can render the Treasury tab and
// derive a demo CHP envelope when the engine service is not connected
// (e.g. Vercel serverless deployment). NOT live data — the live path is
// Zerion API via the engine (local dev) or /api/zerion (serverless proxy).
// Regenerate: bun scripts/gen-zerion-snapshot.ts

import type { ZerionPortfolio } from './types'

export const ZERION_SNAPSHOT: ZerionPortfolio = ${JSON.stringify(snap, null, 2)}
`
writeFileSync('/home/z/my-project/src/lib/aegis/zerionSnapshot.ts', ts)
console.log(`written: NAV $${snap.totalUSD.toLocaleString()} · ${snap.positions.length} positions · ${snap.byChain.length} chains · ${pf.latencyMs}ms`)
