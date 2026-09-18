// Aegis proof layer — HMAC-SHA256 chained audit ledger + batched Monad anchoring.
// The off-chain ledger is the record anyone can re-verify; the anchor root is what
// lands onchain (simulated here, real via AegisAnchor.sol in production).

import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { AnchorRecord, LedgerEntry, LedgerKind } from './types'

const HMAC_KEY = process.env.AEGIS_LEDGER_KEY || 'aegis-chp-v1-monad-testnet-hmac'
export const ANCHOR_BATCH_SIZE = 6

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export function canonicalJson(value: unknown): string {
  // Stable key ordering so the same logical payload always hashes identically.
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`
}

export function decisionHash(payload: Record<string, unknown>): string {
  return '0x' + sha256Hex(canonicalJson(payload))
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString('hex')
}

export function txHash(): string {
  return '0x' + randomHex(32)
}

export function agentAddress(): string {
  return '0x' + randomHex(20)
}

export interface ChainState {
  seq: number
  head: string
  entries: LedgerEntry[]
  pendingAnchors: string[]   // decision hashes waiting to be batched
  anchors: AnchorRecord[]
}

export function newChain(): ChainState {
  return { seq: 0, head: '0x' + '0'.repeat(64), entries: [], pendingAnchors: [], anchors: [] }
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
  const hash = '0x' + createHmac('sha256', HMAC_KEY)
    .update(`${seq}|${kind}|${dHash}|${prevHash}`)
    .digest('hex')

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
      // Anchor commitment itself is journalled into the chain.
      const anchorPayload = { type: 'ANCHOR_COMMIT', root, count: batch.length, block: blockHeight, decisionRoots: batch }
      const aSeq = chain.seq + 1
      const aDHash = decisionHash({ seq: aSeq, kind: 'ANCHOR', payload: anchorPayload })
      const aHash = '0x' + createHmac('sha256', HMAC_KEY)
        .update(`${aSeq}|ANCHOR|${aDHash}|${chain.head}`)
        .digest('hex')
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
    const expect = '0x' + createHmac('sha256', HMAC_KEY)
      .update(`${e.seq}|${e.kind}|${e.decisionHash}|${e.prevHash}`)
      .digest('hex')
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
    // The ANCHOR-kind entry journalled the batch (decisionRoots) — recompute its root.
    const entry = entries.find((e) => e.kind === 'ANCHOR' && (e.payload as { root?: string }).root === a.root)
    if (!entry?.payload || !Array.isArray((entry.payload as { decisionRoots?: string[] }).decisionRoots)) {
      return { txHash: a.txHash, rootMatch: false }
    }
    const roots = (entry.payload as { decisionRoots: string[] }).decisionRoots
    const recomputed = '0x' + sha256Hex(roots.join(''))
    return { txHash: a.txHash, rootMatch: recomputed === a.root }
  })
}
