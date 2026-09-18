'use client'

// Gate tab — live CHP policy inspector: edit thresholds, watch verdicts.

import { useState } from 'react'
import type { AegisApi } from '@/lib/aegis/useAegis'
import { Panel, Stat, VerdictBadge, usd } from './primitives'

function Slider({ label, value, min, max, step, onChange, format }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; format: (v: number) => string
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[11px] text-zinc-400">{label}</span>
        <span className="font-mono text-[12px] text-violet-300">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded bg-zinc-700 accent-violet-500" />
    </label>
  )
}

export function GateTab({ api }: { api: AegisApi }) {
  const s = api.snap
  const [saved, setSaved] = useState(false)
  if (!s) return null
  const cfg = s.config
  const total = s.stats.pass + s.stats.blocked + s.stats.hitl + s.stats.locked || 1

  const patch = (p: Partial<typeof cfg>) => { api.patchConfig(p); setSaved(true); setTimeout(() => setSaved(false), 900) }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="PASS" value={s.stats.pass} tone="ok" sub={`${((s.stats.pass / total) * 100).toFixed(0)}% of verdicts`} />
        <Stat label="BLOCKED" value={s.stats.blocked} tone="bad" sub="policy refused broadcast" />
        <Stat label="HITL_REQUIRED" value={s.stats.hitl} tone="warn" sub="escalated to human" />
        <Stat label="LOCKED" value={s.stats.locked} tone="bad" sub="breaker engaged" />
        <Stat label="Exploit $ stopped" value={usd(s.stats.exploitsStoppedUSD)} tone="ok" sub="never reached mempool" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Panel title="HITL inbox" right={<span className="font-mono text-[10px] text-zinc-500">{s.hitl.filter((h) => h.status === 'PENDING').length} pending · human key</span>}>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {s.hitl.map((h) => (
              <div key={h.id} className={`rounded-lg border p-2.5 ${h.status === 'PENDING' ? 'border-amber-500/40 bg-amber-950/10' : 'border-zinc-800 bg-zinc-900/30 opacity-60'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase ${h.status === 'PENDING' ? 'bg-amber-500/15 text-amber-300' : h.status === 'APPROVED' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}`}>
                    {h.status}
                  </span>
                  <span className="font-mono text-[12px] text-zinc-200">{h.proposal.agentName}</span>
                  <span className={`font-mono text-[11px] ${h.proposal.side === 'BUY' ? 'text-emerald-400' : 'text-orange-400'}`}>{h.proposal.side}</span>
                  <span className="font-mono text-[11px] text-zinc-300">{h.proposal.token} {usd(h.proposal.notionalUSD)}</span>
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">{h.gateReason}</div>
                {h.status === 'PENDING' && (
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => api.resolveHitl(h.id, true)}
                      className="rounded border border-emerald-500/50 bg-emerald-500/15 px-3 py-1 font-mono text-[11px] text-emerald-300 hover:bg-emerald-500/25">
                      APPROVE
                    </button>
                    <button onClick={() => api.resolveHitl(h.id, false)}
                      className="rounded border border-red-500/50 bg-red-500/15 px-3 py-1 font-mono text-[11px] text-red-300 hover:bg-red-500/25">
                      REJECT
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!s.hitl.length && <div className="py-6 text-center text-[12px] text-zinc-600">No escalations — the deterministic gates have handled everything so far.</div>}
          </div>
        </Panel>

        <Panel title="CHP v1.0 policy kernel" right={saved ? <span className="font-mono text-[10px] text-emerald-400">applied ✓</span> : <span className="font-mono text-[10px] text-zinc-500">fail-closed</span>}>
          <div className="space-y-4">
            <Slider label="per_trade_cap" value={cfg.perTradeCapUSD} min={10000} max={150000} step={5000}
              onChange={(v) => patch({ perTradeCapUSD: v })} format={(v) => usd(v)} />
            <Slider label="daily_cap" value={cfg.dailyCapUSD} min={100000} max={1200000} step={50000}
              onChange={(v) => patch({ dailyCapUSD: v })} format={(v) => usd(v)} />
            <Slider label="confidence_floor" value={cfg.confidenceFloor} min={0.4} max={0.95} step={0.05}
              onChange={(v) => patch({ confidenceFloor: v })} format={(v) => `${(v * 100).toFixed(0)}%`} />
            <Slider label="velocity_max_per_min" value={cfg.velocityMaxPerMin} min={2} max={20} step={1}
              onChange={(v) => patch({ velocityMaxPerMin: v })} format={(v) => `${v}/min`} />
            <Slider label="concentration_max" value={cfg.concentrationMaxPct} min={0.1} max={0.8} step={0.05}
              onChange={(v) => patch({ concentrationMaxPct: v })} format={(v) => `${(v * 100).toFixed(0)}%`} />
            <Slider label="council_above" value={cfg.councilAboveUSD} min={5000} max={100000} step={5000}
              onChange={(v) => patch({ councilAboveUSD: v })} format={(v) => usd(v)} />
            <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-3">
              {s.tokens.map((t) => {
                const on = cfg.allowlist.includes(t.symbol)
                return (
                  <button key={t.symbol}
                    onClick={() => patch({ allowlist: on ? cfg.allowlist.filter((x) => x !== t.symbol) : [...cfg.allowlist, t.symbol] })}
                    className={`rounded border px-2 py-1 font-mono text-[11px] ${on ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300' : 'border-zinc-700 bg-zinc-800 text-zinc-500'}`}>
                    {on ? '✓ ' : '+ '}{t.symbol}
                  </button>
                )
              })}
            </div>
            <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-2.5 font-mono text-[11px] leading-5 text-zinc-500">
              allowlist: {cfg.allowlist.join(' · ')}<br />
              simulation_required: {String(cfg.simulationRequired)} · fail_closed: {String(cfg.failClosed)}<br />
              sim: {s.desk.simLabel}
            </div>
          </div>
        </Panel>

        <Panel title="Recent gate verdicts" right={<span className="font-mono text-[10px] text-zinc-500">full evaluation traces</span>} className="xl:col-span-2">
          <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
            {s.proposals.filter((p) => p.gate).slice(0, 18).map((p) => (
              <div key={p.proposal.id} className={`rounded-lg border p-2.5 ${p.gate!.verdict === 'PASS' ? 'border-emerald-900/60 bg-emerald-950/10' : p.gate!.verdict === 'LOCKED' ? 'border-red-600/60 bg-red-950/30' : p.gate!.verdict === 'BLOCKED' ? 'border-red-900/60 bg-red-950/10' : 'border-amber-900/60 bg-amber-950/10'}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <VerdictBadge v={p.gate!.verdict} small />
                  <span className="font-mono text-[12px] text-zinc-200">{p.proposal.agentName}</span>
                  <span className={`font-mono text-[11px] ${p.proposal.side === 'BUY' ? 'text-emerald-400' : 'text-orange-400'}`}>{p.proposal.side}</span>
                  <span className="font-mono text-[11px] text-zinc-300">{p.proposal.token} {usd(p.proposal.notionalUSD)}</span>
                  {p.proposal.source === 'DRILL' && <span className="rounded bg-red-500/20 px-1 py-0.5 font-mono text-[9px] text-red-300">DRILL</span>}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">{p.gate!.reason}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {p.gate!.checks.map((c) => (
                    <span key={c.rule} title={`${c.label}: ${c.detail}`}
                      className={`rounded px-1 py-0.5 font-mono text-[9px] ${c.passed === true ? 'bg-emerald-500/10 text-emerald-400' : c.passed === false ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-500'}`}>
                      {c.rule}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {!s.proposals.some((p) => p.gate) && <div className="py-8 text-center text-[12px] text-zinc-600">No verdicts yet — switch the desk on.</div>}
          </div>
        </Panel>
      </div>
    </div>
  )
}
