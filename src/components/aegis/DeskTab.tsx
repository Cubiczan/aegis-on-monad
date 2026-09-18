'use client'

// Desk tab — the live multi-agent trading desk with its full pipeline view.

import { useEffect, useRef, useState } from 'react'
import type { AegisApi } from '@/lib/aegis/useAegis'
import type { MarketToken, TrackedProposal } from '@/lib/aegis/types'
import { Panel, Stat, VerdictBadge, FeedLine, usd } from './primitives'

function Sparkline({ token }: { token: MarketToken }) {
  const h = token.history
  if (h.length < 2) return null
  const w = 120
  const height = 30
  const min = Math.min(...h)
  const max = Math.max(...h)
  const span = Math.max(max - min, 1e-9)
  const pts = h.map((v, i) => `${(i / (h.length - 1)) * w},${height - ((v - min) / span) * height}`).join(' ')
  const up = h[h.length - 1] >= h[0]
  return (
    <svg width={w} height={height} className="overflow-visible">
      <polyline points={pts} fill="none" strokeWidth="1.5" className={up ? 'stroke-emerald-400' : 'stroke-red-400'} />
    </svg>
  )
}

const STATUS_STYLE: Record<string, string> = {
  COUNCIL_PENDING: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
  GATE_PASS: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  GATE_BLOCKED: 'text-red-300 border-red-500/40 bg-red-500/10',
  GATE_LOCKED: 'text-red-300 border-red-500/60 bg-red-500/20',
  HITL_PENDING: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  EXECUTED: 'text-emerald-200 border-emerald-400/50 bg-emerald-400/15',
  SIM_FAILED: 'text-red-300 border-red-500/40 bg-red-500/10',
  REJECTED: 'text-zinc-400 border-zinc-600/50 bg-zinc-700/20',
}

