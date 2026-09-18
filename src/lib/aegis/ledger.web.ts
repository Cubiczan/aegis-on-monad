// Aegis proof layer — BROWSER build of the HMAC-SHA256 chained ledger.
// Mirrors ledger.ts (node:crypto) API 1:1 but with a pure-TS sync SHA-256 +
// HMAC so the local demo engine can run inside the browser tab (Vercel
// deployment, engine service not connected). Hash outputs are byte-identical
// to the node implementation — verified in scripts/test-ledger-web.ts.

import type { AnchorRecord, LedgerEntry, LedgerKind } from './types'

export const ANCHOR_BATCH_SIZE = 6
const HMAC_KEY = 'aegis-chp-v1-monad-testnet-hmac' // mirrors ledger.ts default

// ---------------------------------------------------------------- sha256

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

export function sha256Bytes(msg: Uint8Array): Uint8Array {
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ])
  const bitLen = msg.length * 8
  const padded = new Uint8Array((((msg.length + 8) >> 6) + 1) << 6)
  padded.set(msg)
  padded[msg.length] = 0x80
  const dv = new DataView(padded.buffer)
  dv.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000))
  dv.setUint32(padded.length - 4, bitLen >>> 0)

  const w = new Uint32Array(64)
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4)
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (S0 + maj) >>> 0
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
    }
    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0; H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0; H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0
  }
  const out = new Uint8Array(32)
  const odv = new DataView(out.buffer)
  for (let i = 0; i < 8; i++) odv.setUint32(i * 4, H[i])
  return out
}

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
const hex = (b: Uint8Array): string => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')

export function sha256Hex(input: string): string {
  return hex(sha256Bytes(utf8(input)))
}

export function hmacSha256Hex(key: string, msg: string): string {
  let keyBytes = utf8(key)
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes)
  const ipad = new Uint8Array(64 + utf8(msg).length)
  const opad = new Uint8Array(64 + 32)
  for (let i = 0; i < 64; i++) {
    ipad[i] = (keyBytes[i] ?? 0) ^ 0x36
    opad[i] = (keyBytes[i] ?? 0) ^ 0x5c
  }
  ipad.set(utf8(msg), 64)
  opad.set(sha256Bytes(ipad), 64)
  return hex(sha256Bytes(opad))
}

// ---------------------------------------------------------------- shared helpers (parity with ledger.ts)

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

export function decisionHash(payload: Record<string, unknown>): string {
  return '0x' + sha256Hex(canonicalJson(payload))
}

const rndHex = (bytes: number): string => {
  const b = new Uint8Array(bytes)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b)
  else for (let i = 0; i < bytes; i++) b[i] = Math.floor(Math.random() * 256)
  return hex(b)
}

export function randomHex(bytes: number): string { return rndHex(bytes) }
export function txHash(): string { return '0x' + rndHex(32) }
export function agentAddress(): string { return '0x' + rndHex(20) }

// ---------------------------------------------------------------- chain (parity with ledger.ts)

export interface ChainState {
  seq: number
  head: string
  entries: LedgerEntry[]
  pendingAnchors: string[]
  anchors: AnchorRecord[]
}

export function newChain(): ChainState {
  return { seq: 0, head: '0x' + '0'.repeat(64), entries: [], pendingAnchors: [], anchors: [] }
}

function seal(seq: number, kind: LedgerKind, dHash: string, prevHash: string): string {
  return '0x' + hmacSha256Hex(HMAC_KEY, `${seq}|${kind}|${dHash}|${prevHash}`)
}

export function appendEntry(
  chain: ChainState,
  kind: LedgerKind,
  payload: Record<string, unknown>,
  blockHeight: number,
): LedgerEntry {
  const seq = chain.seq + 1
  const dHash = decisionHash({ seq, kind, payload })
  const prevHash = chain.head
  const hash = seal(seq, kind, dHash, prevHash)

  const entry: LedgerEntry = {
    seq,
    ts: Date.now(),
    kind,
    decisionHash: dHash,
    prevHash,
    hash,
    payload,
  }
  chain.seq = seq
  chain.head = hash
  chain.entries.push(entry)

  if (kind === 'DECISION' || kind === 'SENTINEL') {
    chain.pendingAnchors.push(dHash)
    if (chain.pendingAnchors.length >= ANCHOR_BATCH_SIZE) {
      const batch = chain.pendingAnchors.splice(0, ANCHOR_BATCH_SIZE)
      const root = '0x' + sha256Hex(batch.join(''))
      const anchor: AnchorRecord = {
        txHash: txHash(),
        block: blockHeight,
        root,
        count: batch.length,
        ts: Date.now(),
        status: 'CONFIRMED',
        gasUsed: 21000 + Math.floor(Math.random() * 48000),
      }
      chain.anchors.push(anchor)
      const anchorPayload = { type: 'ANCHOR_COMMIT', root, count: batch.length, block: blockHeight, decisionRoots: batch }
      const aSeq = chain.seq + 1
      const aDHash = decisionHash({ seq: aSeq, kind: 'ANCHOR', payload: anchorPayload })
      const aHash = seal(aSeq, 'ANCHOR', aDHash, chain.head)
      const anchorEntry: LedgerEntry = {
        seq: aSeq,
        ts: Date.now(),
        kind: 'ANCHOR',
        decisionHash: aDHash,
        prevHash: chain.head,
        hash: aHash,
        payload: anchorPayload,
        anchor,
      }
      chain.seq = aSeq
      chain.head = aHash
      chain.entries.push(anchorEntry)
      entry.anchor = anchor
    }
  }
  return entry
}

export function verifyChain(entries: LedgerEntry[]): { ok: boolean; brokenAt?: number; detail: string } {
  let prevHash = '0x' + '0'.repeat(64)
  for (const e of entries) {
    const expect = seal(e.seq, e.kind, e.decisionHash, e.prevHash)
    if (e.prevHash !== prevHash) {
      return { ok: false, brokenAt: e.seq, detail: `Chain link broken at entry #${e.seq}: prevHash mismatch` }
    }
    if (e.hash !== expect) {
      return { ok: false, brokenAt: e.seq, detail: `HMAC mismatch at entry #${e.seq} — payload tampered` }
    }
    prevHash = e.hash
  }
  return { ok: true, detail: `All ${entries.length} entries verified: chain links intact, HMACs valid` }
}

export function verifyAnchors(entries: LedgerEntry[], anchors: AnchorRecord[]): { txHash: string; rootMatch: boolean }[] {
  return anchors.map((a) => {
    const entry = entries.find((e) => e.kind === 'ANCHOR' && (e.payload as { root?: string }).root === a.root)
    if (!entry?.payload || !Array.isArray((entry.payload as { decisionRoots?: string[] }).decisionRoots)) {
      return { txHash: a.txHash, rootMatch: false }
    }
    const roots = (entry.payload as { decisionRoots: string[] }).decisionRoots
    const recomputed = '0x' + sha256Hex(roots.join(''))
    return { txHash: a.txHash, rootMatch: recomputed === a.root }
  })
}
