'use client'

// Ledger tab — HMAC-chained proof ledger + Monad anchor commitments.

import { useState } from 'react'
import type { AegisApi } from '@/lib/aegis/useAegis'
import type { VerifyReport } from '@/lib/aegis/types'
import { Panel, Stat, Hash } from './primitives'

const KIND_STYLE: Record<string, string> = {
  DECISION: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  ANCHOR: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  SENTINEL: 'bg-red-500/15 text-red-300 border-red-500/40',
  REGISTRY: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/30',
  HITL: 'bg-orange-500/10 text-orange-300 border-orange-500/30',
  COUNCIL: 'bg-violet-500/10 text-violet-300 border-violet-500/30',
}

export function LedgerTab({ api }: { api: AegisApi }) {
  const s = api.snap
  const [report, setReport] = useState<(VerifyReport & { checked?: number }) | null>(null)
  const [verifying, setVerifying] = useState(false)
  if (!s) return null

  const runVerify = () => {
    setVerifying(true)
    api.verify((r) => { setReport(r as VerifyReport); setVerifying(false) })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Ledger head" value={`#${s.ledgerHead.seq}`} sub={<Hash h={s.ledgerHead.hash} len={16} />} />
        <Stat label="Entries" value={s.ledgerHead.count} sub="HMAC-SHA256 chained" />
        <Stat label="Anchors" value={s.anchors.length} tone="ok" sub={`${s.stats.anchored} decisions committed`} />
        <Stat label="Verify" value={report ? (report.ok ? 'INTACT' : `BROKEN @${report.brokenAt}`) : 'READY'} tone={report ? (report.ok ? 'ok' : 'bad') : 'default'}
          sub={report ? `${report.checked ?? 0} entries recomputed` : 'run the verifier'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Panel title="Audit ledger" right={
          <button onClick={runVerify} disabled={verifying}
            className="rounded-md border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 font-mono text-[11px] text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50">
            {verifying ? 'VERIFYING…' : 'VERIFY CHAIN'}
          </button>
        }>
          {report && (
            <div className={`mb-3 rounded-md border px-3 py-2 font-mono text-[11px] ${report.ok ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-red-500/50 bg-red-500/10 text-red-300'}`}>
              {report.detail}
              {report.anchorChecks?.length ? (
                <div className="mt-1 text-zinc-400">
                  anchors: {report.anchorChecks.map((a) => `${a.txHash.slice(0, 10)}…${a.rootMatch ? '✓' : '✗'}`).join('  ')}
                </div>
              ) : null}
            </div>
          )}
          <div className="max-h-[34rem] overflow-y-auto rounded border border-zinc-800">
            {[...s.ledger].reverse().map((e) => (
              <div key={e.seq} className="border-b border-zinc-800/70 px-3 py-2 last:border-0 hover:bg-zinc-900/40">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[11px] text-zinc-600">#{e.seq}</span>
                  <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${KIND_STYLE[e.kind] ?? ''}`}>{e.kind}</span>
                  <span className="text-[11px] text-zinc-400">
                    {e.kind === 'DECISION' && `${String(e.payload.agent ?? '')} ${String(e.payload.action ?? '')} → ${String(e.payload.verdict ?? '')}`}
                    {e.kind === 'ANCHOR' && `commit root ${String(e.payload.root ?? '').slice(0, 16)}… (${String(e.payload.count)} decisions) @ block ${String(e.payload.block)}`}
                    {e.kind === 'SENTINEL' && `${String(e.payload.action ?? '')} — ${String(e.payload.reason ?? e.payload.status ?? '')}`}
                    {e.kind === 'REGISTRY' && `${String(e.payload.action ?? '')} ${String((e.payload.agent as { name?: string })?.name ?? '')}`}
                    {e.kind === 'COUNCIL' && `${String(e.payload.verdict)} (${String(e.payload.mode)}) on ${String(e.payload.proposalId)}`}
                    {e.kind === 'HITL' && `human gate ${String(e.payload.stage ?? '')}`}
                  </span>
                  {e.anchor && <span className="ml-auto font-mono text-[9px] text-amber-400/80">sealed @ block {e.anchor.block}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 font-mono text-[10px] text-zinc-600">
                  <span>dhash {e.decisionHash.slice(0, 18)}…</span>
                  <span>hmac {e.hash.slice(0, 18)}…</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">
            hash = HMAC-SHA256(seq, kind, decisionHash, prevHash). Blocks and approvals are decisions too —
            the chain records what the system refused, not just what it did.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Onchain anchors" right={<span className="font-mono text-[10px] text-zinc-500">AegisAnchor.sol commits</span>}>
            <div className="space-y-2">
              {[...s.anchors].reverse().map((a, i) => (
                <div key={a.txHash} className="rounded-lg border border-amber-900/40 bg-amber-950/10 p-2.5">
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">CONFIRMED</span>
                    <span className="text-zinc-300">block {a.block.toLocaleString()}</span>
                    <span className="ml-auto text-zinc-500">{i === 0 ? 'latest' : `-${i}`}</span>
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-zinc-500">tx <span className="text-zinc-400">{a.txHash.slice(0, 26)}…</span></div>
                  <div className="font-mono text-[10px] text-zinc-500">root <span className="text-amber-400/90">{a.root.slice(0, 26)}…</span></div>
                  <div className="mt-0.5 text-[11px] text-zinc-500">{a.count} decision hashes · gas {a.gasUsed.toLocaleString()} · {new Date(a.ts).toLocaleTimeString('en-US', { hour12: false })}</div>
                </div>
              ))}
              {!s.anchors.length && (
                <div className="py-8 text-center text-[12px] text-zinc-600">
                  First anchor lands after 6 decisions — give the desk a moment.
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Execution tape" right={<span className="font-mono text-[10px] text-zinc-500">what actually broadcast</span>}>
            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {s.trades.map((t) => (
                <div key={t.id + t.ts} className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 font-mono text-[11px]">
                  <span className="text-zinc-600">{new Date(t.ts).toLocaleTimeString('en-US', { hour12: false })}</span>
                  <span className="text-zinc-300">{t.agentName}</span>
                  <span className={t.side === 'BUY' ? 'text-emerald-400' : 'text-orange-400'}>{t.side}</span>
                  <span className="text-zinc-300">{t.token} ${Math.round(t.notionalUSD).toLocaleString()}</span>
                  <span className="ml-auto text-[10px] text-cyan-400">sim {t.simLatencyMs}ms</span>
                </div>
              ))}
              {!s.trades.length && <div className="py-6 text-center text-[12px] text-zinc-600">No executions yet.</div>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