function Pipeline({ p }: { p: TrackedProposal }) {
  const stages = ['signal', 'council', 'gate', 'sim', 'broadcast'] as const
  const reached: Record<string, number> = {
    COUNCIL_PENDING: 2, GATE_PASS: 4, GATE_BLOCKED: 3, GATE_LOCKED: 1, HITL_PENDING: 3,
    EXECUTED: 5, SIM_FAILED: 4, REJECTED: 3,
  }
  const stop = reached[p.status] ?? 0
  const gateFailed = p.status === 'GATE_BLOCKED' || p.status === 'REJECTED' || p.status === 'GATE_LOCKED'
  return (
    <div className="mt-1.5 flex items-center gap-1">
      {stages.map((st, i) => {
        let cls = 'bg-zinc-800 text-zinc-600'
        if (i < stop) cls = st === 'gate' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-zinc-600/40 text-zinc-300'
        if (i === stop - 1 && gateFailed) cls = 'bg-red-500/25 text-red-300'
        if (p.status === 'SIM_FAILED' && st === 'sim') cls = 'bg-red-500/25 text-red-300'
        if (p.status === 'COUNCIL_PENDING' && st === 'council') cls = 'bg-violet-500/25 text-violet-300 animate-pulse'
        if (p.status === 'GATE_LOCKED' && st === 'gate') cls = 'bg-red-500/40 text-red-200 animate-pulse'
        return (
          <span key={st} className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${cls}`}>{st}</span>
        )
      })}
    </div>
  )
}

export function DeskTab({ api }: { api: AegisApi }) {
  const s = api.snap
  const [selected, setSelected] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  if (!s) return null

  const nav = s.desk.treasuryUSD + s.desk.positions.reduce((a, p) => a + p.qty * (s.tokens.find((t) => t.symbol === p.token)?.price ?? 0), 0)
  const pnl = nav - s.desk.initialUSD
  const sel = s.proposals.find((p) => p.proposal.id === selected) ?? s.proposals[0]

  return (
    <div className="space-y-4">
      {s.desk.paused && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/50 bg-red-950/40 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" /><span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" /></span>
            <div>
              <div className="font-mono text-sm font-semibold text-red-300">CIRCUIT BREAKER ENGAGED — DESK LOCKED</div>
              <div className="text-[12px] text-red-200/70">{s.desk.pausedReason}</div>
            </div>
          </div>
          <button onClick={api.resume} className="rounded-md border border-amber-500/50 bg-amber-500/15 px-3 py-1.5 font-mono text-[12px] text-amber-300 hover:bg-amber-500/25">
            HUMAN KEY · RESUME DESK
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Desk" value={s.desk.running ? 'RUNNING' : 'HALTED'} tone={s.desk.running ? 'ok' : 'warn'} sub={`speed ${s.desk.speed.toLowerCase()}`} />
        <Stat label="Block" value={`#${s.desk.blockHeight.toLocaleString()}`} sub="monad testnet (sim)" />
        <Stat label="NAV" value={usd(nav)} tone={pnl >= 0 ? 'ok' : 'bad'} sub={`PnL ${pnl >= 0 ? '+' : ''}${usd(pnl)}`} />
        <Stat label="Cash" value={usd(s.desk.treasuryUSD)} />
        <Stat label="Daily notional" value={usd(s.desk.dailyNotionalUSD)} sub={`cap ${usd(s.config.dailyCapUSD)}`} />
        <Stat label="Zerion context" value={s.zerion.enabled ? 'LIVE' : 'MIRROR'} tone="ok" sub={`${s.desk.positions.length} positions → risk engine`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <Panel
          title="Signal → Council → Gate → Sim → Broadcast"
          right={
            <div className="flex items-center gap-1.5">
              {(['SLOW', 'NORMAL', 'FAST'] as const).map((sp) => (
                <button key={sp} onClick={() => api.setSpeed(sp)}
                  className={`rounded px-2 py-0.5 font-mono text-[10px] ${s.desk.speed === sp ? 'bg-violet-500/25 text-violet-200' : 'bg-zinc-800 text-zinc-500 hover:text-zinc-300'}`}>
                  {sp[0]}
                </button>
              ))}
              <button onClick={s.desk.running ? api.deskStop : api.deskStart}
                className="ml-1 rounded border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-400 hover:text-zinc-200">
                {s.desk.running ? 'PAUSE' : 'RUN'}
              </button>
            </div>
          }
        >
          <div ref={feedRef} className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
            {s.proposals.map((p) => (
              <button key={p.proposal.id} onClick={() => setSelected(p.proposal.id)}
                className={`block w-full rounded-lg border px-3 py-2 text-left transition-colors ${sel?.proposal.id === p.proposal.id ? 'border-zinc-600 bg-zinc-800/60' : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  {p.proposal.source === 'DRILL' && <span className="rounded bg-red-500/20 px-1.5 py-0.5 font-mono text-[9px] text-red-300">DRILL</span>}
                  <span className="font-mono text-[12px] text-zinc-200">{p.proposal.agentName}</span>
                  <span className={`font-mono text-[12px] ${p.proposal.side === 'BUY' ? 'text-emerald-400' : 'text-orange-400'}`}>{p.proposal.side}</span>
                  <span className="font-mono text-[12px] text-zinc-300">{p.proposal.token}</span>
                  <span className="font-mono text-[12px] text-zinc-400">{usd(p.proposal.notionalUSD)}</span>
                  <span className="font-mono text-[11px] text-zinc-500">@{(p.proposal.confidence * 100).toFixed(0)}%</span>
                  <span className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase ${STATUS_STYLE[p.status] ?? ''}`}>{p.status.replace('_', ' ')}</span>
                </div>
                <div className="truncate text-[11px] text-zinc-500">“{p.proposal.rationale}”</div>
                <Pipeline p={p} />
              </button>
            ))}
            {!s.proposals.length && <div className="py-8 text-center text-[12px] text-zinc-600">Waiting for the first signal…</div>}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Proposal dossier" right={<span className="font-mono text-[10px] text-zinc-500">{sel ? `#${sel.proposal.id}` : '—'}</span>}>
            {!sel || !sel.gate ? (
              <div className="py-6 text-center text-[12px] text-zinc-600">Select a proposal to inspect its evaluation trace.</div>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="font-mono text-zinc-200">{sel.proposal.agentName}</span>
                  <span className={`font-mono ${sel.proposal.side === 'BUY' ? 'text-emerald-400' : 'text-orange-400'}`}>{sel.proposal.side}</span>
                  <span className="font-mono text-zinc-300">{sel.proposal.token} {usd(sel.proposal.notionalUSD)}</span>
                  {sel.gate && <VerdictBadge v={sel.gate.verdict} small />}
                </div>
                {sel.council && (
                  <div className="rounded-md border border-violet-500/30 bg-violet-500/5 p-2.5">
                    <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-violet-300">LLM council · {sel.council.mode} · {sel.council.latencyMs}ms · quorum {sel.council.verdict}</div>
                    <div className="space-y-0.5">
                      {sel.council.seats.map((st) => (
                        <div key={st.seat} className="flex gap-2 text-[11px]">
                          <span className="font-mono text-zinc-500">{st.seat}</span>
                          <span className={`font-mono ${st.vote === 'APPROVE' ? 'text-emerald-400' : 'text-red-400'}`}>{st.vote}</span>
                          <span className="truncate text-zinc-500">{st.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1">
                  {sel.gate.checks.map((c) => (
                    <div key={c.rule} className="flex items-start gap-2 rounded border border-zinc-800 bg-zinc-900/50 px-2 py-1.5">
                      <span className={`mt-0.5 font-mono text-[10px] ${c.passed === true ? 'text-emerald-400' : c.passed === false ? 'text-red-400' : 'text-zinc-500'}`}>
                        {c.passed === true ? '✓' : c.passed === false ? '✗' : '…'}
                      </span>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-zinc-300">{c.label}</div>
                        <div className="break-words text-[11px] text-zinc-500">{c.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {sel.status === 'EXECUTED' && sel.executed && (
                  <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-2 py-1.5 font-mono text-[11px] text-emerald-300">
                    executed · {usd(sel.executed.notionalUSD)} @ {sel.executed.price < 0.01 ? sel.executed.price.toPrecision(3) : sel.executed.price.toFixed(2)} · sim {sel.executed.simLatencyMs}ms
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Market" right={<span className="font-mono text-[10px] text-zinc-500">simulated feed</span>}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {s.tokens.map((t) => (
                <div key={t.symbol} className={`rounded-lg border px-2.5 py-2 ${t.allowlisted ? 'border-zinc-800 bg-zinc-900/40' : 'border-red-900/50 bg-red-950/20'}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[12px] text-zinc-200">{t.symbol}</span>
                    {!t.allowlisted && <span className="font-mono text-[9px] text-red-400">NO LIST</span>}
                  </div>
                  <div className="font-mono text-[13px] text-zinc-100">{t.price < 0.01 ? t.price.toPrecision(3) : t.price.toFixed(t.price > 100 ? 1 : 3)}</div>
                  <Sparkline token={t} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Live decision feed" right={<span className="font-mono text-[10px] text-zinc-500">{s.feed.length} events</span>}>
        <div className="max-h-72 overflow-y-auto rounded border border-zinc-800 bg-zinc-950/70">
          {[...s.feed].reverse().map((f) => <FeedLine key={f.id} f={f} />)}
        </div>
      </Panel>
    </div>
  )
}
