// Cross-check: ledger.web.ts (pure TS) must hash identically to ledger.ts (node:crypto).
import { sha256Hex, hmacSha256Hex, appendEntry, newChain, verifyChain, verifyAnchors } from '../src/lib/aegis/ledger.web'
import { sha256Hex as nSha, appendEntry as nAppend, newChain as nNew, verifyChain as nVerify, verifyAnchors as nVerifyA } from '../src/lib/aegis/ledger'

const cases: [string, string][] = [
  ['hello', 'hello world'],
  ['0x66ab12drainer|DECISION|0xabc|0xdef', JSON.stringify({ a: 1, b: [1, 2, { c: 'x' }], z: null })],
  ['x'.repeat(200), 'π ≈ 3.14159 — unicode edge case'],
]
for (const [k, m] of cases) {
  const a = sha256Hex(m), b = nSha(m)
  console.log('sha256 match:', a === b, a.slice(0, 12))
  const h1 = hmacSha256Hex(k, m)
  const h2 = require('node:crypto').createHmac('sha256', k).update(m).digest('hex')
  console.log('hmac   match:', h1 === h2, h1.slice(0, 12))
}

// Full chain parity: same payloads, same seq → same hashes + same verify result.
const c1 = newChain(), c2 = nNew()
const kinds = ['DECISION', 'REGISTRY', 'SENTINEL', 'DECISION', 'DECISION', 'DECISION', 'DECISION', 'COUNCIL'] as const
let identical = true
kinds.forEach((k, i) => {
  const payload = { i, agent: 'momentum-alpha', notionalUSD: 1000 + i, when: 0 } // fixed `when` for determinism
  const e1 = appendEntry(c1, k, payload, 41820000 + i)
  const e2 = nAppend(c2, k, payload, 41820000 + i)
  if (e1.hash !== e2.hash || e1.prevHash !== e2.prevHash || e1.decisionHash !== e2.decisionHash) identical = false
})
console.log('chain parity (incl. ANCHOR batch):', identical, '| web anchors:', c1.anchors.length, '| node anchors:', c2.anchors.length)
console.log('verify web:', JSON.stringify(verifyChain(c1.entries)))
console.log('verify node:', JSON.stringify(nVerify(c2.entries)))
const ra = verifyAnchors(c1.entries, c1.anchors)
const na = nVerifyA(c2.entries, c2.anchors)
console.log('anchor roots web:', ra.map(r => r.rootMatch).join(','), '| node:', na.map(r => r.rootMatch).join(','))
