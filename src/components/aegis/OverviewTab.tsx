'use client'

// Overview tab — what this is, the four layers, live trust telemetry.

import type { AegisApi } from '@/lib/aegis/useAegis'
import { Panel, Stat, Hash, StatusDot } from './primitives'

const LAYERS = [
  {
    id: '01', name: 'Identity', tag: 'ERC-8004 Registry', accent: 'text-fuchsia-400 border-fuchsia-500/40 bg-fuchsia-500/10',
    body: 'Agents register onchain with a name, domain and capability set. The gate refuses any broadcast from an identity that is unregistered, paused, or frozen — identity is the first policy rule, not a profile page.',
    demo: 'Register an agent and watch the registry entry journalled to the ledger.',
  },
  {
    id: '02', name: 'Gate', tag: 'CHP v1.0 Policy Engine', accent: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
    body: 'Every capital-moving action runs ten fail-closed checks before broadcast: breaker state, ERC-8004 identity, asset allowlist, per-trade cap, daily notional, velocity, confidence floor, concentration, LLM council for large size, pre-broadcast simulation. Outcomes: PASS / HITL_REQUIRED / BLOCKED / LOCKED.',
    demo: 'Open the Gate tab to edit policy and inspect full evaluation traces.',
  },
  {
    id: '03', name: 'Proof', tag: 'HMAC Ledger + Onchain Anchors', accent: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
    body: 'Every decision — including blocks — is hashed into an HMAC-SHA256 chained ledger. Batches of six decision hashes are sealed into an anchor root committed to Monad. Anyone can re-verify the chain and recompute every anchor root.',
    demo: 'Hit VERIFY in the Ledger tab to recompute the chain yourself.',
  },
  {
    id: '04', name: 'Sentinel', tag: 'Autonomous Circuit Breaker', accent: 'text-red-400 border-red-500/40 bg-red-500/10',
    body: 'A watcher swarm scores in-flight traffic against exploit shapes: drain sweeps, flash-loan pairs, prompt injection. On 2-of-3 watcher consensus with OSINT confirmation, the breaker pauses the desk autonomously. Benign shapes get cleared as false positives before any pause.',
    demo: 'Run the three drills in the Sentinel tab — two pause, one stands down.',
  },
]

export function OverviewTab({ api }: { api: AegisApi }) {
  const s = api.snap
  if (!s) return null
  const pnl = s.desk.treasuryUSD + s.desk.positions.reduce((a, p) => a + p.qty * (s.tokens.find((t) => t.symbol === p.token)?.price ?? 0), 0) - s.desk.initialUSD
  const total = s.stats.pass + s.stats.blocked + s.stats.hitl + s.stats.locked

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-violet-500/30 bg-gradient-to-br from-violet-950/60 via-zinc-900 to-zinc-900 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="mb-1 font-mono text-[11px] uppercase tracking-widest text-violet-400">Trust, Identity &amp; AI Infrastructure · Metropolis Track 4</div>
            <h1 className="text-2xl font-semibold text-zinc-50 sm:text-3xl">The trust layer for AI agents that move capital</h1>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              A live working prototype on Monad: an ERC-8004 agent registry, a fail-closed policy gate on every transaction,
              per-decision proof anchoring, and an autonomous circuit breaker — demonstrated by a multi-agent trading desk
              where every signal, council vote, block and anchor lands in public view.
            </p>
          </div>
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3 font-mono text-[11px] leading-5 text-zinc-400">
            <div><span className="text-violet-400">chain</span> monad testnet · {s.desk.chainId}</div>
            <div><span className="text-violet-400">rpc</span> public endpoints + rotator (OSS)</div>
            <div><span className="text-violet-400">sim</span> anvil fork pre-flight (OSS)</div>
            <div><span className="text-violet-400">portfolio</span> zerion api (server-side)</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Breaker" value={s.desk.paused ? 'LOCKED' : 'OPEN'} tone={s.desk.paused ? 'bad' : 'ok'} sub={s.desk.paused ? s.desk.pausedReason?.slice(0, 44) : 'desk trading'} />
        <Stat label="Decisions" value={total} sub={`${s.stats.pass} pass · ${s.stats.blocked} blocked`} />
        <Stat label="HITL queue" value={s.hitl.filter((h) => h.status === 'PENDING').length} tone={s.hitl.some((h) => h.status === 'PENDING') ? 'warn' : 'default'} sub="awaiting human" />
        <Stat label="Ledger head" value={`#${s.ledgerHead.seq}`} sub={<Hash h={s.ledgerHead.hash} len={12} />} />
        <Stat label="Anchors sealed" value={s.anchors.length} tone="ok" sub={`${s.stats.anchored} decisions onchain`} />
        <Stat label="Desk PnL" value={`${pnl >= 0 ? '+' : ''}$${Math.round(pnl).toLocaleString()}`} tone={pnl >= 0 ? 'ok' : 'bad'} sub={`nav $${Math.round(pnl + s.desk.initialUSD).toLocaleString()}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {LAYERS.map((l) => (
          <Panel key={l.id} title={<span>Layer {l.id} · {l.name}</span>} right={<span className={`rounded border px-2 py-0.5 font-mono text-[10px] ${l.accent}`}>{l.tag}</span>}>
            <p className="text-[13px] leading-6 text-zinc-400">{l.body}</p>
            <p className="mt-2 border-t border-zinc-800 pt-2 text-[12px] leading-5 text-zinc-500"><span className="text-zinc-300">Demo it:</span> {l.demo}</p>
          </Panel>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Sentinel watchers" right={<span className="font-mono text-[10px] text-zinc-500">in-band, every proposal</span>}>
          <ul className="space-y-2">
            {s.sentinel.watchers.map((w) => (
              <li key={w.id} className="flex items-start gap-2.5">
                <span className="mt-1.5"><StatusDot ok={w.status === 'ONLINE'} firing={w.firing} /></span>
                <div>
                  <div className="font-mono text-[12px] text-zinc-200">{w.id} {w.name} <span className="text-zinc-500">· {w.kind.toLowerCase()}</span></div>
                  <div className="text-[11px] text-zinc-500">{w.description}</div>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Stack honesty" right={<span className="font-mono text-[10px] text-zinc-500">what runs where</span>}>
          <ul className="space-y-2 text-[12px] leading-5 text-zinc-400">
            <li><span className="text-zinc-200">Engine (this demo):</span> deterministic simulation of Monad settlement, RPC rotation and Anvil fork pre-flight — fast enough to show every stage of the pipeline live.</li>
            <li><span className="text-zinc-200">LLM council:</span> real model calls (three seats, strict JSON quorum) with a deterministic heuristic fallback so the demo never stalls.</li>
            <li><span className="text-zinc-200">Ledger + anchors:</span> real HMAC-SHA256 chaining and real hash recomputation on verify; anchor txs model the <em>AegisAnchor.sol</em> commit in the Contracts tab.</li>
            <li><span className="text-zinc-200">Production path:</span> same kernel, wired to a Monad node + Foundry fork; breaker pauses via <em>AegisBreaker.sol</em> 2-of-3 watcher consensus.</li>
          </ul>
        </Panel>
      </div>
    </div>
  )
}
